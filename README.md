# AI超级员工系统（重新开发版）

基于对原版客户端的源码级逆向分析，重新开发的 AI 员工系统。
分析产物（菜单树、UI元素、API清单）见 `../` 目录下的 `menu_tree.json`、`page_ui_elements.json`、`extracted_apis_routes.json`。

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面客户端 | Electron 28 + Vue 3 + Vite 5 + Element Plus |
| 后端 | NestJS 10 + Prisma 5 + TypeScript |
| 数据库 | MySQL 8.0 |
| 缓存/队列 | Redis 7 + BullMQ |
| 对象存储 | MinIO (S3 兼容) |
| AI | DeepSeek (对话) / Coze (智能体) / Sora2 / Veo / Seedance / 阿里TTS |
| 短视频生成 | MoneyPrinterTurbo (Python/FastAPI，AI脚本+素材匹配+字幕配音合成) |
| 部署 | Docker Compose / Linux 一键部署（见 DEPLOY.md 方式一） |

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 复制环境变量模板（API Key 留空也能启动，对应功能不可用）
cp .env.example .env

# 3. 启动基础设施 (MySQL + Redis + MinIO + 视频生成服务)
docker-compose up -d mysql redis minio video-api

# 4. 初始化数据库
pnpm db:push
pnpm db:seed

# 5. 启动后端 (localhost:3000)
pnpm dev:server

# 6. 启动前端 (localhost:5173)
pnpm dev:desktop
```

**默认账号：** admin / admin123 （管理员）、demo / 123456（普通用户）

## API Key 配置

系统内置 14 个平台的密钥配置中心（系统设置 → API密钥配置）：

**AI 模型：** DeepSeek、Coze、OpenAI Sora2、Google Veo、字节 Seedance、阿里TTS、通义千问
**社交平台：** 企业微信、抖音、小红书、快手、视频号、Boss直聘、智联招聘

申请到 Key 后在界面填入并点「验证」即可，无需改代码、无需重启。

### Key 统一管理（页面优先）

**所有用到 API Key 的服务均以「系统设置 → API密钥配置」页面为唯一权威源：**

| 服务 | key 来源 | 页面改 key 后生效 |
|------|----------|------------------|
| 系统 AI 对话（ai-chat） | 页面配置 > .env | 立即生效 |
| video-api 文案生成（config.toml） | 页面配置 > config.toml 兜底 | ≤ 60 秒 |
| MoneyPrinterPlus 智能文案（config.yml） | 页面配置 > config.yml 兜底 | ≤ 60 秒 |

- 后端通过内部接口 `GET /api/internal/runtime-keys` 下发已配置 key（**仅本机回环可访问**，外部一律 403）
- video-api / MoneyPrinterPlus 每次调用前拉取一次（60 秒缓存），**改 key 无需重启、无需手工改配置文件**
- 后端不在线时自动回退本地配置文件，保证链路不中断
- 换 key 只需在页面改一次，三处同步生效

## 项目结构

```
super-employee-pro/
├── docker-compose.yml        # 基础设施
├── .env.example              # 全部 API Key 模板
├── services/
│   └── video-generator/      # MoneyPrinterTurbo（AI短视频生成引擎，独立 FastAPI 服务）
│       ├── config.toml       # 运行时配置（含素材库/LLM API Key，已 gitignore）
│       └── main.py           # API 模式入口，监听 :8080
├── packages/
│   ├── server/               # NestJS 后端
│   │   ├── prisma/schema.prisma   # 45张表
│   │   └── src/modules/
│   │       ├── auth/         # 认证 JWT RBAC
│   │       ├── config/       # API Key 配置中心
│   │       ├── users/        # 员工管理
│   │       ├── departments/  # 部门管理
│   │       ├── dashboard/    # 工作台
│   │       ├── wecom/        # 企微SCRM
│   │       ├── ai-chat/      # AI对话(DeepSeek)
│   │       ├── video/        # AI视频创作（代理 video-generator）
│   │       ├── knowledge/    # 知识库/智能体
│   │       └── compute/      # 算力管理
│   └── desktop/              # Electron 客户端
│       ├── electron/         # 主进程
│       └── src/
│           ├── router/       # 路由(还原原系统菜单树)
│           ├── api/          # API 客户端
│           └── views/        # 页面
```

## MVP 范围（当前）

1. ✅ 登录认证 + RBAC 权限
2. ✅ 工作台数据总览
3. ✅ AI 对话（DeepSeek）
4. ✅ AI 视频创作（MoneyPrinterTurbo：主题→脚本→素材→配音字幕→成片）
5. ✅ 企微 SCRM（客户/标签/关键词/群发）
6. ✅ 企业智库（智能体/知识库）
7. ✅ 算力管理
8. ✅ API Key 配置中心（14平台）

## AI 视频创作说明

短视频能力由内置的 [MoneyPrinterTurbo](services/video-generator/) 提供（独立 FastAPI 服务，API 模式运行在 :8080）：

- 后端 `video` 模块代理其全部接口（脚本生成 / 关键词 / 任务创建 / 任务查询 / 视频下载），并计入算力消耗
- 前端「AI视频」页面：输入主题 → AI 生成脚本（可手改）→ 选比例/音色/BGM → 生成 → 预览 & 下载
- 素材库、LLM、TTS 等密钥在 `services/video-generator/config.toml` 中配置（首次从 `config.example.toml` 复制，已加入 .gitignore）
- 接口文档：video-api 启动后访问 http://localhost:8080/docs

### video-api 本地启动（无需 Docker）

本机无 Docker 时可用 uv 直接跑：

```bash
bash services/video-generator/start.sh   # 首次自动装依赖（需 uv），之后 http://localhost:8080
```

首次使用前需在 `services/video-generator/config.toml` 确认：

- `llm_provider` 与对应 `*_api_key`（如 deepseek_api_key，需余额充足）
- `video_source` 对应的素材 API Key（pexels / pixabay，注册免费）

## 第三方开源工具整合

系统整合了三个本地开源工具，作为「AI 视频」页的智能获客 / 一键追爆 / 智能混剪能力。全部通过根目录 `start-all.sh` 一键启停：

| 工具 | 功能 | 地址 | 端口 |
|------|------|------|------|
| MediaCrawler | 小红书/抖音/B站等 7 平台数据采集 | http://localhost:5174 | WebUI 5174 / API 8082 |
| universal-video-extractor | 视频链接 → 下载 → 文案/字幕提取 | http://127.0.0.1:7860 | 7860 |
| MoneyPrinterPlus | 文案 → 配音 → 混剪出片 → 多平台发布 | http://127.0.0.1:8501 | 8501 |

```bash
bash start-all.sh          # 一键启动全部（含系统前后端 + video-api + 三个工具）
bash start-all.sh status   # 查看状态
bash start-all.sh stop     # 停止全部
```

### MediaCrawler 登录态配置（采集前必读）

采集依赖各平台登录态，两种方式任选：

1. **CDP 模式（推荐，复用本机 Chrome 登录态）**：安装 Chrome，地址栏打开 `chrome://inspect/#remote-debugging` 并勾选「Allow remote debugging for this browser instance」，确认显示 `Server running at: 127.0.0.1:9222`。之后采集会连接你的 Chrome，复用已登录的平台账号。
2. **扫码模式**：修改 `third-party/MediaCrawler/config/base_config.py` 中 `ENABLE_CDP_MODE = False`，在采集界面选择对应平台扫码登录，登录态缓存在 `browser_data/` 目录。

> ⚠️ 在系统内嵌的 iframe 中登录可能受浏览器第三方 Cookie 限制，若扫码/登录异常，请点击工具条「新窗口打开」在独立窗口完成登录。

### ⚠️ 许可证合规（商用前必读）

三个工具均为第三方开源项目，**整合进收费的商户版产品前需获得作者授权**：

- **MediaCrawler**：NCAL 1.1 非商业学习许可，商用须作者书面同意（作者微信 relakkes / relakkes@gmail.com，官方有付费 Pro 版）
- **MoneyPrinterPlus**：GPL-3.0 + 作者附加条款「商业使用须明确授权」（ddean2009，www.flydean.com）
- **universal-video-extractor**：README 标 MIT 但未附 LICENSE 文件，且项目过新，商用有风险

当前本机部署用于个人使用/功能验证不受影响；若用于商业产品，建议联系作者购买授权，或参考其架构自研（发布引擎/数据采集可用 Selenium 模拟点击 + CDP 反检测自研）。

## 后续迭代

- AI创作（数字人/Sora2 直连）
- AI个微（个人微信自动化）
- AI人事（Boss直聘）
- AI法务（合同审查）
- AI拓客（地图获客）
- 激活码/多租户
