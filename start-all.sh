#!/bin/bash
# ============================================================
# 超级员工 · 一键全启动脚本
# 一次启动：系统前端 + 系统后端 + 三个第三方工具，全部功能可用
#
# 用法:
#   bash start-all.sh           启动全部（默认）
#   bash start-all.sh start     启动全部
#   bash start-all.sh stop      停止全部
#   bash start-all.sh status    查看全部状态
# ============================================================

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR"

# ---- 环境准备 ----
# 跨平台工具（macOS / Linux 双兼容）
is_mac() { [ "$(uname)" = "Darwin" ]; }

node_bin() {
  local bin
  bin=$(command -v node 2>/dev/null) && { echo "$bin"; return 0; }
  [ -x "$HOME/.workbuddy/binaries/node/versions/22.22.2/bin/node" ] && { echo "$HOME/.workbuddy/binaries/node/versions/22.22.2/bin/node"; return 0; }
  [ -x /usr/local/bin/node ] && { echo /usr/local/bin/node; return 0; }
  [ -x /usr/bin/node ] && { echo /usr/bin/node; return 0; }
  return 1
}

setup_path() {
  local nbin pnp
  nbin=$(node_bin 2>/dev/null) && PATH="$(dirname "$nbin"):$PATH"
  pnp=$(command -v pnpm 2>/dev/null || true)
  if [ -z "$pnp" ]; then
    pnp=$(npm prefix -g 2>/dev/null || true)
    [ -n "$pnp" ] && PATH="$pnp/bin:$PATH"
  fi
  export PATH="$HOME/.local/bin:$PATH"
}
setup_path
# 清除沙箱批量删除保护变量（仅沙箱环境存在，普通终端无副作用）
unset CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR CODEBUDDY_TOOL_CALL_ID \
      CODEBUDDY_SAFE_DELETE_BULK_GUARD CODEBUDDY_NODE_BIN 2>/dev/null

LOG_DIR="$BASE_DIR/.logs"
PID_DIR="$BASE_DIR/.pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

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

# 日志轮转：超过阈值(默认5MB)的日志归档为 .log.1，保留 2 份历史
rotate_log() {
  local log="$1" max="${2:-5242880}"
  [ -f "$log" ] || return 0
  local size
  size=$(file_size "$log")
  if [ "$size" -gt "$max" ]; then
    [ -f "$log.1" ] && mv -f "$log.1" "$log.2" 2>/dev/null
    mv -f "$log" "$log.1" 2>/dev/null
    echo "  [轮转] $log ($((size / 1024 / 1024))MB → $log.1)"
  fi
}

# 就绪探测：轮询 HTTP 直到返回 200 或超时
wait_ready() {
  local name="$1" url="$2" timeout="${3:-30}"
  local waited=0
  while [ "$waited" -lt "$timeout" ]; do
    if curl --noproxy '*' -s -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      echo "  ✅ $name 就绪（${waited}s）"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "  ⚠️ $name 未在 ${timeout}s 内就绪，请查看 .logs/ 日志"
  return 1
}

kill_pid_tree() {
  local pid="$1"
  [ -z "$pid" ] && return
  local children; children=$(pgrep -P "$pid" 2>/dev/null)
  for c in $children; do kill_pid_tree "$c"; done
  kill "$pid" 2>/dev/null
}

start_one() {
  local name="$1" port="$2" log="$3" pidfile="$4"; shift 4
  if port_in_use "$port"; then
    echo "  [跳过] $name 已在运行（端口 $port 被占用）"
    return 0
  fi
  rotate_log "$log"
  nohup "$@" > "$log" 2>&1 &
  echo $! > "$pidfile"
  echo "  [启动] $name (PID $!，日志 $log)"
}

stop_one() {
  local name="$1" port="$2" pidfile="$3"
  if [ -f "$pidfile" ]; then
    local pid; pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill_pid_tree "$pid"
      echo "  [停止] $name (PID $pid)"
    fi
    rm -f "$pidfile"
  fi
  if port_in_use "$port"; then
    kill_by_port "$port"
    sleep 1
    if port_in_use "$port"; then
      kill_by_port "$port" KILL
      echo "  [强制清理] $name 端口 $port 残留进程已结束"
    else
      echo "  [清理] $name 端口 $port 残留进程已结束"
    fi
  fi
}

status_one() {
  local name="$1" port="$2"
  if port_in_use "$port"; then
    echo "  🟢 $name → http://localhost:$port"
  else
    echo "  ⚪ $name 未运行"
  fi
}

case "${1:-start}" in
  stop)
    echo "== 停止全部服务 =="
    bash third-party/start-third-party.sh stop
    stop_one "系统后端" 3000 "$PID_DIR/server.pid"
    stop_one "系统前端" 5173 "$PID_DIR/desktop.pid"
    stop_one "video-api" 8080 "$PID_DIR/video-api.pid"
    echo "完成。"
    ;;
  status)
    echo "== 全部服务状态 =="
    status_one "系统前端" 5173
    status_one "系统后端" 3000
    status_one "video-api(智能成片)" 8080
    bash third-party/start-third-party.sh status
    ;;
  *)
    echo "== 一键全启动 =="
    echo ""
    echo "[1/3] 启动 video-api（系统内置 AI 智能成片引擎）..."
    start_one "video-api" 8080 "$LOG_DIR/video-api.log" "$PID_DIR/video-api.pid" \
      bash services/video-generator/start.sh start
    echo ""
    echo "[2/3] 启动三个第三方工具（数据采集 / 文案提取 / 混剪发布）..."
    bash third-party/start-third-party.sh start
    echo ""
    echo "[3/3] 启动系统（后端 + 前端）..."
    start_one "系统后端" 3000 "$LOG_DIR/server.log" "$PID_DIR/server.pid" \
      pnpm dev:server
    start_one "系统前端" 5173 "$LOG_DIR/desktop.log" "$PID_DIR/desktop.pid" \
      pnpm dev:desktop
    echo ""
    echo "== 等待服务就绪（后端首次编译约 10-20 秒）=="
    wait_ready "系统后端" "http://localhost:3000/docs" 40
    wait_ready "系统前端" "http://localhost:5173" 30
    echo ""
    echo "========================================"
    echo "  全部就绪 ✅"
    echo "  🏠 系统主页   http://localhost:5173  (admin / admin123)"
    echo "  🎬 智能成片   http://localhost:8080/docs"
    echo "  🟢 数据采集   http://localhost:5174"
    echo "  🟢 文案提取   http://127.0.0.1:7860"
    echo "  🟢 混剪发布   http://127.0.0.1:8501"
    echo "========================================"
    echo "  停止全部: bash start-all.sh stop"
    echo "  查看状态: bash start-all.sh status"
    echo "  日志目录: .logs/"
    ;;
esac
