#!/bin/bash
set -e

echo "========================================"
echo "  AI 超级员工系统 - 一键启动"
echo "========================================"
echo ""

# ---- 检查 Node.js ----
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js 20 LTS"
    echo "下载地址：https://nodejs.org/"
    exit 1
fi
echo "[OK] Node.js $(node --version)"

# ---- 检查 pnpm ----
if ! command -v pnpm &> /dev/null; then
    echo "[提示] 正在安装 pnpm..."
    npm install -g pnpm@8
fi
echo "[OK] pnpm"

# ---- 检查 .env ----
if [ ! -f ".env" ]; then
    echo "[提示] 从模板创建 .env"
    cp .env.example .env
fi

# ---- 检查 MySQL ----
if ! command -v mysql &> /dev/null; then
    echo "[警告] 未检测到 mysql 命令，请确保 MySQL 已安装并运行在 localhost:3306"
    echo "如果使用 Docker：docker-compose up -d mysql"
    read -p "MySQL 已就绪？(y/N) " yn
    [ "$yn" != "y" ] && exit 1
else
    echo "[OK] MySQL 命令可用"
fi

# ---- 安装依赖 ----
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[步骤] 安装项目依赖（首次需要几分钟）..."
    export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
    pnpm install
fi

# ---- 数据库初始化 ----
cd packages/server
if [ ! -f ".prisma/client/index.js" ]; then
    echo ""
    echo "[步骤] 生成 Prisma Client..."
    npx prisma generate
fi
echo ""
echo "[步骤] 同步数据库表结构..."
npx prisma db push --accept-data-loss
echo ""
echo "[步骤] 写入种子数据..."
npx ts-node prisma/seed.ts
cd ../..

# ---- 启动服务 ----
echo ""
echo "========================================"
echo "  系统启动中..."
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:3000"
echo "  API 文档: http://localhost:3000/docs"
echo "  账号: admin / admin123"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

pnpm dev
