#!/usr/bin/env bash
# ============================================================
# AI超级员工 · 第三方工具部署脚本（数据采集 / 文案提取 / 混剪发布）
#
# 适用系统: Ubuntu 20.04 / 22.04 / 24.04, Debian 11/12
# 内存建议: 第三方工具较重（faster-whisper 模型、torch），4C8G 建议按需启用
#
# 用法:
#   bash deploy/deploy-extra.sh                # 部署全部三个工具
#   bash deploy/deploy-extra.sh --skip-mpp     # 跳过 MoneyPrinterPlus（torch 依赖大）
#   bash deploy/deploy-extra.sh --skip-uve     # 跳过视频文案提取（faster-whisper 吃内存）
#   bash deploy/deploy-extra.sh --skip-crawler # 跳过 MediaCrawler 数据采集
#   bash deploy/deploy-extra.sh --no-mirror    # 不用国内镜像源
#   bash deploy/deploy-extra.sh --no-ask       # 非交互模式（供 deploy.sh --full 调用）
# ============================================================
set -uo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PY_MIRROR="https://pypi.tuna.tsinghua.edu.cn/simple"
WITH_ASK=1

SKIP_CRAWLER=0; SKIP_UVE=0; SKIP_MPP=0
for arg in "$@"; do
  case "$arg" in
    --skip-crawler) SKIP_CRAWLER=1 ;;
    --skip-uve)     SKIP_UVE=1 ;;
    --skip-mpp)     SKIP_MPP=1 ;;
    --no-mirror)    PY_MIRROR="" ;;
    --no-ask)       WITH_ASK=0 ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

info() { echo -e "\033[32m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }
step() { echo -e "\n\033[36m========== $* ==========\033[0m"; }
die()  { echo -e "\033[31m[ERROR]\033[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 root 运行: sudo bash deploy/deploy-extra.sh"
command -v apt-get >/dev/null 2>&1 || die "本脚本仅支持 Ubuntu/Debian 系统"

PIP_ARGS=()
[ -n "$PY_MIRROR" ] && PIP_ARGS=(--index-url "$PY_MIRROR")

# ---------- 确认函数 ----------
ask_yes() {
  [ "$WITH_ASK" -eq 1 ] || return 0
  local ans
  read -r -p "$1 [Y/n] " ans
  case "$ans" in ""|Y|y|yes) return 0;; *) return 1;; esac
}

# ============================================================
# MediaCrawler 数据采集（API 8082 + WebUI 5174）
# ============================================================
deploy_crawler() {
  step "部署 MediaCrawler（数据采集，API:8082 / WebUI:5174）"
  local dir="$BASE_DIR/third-party/MediaCrawler"
  [ -f "$dir/requirements.txt" ] || { warn "缺少 MediaCrawler 依赖文件，跳过"; return 1; }

  if [ ! -d "$dir/.venv" ]; then
    info "创建 Python 虚拟环境并安装依赖（约 2-4 分钟）..."
    python3 -m venv "$dir/.venv"
    "$dir/.venv/bin/pip" install --upgrade pip -q
    "$dir/.venv/bin/pip" install "${PIP_ARGS[@]}" -r "$dir/requirements.txt" -q || {
      warn "MediaCrawler 依赖安装失败，跳过"; return 1; }
  fi

  info "安装 WebUI 前端依赖..."
  ( cd "$dir/webui" && npm install --no-audit --no-fund >/dev/null 2>&1 ) || warn "WebUI 依赖安装失败（稍后可手动重试）"

  # API 服务
  cat > /etc/systemd/system/se-medcrawler-api.service <<EOF
[Unit]
Description=Super Employee - MediaCrawler API
After=network.target

[Service]
Type=simple
WorkingDirectory=$dir
ExecStart=$dir/.venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8082
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  # WebUI 服务（生产用 build + preview）
  cat > /etc/systemd/system/se-medcrawler-webui.service <<EOF
[Unit]
Description=Super Employee - MediaCrawler WebUI
After=network.target

[Service]
Type=simple
WorkingDirectory=$dir/webui
ExecStart=/bin/bash -c 'cd $dir/webui && npx vite preview --port 5174 --host 0.0.0.0'
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  # 构建 WebUI（失败不阻塞，仍启动 preview）
  ( cd "$dir/webui" && npx vite build >/dev/null 2>&1 ) && info "WebUI 构建完成" || warn "WebUI 构建失败，将使用 dev 模式"
  systemctl daemon-reload
  systemctl enable --now se-medcrawler-api se-medcrawler-webui 2>/dev/null || true
  info "MediaCrawler 已启动"
}

# ============================================================
# 视频文案提取（7860，faster-whisper 模型较重）
# ============================================================
deploy_extractor() {
  step "部署视频文案提取（faster-whisper，端口 7860）"
  local dir="$BASE_DIR/third-party/universal-video-extractor"
  [ -f "$dir/requirements.txt" ] || { warn "缺少依赖文件，跳过"; return 1; }

  if [ ! -d "$dir/.venv" ]; then
    info "创建虚拟环境并安装依赖（faster-whisper 较大，约 3-6 分钟）..."
    python3 -m venv "$dir/.venv"
    "$dir/.venv/bin/pip" install --upgrade pip -q
    "$dir/.venv/bin/pip" install "${PIP_ARGS[@]}" -r "$dir/requirements.txt" -q || {
      warn "文案提取依赖安装失败，跳过"; return 1; }
  fi

  cat > /etc/systemd/system/se-extractor.service <<EOF
[Unit]
Description=Super Employee - Video Extractor
After=network.target

[Service]
Type=simple
WorkingDirectory=$dir
ExecStart=$dir/.venv/bin/python app.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now se-extractor 2>/dev/null || true
  info "文案提取已启动"
}

# ============================================================
# MoneyPrinterPlus 混剪发布（8501，torch 依赖很大）
# ============================================================
deploy_mpp() {
  step "部署 MoneyPrinterPlus（混剪发布，端口 8501）"
  local dir="$BASE_DIR/third-party/MoneyPrinterPlus"
  [ -f "$dir/requirements.txt" ] || { warn "缺少依赖文件，跳过"; return 1; }

  info "安装系统依赖（音频/图形库）..."
  apt-get install -y --no-install-recommends portaudio19-dev libgtk-3-dev >/dev/null 2>&1 || true

  if [ ! -d "$dir/.venv" ]; then
    info "创建虚拟环境并安装依赖（含 torch 约 2GB，可能需要 5-15 分钟）..."
    python3 -m venv "$dir/.venv"
    "$dir/.venv/bin/pip" install --upgrade pip -q
    # torch CPU 版优先（4C8G 无 GPU，避免安装数 GB 的 CUDA 依赖）
    "$dir/.venv/bin/pip" install torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu -q 2>/dev/null \
      || "$dir/.venv/bin/pip" install torch==2.3.1 "${PIP_ARGS[@]}" -q || true
    "$dir/.venv/bin/pip" install "${PIP_ARGS[@]}" -r "$dir/requirements.txt" -q || {
      warn "MPP 依赖安装失败，跳过（可稍后单独重试）"; return 1; }
  fi

  cat > /etc/systemd/system/se-mpp.service <<EOF
[Unit]
Description=Super Employee - MoneyPrinterPlus
After=network.target

[Service]
Type=simple
WorkingDirectory=$dir
ExecStart=$dir/.venv/bin/streamlit run gui.py --server.port 8501 --server.headless true --server.address 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now se-mpp 2>/dev/null || true
  info "MoneyPrinterPlus 已启动"
}

# ============================================================
main() {
  echo "============================================================"
  echo " AI超级员工 · 第三方工具部署"
  echo " 项目目录: $BASE_DIR"
  echo "============================================================"

  local ok=0
  if [ "$SKIP_CRAWLER" -eq 0 ] && ask_yes "部署 MediaCrawler 数据采集？"; then deploy_crawler && ok=1; fi
  if [ "$SKIP_UVE" -eq 0 ] && ask_yes "部署 视频文案提取？（faster-whisper 吃内存，建议 8G 内存启用）"; then deploy_extractor && ok=1; fi
  if [ "$SKIP_MPP" -eq 0 ] && ask_yes "部署 MoneyPrinterPlus 混剪？（torch 依赖约 2GB）"; then deploy_mpp && ok=1; fi

  echo ""
  echo "============================================================"
  if [ "$ok" -eq 1 ]; then
    echo " 部署完成 ✅"
    local ip; ip=$(curl -s --max-time 4 https://ifconfig.me 2>/dev/null || echo "服务器IP")
    echo "  🟢 数据采集   http://$ip:5174"
    echo "  🟢 文案提取   http://$ip:7860"
    echo "  🟢 混剪发布   http://$ip:8501"
    echo "  常用命令: systemctl status se-medcrawler-api se-extractor se-mpp"
  else
    echo " 本次未部署任何工具（已全部跳过）"
  fi
  echo "============================================================"
}

main "$@"
