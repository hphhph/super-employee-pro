#!/usr/bin/env bash
# ============================================================
# AI超级员工 · 服务器部署包打包脚本
#
# 用法:
#   bash deploy/package.sh                 # 打包到项目上级目录
#   bash deploy/package.sh /path/to/out    # 指定输出目录
#
# 产物: <项目名>-server-<日期>.tar.gz（解压后为 <项目名>/ 目录）
#
# 打包内容: 纯源码 + 配置 + 中文字体资源 + 部署脚本
# 排除内容: node_modules / .venv / .git / 视频缓存 / 日志 / 本地数据库
#           （这些在服务器上由 deploy.sh 重新安装或自动重建）
# ============================================================
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJ_NAME="$(basename "$BASE_DIR")"
OUT_DIR="${1:-$(dirname "$BASE_DIR")}"
DATE=$(date +%Y%m%d)
ARCHIVE="$OUT_DIR/$PROJ_NAME-server-$DATE.tar.gz"

# 打包时以项目目录名为前缀，解压后自动形成 <项目名>/ 目录
cd "$(dirname "$BASE_DIR")"

echo "============================================================"
echo " AI超级员工 · 服务器部署包"
echo " 项目目录: $BASE_DIR"
echo " 输出:     $ARCHIVE"
echo "============================================================"

# 排除清单（服务器上会重新安装或自动重建，不打进包）
EXCLUDES=(
  --exclude='*/node_modules'
  --exclude='*/.venv'
  --exclude='*/venv'
  --exclude='*/.git'
  --exclude='*/__pycache__'
  --exclude='*.pyc'
  --exclude='.DS_Store'
  --exclude='Thumbs.db'
  --exclude='*.log'
  --exclude='.logs'
  --exclude='.pids'
  --exclude="$PROJ_NAME/mysql"
  --exclude="$PROJ_NAME/services/video-generator/storage"
  --exclude="$PROJ_NAME-server-*.tar.gz"
)

echo ""
echo "[1/3] 估算打包体积（排除后）..."
du -sh "$PROJ_NAME" 2>/dev/null

echo ""
echo "[2/3] 压缩打包中（预计 1-3 分钟）..."
tar -czf "$ARCHIVE" "${EXCLUDES[@]}" "$PROJ_NAME"

echo ""
echo "[3/3] 打包完成 ✅"
ls -lh "$ARCHIVE"

echo ""
echo "============================================================"
echo " 服务器上使用:"
echo "  1. 上传:  scp $ARCHIVE root@服务器IP:/root/"
echo "  2. 解压:  cd /root && tar -xzf $(basename "$ARCHIVE")"
echo "  3. 部署:  cd $PROJ_NAME && sudo bash deploy/deploy.sh"
echo "  4. (可选) 第三方工具: sudo bash deploy/deploy-extra.sh --skip-mpp"
echo "============================================================"
