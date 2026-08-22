#!/bin/bash
# AI 超级员工系统 - 全链路启动脚本
set -e

export PATH="$HOME/.local/bin:$PATH"
PROJECT_ROOT="/workspace/projects"
SERVER_DIR="$PROJECT_ROOT/packages/server"
DESKTOP_DIR="$PROJECT_ROOT/packages/desktop"

export DATABASE_URL="mysql://root:SuperEmployee@2026@localhost:3306/super_employee"
export REDIS_URL="redis://:SuperEmployee@2026@localhost:6379"
export JWT_SECRET="45170978f72df45b8ff1b1cafd2d4ae3bb441ca8cb7f8ef2681bd43d75964b15"

echo "[1/7] 检查并安装 MySQL..."
if ! command -v mysql &> /dev/null; then
  echo "  MySQL 未安装，正在安装..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq mysql-server > /dev/null 2>&1
  echo "  MySQL 安装完成"
else
  echo "  MySQL 已安装"
fi

echo "[2/7] 启动 MySQL..."
if ! pgrep -x mysqld > /dev/null; then
  service mysql start > /dev/null 2>&1 || mysqld_safe --skip-grant-tables=0 > /dev/null 2>&1 &
  sleep 3
  # 设置 root 密码（仅首次）
  mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'SuperEmployee@2026';" 2>/dev/null || true
  echo "  MySQL 启动完成"
else
  echo "  MySQL 已在运行"
fi

# 创建数据库
mysql -u root -pSuperEmployee@2026 -e "CREATE DATABASE IF NOT EXISTS super_employee CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || true

echo "[3/7] 检查并安装 Redis..."
if ! command -v redis-server &> /dev/null; then
  echo "  Redis 未安装，正在安装..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq redis-server > /dev/null 2>&1
  echo "  Redis 安装完成"
else
  echo "  Redis 已安装"
fi

echo "[4/7] 启动 Redis..."
if ! pgrep -x redis-server > /dev/null; then
  redis-server --daemonize yes > /dev/null 2>&1
  sleep 1
  redis-cli CONFIG SET requirepass 'SuperEmployee@2026' > /dev/null 2>&1 || true
  echo "  Redis 启动完成"
else
  echo "  Redis 已在运行"
fi

echo "[5/7] 初始化数据库表结构..."
cd "$SERVER_DIR"
TABLE_COUNT=$(mysql -u root -pSuperEmployee@2026 -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='super_employee';" 2>/dev/null | tail -1 || echo "0")
if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
  echo "  首次初始化，执行 prisma db push + seed..."
  ./node_modules/.bin/prisma db push --skip-generate 2>/dev/null || true
  ./node_modules/.bin/ts-node prisma/seed.ts 2>/dev/null || true
else
  echo "  数据库已初始化（$TABLE_COUNT 张表），跳过"
fi

echo "[6/7] 启动后端服务 (3000)..."
pkill -f "node dist/main" 2>/dev/null || true
sleep 1
nohup node dist/main >> /app/work/logs/bypass//api.log 2>&1 &

echo "[7/7] 启动前端服务 (${DEPLOY_RUN_PORT:-5000})..."
pkill -f "node serve.js" 2>/dev/null || true
sleep 1
cd "$PROJECT_ROOT"
nohup node serve.js >> /app/work/logs/bypass//serve.log 2>&1 &

echo ""
echo "========================================"
echo "  全部启动完成"
echo "========================================"
sleep 3
echo "后端: http://localhost:3000"
echo "前端: http://localhost:${DEPLOY_RUN_PORT:-5000}"
echo ""
echo "登录账号："
echo "  管理员: admin / admin123"
echo "  演示账号: demo / 123456"
echo "========================================"