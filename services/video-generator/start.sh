#!/usr/bin/env bash
# MoneyPrinterTurbo（video-api）本地启动脚本
# 用法: bash services/video-generator/start.sh
#       bash services/video-generator/start.sh stop   # 停止
#       bash services/video-generator/start.sh status # 查看状态
# 启动后: http://localhost:8080/docs (API 文档) / http://localhost:8080 (WebUI)
set -e
cd "$(dirname "$0")"

PORT=8080
LOG_DIR=".logs"
PID_DIR=".pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# 跨平台工具（macOS / Linux 双兼容）
is_mac() { [ "$(uname)" = "Darwin" ]; }
file_size() {
  if is_mac; then stat -f%z "$1" 2>/dev/null || echo 0
  else stat -c%s "$1" 2>/dev/null || echo 0; fi
}
port_in_use() {
  local port="$1"
  if is_mac; then lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  else ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"; fi
}
kill_by_port() {
  local port="$1" sig="${2:-TERM}"
  if is_mac; then lsof -ti tcp:"$port" 2>/dev/null | xargs kill -"$sig" 2>/dev/null
  else fuser -k -"${sig#-}" "${port}/tcp" >/dev/null 2>&1 || true; fi
}

case "${1:-start}" in
  stop)
    if [ -f "$PID_DIR/video-api.pid" ]; then
      kill "$(cat "$PID_DIR/video-api.pid")" 2>/dev/null && echo "已停止 video-api"
      rm -f "$PID_DIR/video-api.pid"
    fi
    if port_in_use "$PORT"; then
      kill_by_port "$PORT"
      sleep 1
      port_in_use "$PORT" && kill_by_port "$PORT" KILL
      echo "端口 $PORT 残留进程已清理"
    fi
    ;;
  status)
    if port_in_use "$PORT"; then
      echo "🟢 video-api 运行中 → http://localhost:$PORT/docs"
    else
      echo "⚪ video-api 未运行"
    fi
    ;;
  start)
    if port_in_use "$PORT"; then
      echo "video-api 已在运行（端口 $PORT 被占用）"
      exit 0
    fi
    if [ ! -d .venv ]; then
      echo "首次运行，正在创建虚拟环境并安装依赖（约 2-5 分钟）..."
      uv sync --no-dev
    fi
    # 日志轮转：>5MB 归档为 .log.1
    if [ -f "$LOG_DIR/video-api.log" ]; then
      size=$(file_size "$LOG_DIR/video-api.log")
      if [ "$size" -gt 5242880 ]; then
        mv -f "$LOG_DIR/video-api.log" "$LOG_DIR/video-api.log.1" 2>/dev/null || true
        echo "日志已轮转 → video-api.log.1"
      fi
    fi
    echo "启动 video-api: http://localhost:$PORT/docs"
    nohup .venv/bin/python main.py > "$LOG_DIR/video-api.log" 2>&1 &
    echo $! > "$PID_DIR/video-api.pid"
    # 就绪探测（最多 60s）
    waited=0
    while [ "$waited" -lt 60 ]; do
      if curl --noproxy '*' -s -o /dev/null --max-time 2 "http://localhost:$PORT/docs"; then
        echo "✅ video-api 就绪（${waited}s）→ http://localhost:$PORT/docs"
        exit 0
      fi
      sleep 2
      waited=$((waited + 2))
    done
    echo "⚠️ video-api 未在 60s 内就绪，请查看 $LOG_DIR/video-api.log"
    exit 1
    ;;
esac
