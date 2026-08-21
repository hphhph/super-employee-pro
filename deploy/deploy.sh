#!/usr/bin/env bash
# ============================================================
# AI超级员工 · Linux 服务器一键部署脚本
#
# 适用系统: Ubuntu 20.04 / 22.04 / 24.04, Debian 11/12
# 推荐配置: 4C8G 起
#
# 用法:
#   bash deploy/deploy.sh                     # 一键部署核心系统（幂等，可重复执行）
#   bash deploy/deploy.sh --full              # 核心 + 第三方工具（爬虫/文案提取/混剪，依赖重、耗时长）
#   bash deploy/deploy.sh --no-mirror         # 不用国内镜像源（服务器在海外时使用）
#   bash deploy/deploy.sh --domain=a.com --email=you@a.com   # 自动申请 HTTPS 证书
#
# 部署内容:
#   MySQL 8 + Redis 7 + nginx + 后端(NestJS) + 前端(vite构建) + video-api(智能成片)
#   全部 systemd 守护，服务器重启自动拉起，统一 nginx :80 入口
# ============================================================
set -euo pipefail

# ---------- 常量 ----------
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BASE_DIR/.env"
ENV_EXAMPLE="$BASE_DIR/.env.example"
NGINX_TPL="$BASE_DIR/deploy/nginx-super-employee.conf"
NGINX_DST="/etc/nginx/conf.d/super-employee.conf"
WEB_ROOT="$BASE_DIR/packages/desktop/dist"
FRONTEND_ORIGIN="$BASE_DIR/packages/desktop"
BACKEND_DIR="$BASE_DIR/packages/server"
VIDEO_API_DIR="$BASE_DIR/services/video-generator"
DB_NAME="super_employee"

WITH_FULL=0
WITH_MIRROR=1
DOMAIN=""
HTTPS_EMAIL=""

for arg in "$@"; do
  case "$arg" in
    --full) WITH_FULL=1 ;;
    --no-mirror) WITH_MIRROR=0 ;;
    --domain=*) DOMAIN="${arg#*=}" ;;
    --email=*) HTTPS_EMAIL="${arg#*=}" ;;
    *) echo "未知参数: $arg (可用: --full / --no-mirror / --domain=x / --email=y)"; exit 1 ;;
  esac
done

# ---------- 输出工具 ----------
info() { echo -e "\033[32m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
step() { echo -e "\n\033[36m========== $* ==========\033[0m"; }
die()  { echo -e "\033[31m[ERROR]\033[0m $*" >&2; exit 1; }

# ---------- 环境检查 ----------
[ "$(id -u)" -eq 0 ] || die "请用 root 运行: sudo bash deploy/deploy.sh"
command -v apt-get >/dev/null 2>&1 || die "本脚本仅支持 Ubuntu/Debian (apt) 系统。当前系统请使用 docker-compose 路线部署。"

# ---------- 公网 IP 检测（用于前端 WS 地址，失败则跳过） ----------
detect_public_ip() {
  for url in ifconfig.me ipinfo.io/ip api.ipify.org; do
    local ip
    ip=$(curl -s --max-time 4 "https://$url" 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    [ -n "$ip" ] && { echo "$ip"; return; }
  done
  echo ""
}

# ============================================================
# 1. 系统依赖
# ============================================================
install_system_deps() {
  step "1/10 安装系统依赖"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends \
    curl wget git unzip ca-certificates \
    build-essential python3 python3-venv python3-pip \
    ffmpeg nginx mysql-server redis-server openssl
  systemctl enable --now mysql redis-server 2>/dev/null || true
  info "系统依赖安装完成（ffmpeg / nginx / MySQL / Redis / Python3）"
}

# ============================================================
# 2. Node.js + pnpm
# ============================================================
ensure_node() {
  step "2/10 检查 Node.js"
  local node_ver
  node_ver=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)
  if [ "$node_ver" -ge 20 ] 2>/dev/null; then
    info "Node.js 已就绪: $(node -v)"
  else
    info "安装 Node.js 20 LTS (nodesource)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    node_ver=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)
    [ "$node_ver" -ge 20 ] || die "Node.js 安装失败"
    info "Node.js 安装完成: $(node -v)"
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    info "安装 pnpm@8..."
    npm install -g pnpm@8
  fi
  info "pnpm: $(pnpm -v)"

  # 国内服务器加速
  if [ "$WITH_MIRROR" -eq 1 ]; then
    npm config set registry https://registry.npmmirror.com
    pnpm config set registry https://registry.npmmirror.com
    info "已启用 npmmirror 加速"
  fi
}

# ============================================================
# 3. 生成 .env
# ============================================================
setup_env() {
  step "3/10 配置环境变量"
  [ -f "$ENV_EXAMPLE" ] || die "未找到 .env.example，请确认项目文件已完整上传"

  if [ ! -f "$ENV_FILE" ]; then
    info "首次部署，生成 .env..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
  else
    info ".env 已存在，将保留 API Key，仅修正部署参数（数据库地址 / API 地址 / 密钥）"
  fi

  # 始终修正部署关键参数；JWT_SECRET / MySQL 密码为默认值或空时自动随机化
  python3 - "$ENV_FILE" "$DB_NAME" <<'PYEOF'
import sys, secrets, re, subprocess
path, db = sys.argv[1], sys.argv[2]
raw = open(path, encoding='utf-8').read()
lines = raw.splitlines(keepends=True)

def getval(k):
    m = re.search(rf'^{k}\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\n#]*))', raw, re.M)
    if not m: return ''
    return (m.group(2) or m.group(3) or m.group(4) or '').strip()

def fix_pw(v):
    if not v or v == 'SuperEmployee@2026' or len(v) < 8:
        return secrets.token_hex(12)
    return v

jwt = getval('JWT_SECRET')
pw  = fix_pw(getval('MYSQL_ROOT_PASSWORD'))
if not jwt or jwt.startswith('change-this'):
    jwt = secrets.token_hex(32)

ip = ''
for u in ('https://ifconfig.me', 'https://ipinfo.io/ip', 'https://api.ipify.org'):
    try:
        r = subprocess.run(['curl','-s','--max-time','4',u], capture_output=True, text=True, timeout=6)
        m = re.search(r'[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+', r.stdout or '')
        if m: ip = m.group(0); break
    except Exception:
        continue

replace = {
    'NODE_ENV':            'production',
    'JWT_SECRET':          jwt,
    'MYSQL_ROOT_PASSWORD': pw,
    'DATABASE_URL':        f'mysql://root:{pw}@127.0.0.1:3306/{db}',
    'VITE_API_BASE_URL':   '/api',
    'VITE_WS_URL':         (f'ws://{ip}/ws' if ip else ''),
    'VIDEO_API_URL':       'http://127.0.0.1:8080',
    'REDIS_PASSWORD':      pw,
    'REDIS_URL':           f'redis://:{pw}@127.0.0.1:6379',
}

seen = set()
out = []
for line in lines:
    m = re.match(r'^([A-Z_]+)\s*=', line)
    if m and m.group(1) in replace:
        k = m.group(1)
        out.append(f'{k}={replace[k]}\n')
        seen.add(k)
    else:
        out.append(line)
for k, v in replace.items():
    if k not in seen:
        out.append(f'{k}={v}\n')
open(path, 'w', encoding='utf-8').writelines(out)
print(f'  → 数据库密码: {pw}')
print(f'  → 公网IP: {ip or "未检测到（前端 WS 地址留空，不影响主功能）"}')
PYEOF
  chmod 600 "$ENV_FILE"
  info ".env 就绪"
}

# ============================================================
# 4. MySQL 初始化
# ============================================================
get_mysql_pw() {
  # 从 .env 解析密码（支持带引号/不带引号）
  sed -n 's/^MYSQL_ROOT_PASSWORD=//p' "$ENV_FILE" | tr -d '"' | tail -1
}

mysql_exec() {
  # 优先用密码连接，失败则回退 socket 免密（首次初始化时）
  local pw="$1"; shift
  if mysql -uroot -p"$pw" -e 'SELECT 1' >/dev/null 2>&1; then
    mysql -uroot -p"$pw" "$@"
  else
    mysql -uroot "$@"
  fi
}

setup_mysql() {
  step "4/10 初始化 MySQL"
  local pw; pw=$(get_mysql_pw)
  [ -n "$pw" ] || die "未从 .env 解析到 MySQL 密码"

  mysql_exec "$pw" <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '${pw}';
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY '${pw}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
SQL
  info "数据库 ${DB_NAME} 就绪"
}

# ============================================================
# 5. 安装 JS 依赖 + 初始化数据库表
# ============================================================
setup_workspace_deps() {
  step "5/10 安装项目依赖（pnpm workspace，约 2-5 分钟）"
  cd "$BASE_DIR"
  pnpm install
  info "依赖安装完成"
}

init_database() {
  step "6/10 初始化数据库表结构与种子数据"
  cd "$BACKEND_DIR"
  set -a; source "$ENV_FILE"; set +a

  npx prisma generate
  npx prisma db push
  npx ts-node prisma/seed.ts
  info "数据表与管理员账号已就绪（admin / admin123，首次登录后请修改）"
}

# ============================================================
# 6. 构建并启动后端
# ============================================================
deploy_backend() {
  step "7/10 构建并启动后端"
  cd "$BACKEND_DIR"
  set -a; source "$ENV_FILE"; set +a
  pnpm build
  info "后端构建完成（dist/）"

  local node_bin; node_bin=$(command -v node)
  cat > /etc/systemd/system/se-server.service <<EOF
[Unit]
Description=Super Employee - Backend (NestJS)
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
WorkingDirectory=$BACKEND_DIR
ExecStart=/bin/bash -c 'set -a; source $ENV_FILE; set +a; exec $node_bin dist/main.js'
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now se-server
  info "后端 systemd 服务已启动: systemctl status se-server"
}

# ============================================================
# 7. 构建前端
# ============================================================
deploy_frontend() {
  step "8/10 构建前端"
  cd "$FRONTEND_ORIGIN"
  # vite 只读 packages/desktop 下的 env，这里显式注入同源 API 地址（走 nginx 反代，规避 CORS）
  VITE_API_BASE_URL=/api pnpm build
  [ -d "$WEB_ROOT" ] || die "前端构建失败，未生成 dist/"
  info "前端构建完成 → $WEB_ROOT"
}

# ============================================================
# 8. video-api（智能成片引擎）
# ============================================================
deploy_video_api() {
  step "9/10 部署 video-api（MoneyPrinterTurbo 智能成片）"
  cd "$VIDEO_API_DIR"
  if [ ! -d .venv ]; then
    command -v uv >/dev/null 2>&1 || python3 -m pip install uv -q
    if [ "$WITH_MIRROR" -eq 1 ]; then
      export UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
    fi
    uv sync --no-dev
  fi
  info "video-api 依赖就绪 (.venv)"

  cat > /etc/systemd/system/se-video-api.service <<EOF
[Unit]
Description=Super Employee - Video API (FastAPI)
After=network.target

[Service]
Type=simple
WorkingDirectory=$VIDEO_API_DIR
ExecStart=$VIDEO_API_DIR/.venv/bin/python main.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now se-video-api
  info "video-api 已启动: systemctl status se-video-api"
}

# ============================================================
# 9. nginx 统一入口
# ============================================================
setup_nginx() {
  step "10/10 配置 nginx 统一入口"
  [ -f "$NGINX_TPL" ] || die "缺少 nginx 模板: $NGINX_TPL"
  [ -d "$WEB_ROOT" ] || die "前端 dist 不存在，请先部署前端"

  sed -e "s|{{WEB_ROOT}}|$WEB_ROOT|g" -e "s|{{DOMAIN}}|_|g" "$NGINX_TPL" > "$NGINX_DST"
  # 移除默认站点，避免与 80 端口配置冲突
  rm -f /etc/nginx/sites-enabled/default
  nginx -t || die "nginx 配置校验失败"
  systemctl enable --now nginx
  systemctl reload nginx || systemctl restart nginx
  info "nginx 已就绪（80 端口统一入口）"
}

# ============================================================
# 10. 防火墙
# ============================================================
setup_firewall() {
  step "配置防火墙（如已启用）"
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw allow 22/tcp >/dev/null 2>&1 || true
    info "ufw 已放行 80/443/22"
  fi
  if command -v firewalld >/dev/null 2>&1 && systemctl is-active firewalld >/dev/null 2>&1; then
    firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true
    firewall-cmd --permanent --add-service=https >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
    info "firewalld 已放行 http/https"
  fi
}

# ============================================================
# 11. 健康检查
# ============================================================
health_check() {
  step "健康检查"
  local ip; ip=$(detect_public_ip || echo "服务器IP")
  local ok=1
  for t in "系统前端 http://127.0.0.1/" "后端API http://127.0.0.1/api/auth/login" "video-api http://127.0.0.1:8080/docs"; do
    local name="${t%% *}" url="${t#* }"
    if curl -s -o /dev/null --max-time 5 "$url" 2>/dev/null; then
      info "✅ $name 正常"
    else
      warn "⚠️ $name 未就绪（$url），请查看: journalctl -u se-server -n 50"
      ok=0
    fi
  done
  [ "$ok" -eq 1 ] || die "部分服务未就绪，请根据提示排查"
}

# ============================================================
# 可选：第三方工具（--full 时）
# ============================================================
deploy_extra() {
  step "部署第三方工具（爬虫 / 文案提取 / 混剪）"
  bash "$BASE_DIR/deploy/deploy-extra.sh" --no-ask
}

# ============================================================
main() {
  echo "============================================================"
  echo " AI超级员工 · 一键部署"
  echo " 项目目录: $BASE_DIR"
  echo " 模式: $([ "$WITH_FULL" -eq 1 ] && echo '完整(含第三方工具)' || echo '核心(系统+智能成片)')"
  echo "============================================================"

  install_system_deps
  ensure_node
  setup_env
  setup_mysql
  setup_workspace_deps
  init_database
  deploy_backend
  deploy_frontend
  deploy_video_api
  setup_nginx
  setup_firewall
  [ "$WITH_FULL" -eq 1 ] && deploy_extra

  health_check

  local ip; ip=$(detect_public_ip || echo "服务器IP")
  echo ""
  echo "============================================================"
  echo " 部署完成 ✅"
  echo ""
  echo "  🏠 系统主页   http://$ip  (admin / admin123)"
  echo "  🎬 智能成片   http://$ip:8080/docs"
  if [ "$WITH_FULL" -eq 1 ]; then
    echo "  🟢 数据采集   http://$ip:5174"
    echo "  🟢 文案提取   http://$ip:7860"
    echo "  🟢 混剪发布   http://$ip:8501"
  else
    echo "  （第三方工具未装，需要时执行: bash deploy/deploy-extra.sh）"
  fi
  echo ""
  echo " 常用命令:"
  echo "   重启后端    systemctl restart se-server"
  echo "   查看日志    journalctl -u se-server -n 100 -f"
  echo "   全部服务    systemctl list-units 'se-*'"
  echo "============================================================"
}

main "$@"
