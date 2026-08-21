# AI 超级员工系统 · 部署指南

| 组件 | 技术栈 | 端口 |
|------|--------|------|
| 前端 | Vue 3 + Vite 5 + Element Plus | 80（nginx 托管 dist） |
| 后端 | NestJS 10 + Prisma 5 + TypeScript | 3000 |
| 智能成片 | video-api（MoneyPrinterTurbo/FastAPI） | 8080 |
| 数据采集 | MediaCrawler | 8082 / 5174 |
| 文案提取 | universal-video-extractor | 7860 |
| 混剪发布 | MoneyPrinterPlus | 8501 |
| 数据库 | MySQL 8.x | 3306（仅内网） |
| 缓存 | Redis 7 | 6379（仅内网） |

> **推荐部署路线**：Linux 服务器（Ubuntu/Debian 4C8G）→ 一条命令部署核心系统，nginx 统一 80 入口 + systemd 守护。第三方工具（爬虫/文案提取/混剪）较重，按需启用。

---

## 方式一：Linux 服务器一键部署（推荐）

### 前置条件

- Ubuntu 20.04 / 22.04 / 24.04 或 Debian 11/12
- **root 权限**，公网 IP，安全组/防火墙放行 `80`（和 `22` SSH）
- 建议 4C8G 起；只用核心系统 4C8G 足够，加装全部第三方工具建议 8C16G

### 部署步骤

```bash
# 1. 将项目上传到服务器（scp / git / 宝塔面板均可）
#    注意：必须包含 deploy/ 目录、.env.example、packages/、services/、third-party/

# 2. 进入项目根目录，执行一键部署（核心系统 + 智能成片）
sudo bash deploy/deploy.sh

# 3. （可选）加装第三方工具：爬虫 / 文案提取 / 混剪
sudo bash deploy/deploy-extra.sh            # 全部安装
sudo bash deploy/deploy-extra.sh --skip-mpp # 跳过 MoneyPrinterPlus（torch 依赖 2GB+，4C8G 建议跳过）
```

### 参数说明

**deploy.sh**（核心部署）：

| 参数 | 说明 |
|------|------|
| `--full` | 核心 + 第三方工具一起装（等价于随后跑 deploy-extra.sh） |
| `--no-mirror` | 不用国内镜像源（服务器在海外时使用） |
| `--domain=a.com --email=you@a.com` | 预留 HTTPS 证书参数（当前版本先走 80，后续扩展） |

**deploy-extra.sh**（第三方工具）：

| 参数 | 说明 |
|------|------|
| `--skip-crawler` | 跳过 MediaCrawler 数据采集 |
| `--skip-uve` | 跳过视频文案提取（faster-whisper 吃内存） |
| `--skip-mpp` | 跳过 MoneyPrinterPlus 混剪发布（torch 依赖大） |
| `--no-mirror` | 不用国内 pip 镜像源 |
| `--no-ask` | 非交互模式（deploy.sh --full 内部调用） |

### 部署脚本自动做了什么

1. 安装系统依赖：`ffmpeg / nginx / MySQL 8 / Redis 7 / Python3 / Node.js 20 / pnpm`
2. 生成 `.env`：随机 JWT 密钥、随机数据库密码、公网 IP 自动探测、API 地址改为同源 `/api`（规避 CORS）
   - 已有 `.env` 时**保留你的 API Key**，仅修正部署参数
3. 初始化 MySQL：建库 `super_employee`、建表、写入种子数据（admin / admin123）
4. 构建并启动后端（NestJS）→ systemd 服务 `se-server`
5. 构建前端 → dist 由 nginx 托管
6. 部署 video-api 智能成片 → systemd 服务 `se-video-api`
7. nginx 统一 80 入口，反向代理各服务 + gzip 压缩
8. 健康检查并输出访问地址

### 部署后访问

```
系统主页   http://服务器IP        （admin / admin123，首次登录请改密码）
智能成片   http://服务器IP:8080/docs
数据采集   http://服务器IP:5174    （装第三方工具后）
文案提取   http://服务器IP:7860    （装第三方工具后）
混剪发布   http://服务器IP:8501    （装第三方工具后）
```

### 常用运维命令

```bash
# 服务状态
systemctl list-units 'se-*'            # 查看全部 systemd 服务
systemctl status se-server             # 后端状态
systemctl status se-video-api          # 智能成片状态

# 日志
journalctl -u se-server -n 100 -f      # 跟踪后端日志
journalctl -u se-video-api -n 100      # video-api 日志

# 重启 / 停止
systemctl restart se-server
systemctl stop se-server

# 服务器重启后全部自动拉起（systemd 开机自启）
reboot
```

### 服务清单（systemd）

| 服务名 | 对应组件 | 说明 |
|--------|----------|------|
| `se-server` | 后端 NestJS | 端口 3000 |
| `se-video-api` | 智能成片 | 端口 8080 |
| `mysql` / `redis-server` / `nginx` | 基础组件 | 系统包自带 |

---

## 方式二：第三方工具单独部署（按需）

```bash
# 只装数据采集（MediaCrawler）
sudo bash deploy/deploy-extra.sh --skip-uve --skip-mpp

# 只装文案提取
sudo bash deploy/deploy-extra.sh --skip-crawler --skip-mpp

# 只装混剪发布（MoneyPrinterPlus，依赖最重）
sudo bash deploy/deploy-extra.sh --skip-crawler --skip-uve
```

> **内存提醒**：文案提取（faster-whisper）和混剪（torch）单装一个就占 2-4G 内存，4C8G 不建议全部开启。

---

## 方式三：本地开发（macOS / Windows / Linux）

```bash
# 1. 安装依赖
pnpm install

# 2. 准备环境变量
cp .env.example .env
# 编辑 .env：JWT_SECRET、MYSQL_ROOT_PASSWORD、DATABASE_URL 必须修改

# 3. 启动 MySQL / Redis（本机已安装时）
# macOS: brew services start mysql redis

# 4. 初始化数据库
cd packages/server
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts
cd ../..

# 5. 一键启动全部服务（前端 5173 / 后端 3000 / video-api 8080 / 第三方工具）
bash start-all.sh

# 6. 访问 http://localhost:5173  （admin / admin123）
```

> `start-all.sh` 已兼容 macOS/Linux 双平台。Windows 请用 WSL 或手动逐个启动。

---

## 常见问题（FAQ）

### Q: 部署脚本报"仅支持 Ubuntu/Debian"？

服务器是 CentOS/RHEL 或其他发行版时，一键脚本不支持。改用 Docker 路线或手动部署。

### Q: pnpm install 报错网络超时？

脚本默认启用 npmmirror 镜像。手动部署时：
```bash
pnpm config set registry https://registry.npmmirror.com/
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
pnpm install
```

### Q: Prisma generate 报错？

确保 `DATABASE_URL` 中的密码 `@` 已编码为 `%40`：
```
# 错误写法
DATABASE_URL="mysql://root:Pass@word@localhost:3306/db"
# 正确写法
DATABASE_URL="mysql://root:Pass%40word@localhost:3306/db"
```

### Q: 前端能打开但登录返回 500？

检查后端是否连接到数据库：
```bash
curl http://localhost:3000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```
返回 500 时，确认 MySQL 正在运行且种子数据已写入（`systemctl status mysql` / `journalctl -u se-server -n 50`）。

### Q: 服务器重启后服务没起来？

确认 systemd 服务已 enable：
```bash
systemctl enable --now se-server se-video-api nginx mysql redis-server
```

### Q: 更换服务器 IP 后前端连不上？

重新跑一遍 `sudo bash deploy/deploy.sh` 即可——脚本会检测新 IP 并自动修正 `.env` 中 WS 地址，重新构建前端。

### Q: 如何打包 Electron 桌面客户端？

```bash
cd packages/desktop
pnpm build:electron
# 产物在 packages/desktop/dist/ 下
```

---

## API Key 配置说明

系统内所有 API Key **统一在页面配置**：`系统设置 → API密钥配置`（admin 登录后可见）。保存后立即生效，video-api / MoneyPrinterPlus 最长 60 秒同步（本地缓存 TTL）。

`.env` 中预留的 Key 仅作兜底（后端不在线时使用），页面配置优先：

| 平台 | 用途 | 申请地址 |
|------|------|----------|
| DeepSeek | AI 对话核心 | https://platform.deepseek.com/ |
| Coze 扣子 | 智能体 | https://www.coze.cn/ |
| OpenAI | 文生视频 (Sora) | https://platform.openai.com/ |
| Google Veo | 视频生成 | https://cloud.google.com/vertex-ai |
| 字节 Seedance | 视频生成 | 火山引擎 |
| 阿里云 TTS | 语音合成 | https://dashscope.aliyun.com/ |
| 通义千问 | 备用 AI | https://dashscope.aliyun.com/ |
| 企业微信 | 社交运营 | https://work.weixin.qq.com/ |
| 抖音 | 社交运营 | https://developer.open-douyin.com/ |
| 小红书 | 社交运营 | https://open.xiaohongshu.com/ |
| 快手 | 社交运营 | https://open.kuaishou.com/ |
| 视频号 | 社交运营 | https://channels.weixin.qq.com/ |

所有 Key 不填的功能会自动跳过，不影响系统运行。
