#!/bin/bash
# ============================================================
# 超级员工 · 第三方开源服务一键启停脚本
# 启动: bash start-third-party.sh
# 停止: bash start-third-party.sh stop
# 状态: bash start-third-party.sh status
# ============================================================

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"

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
PID_DIR="$BASE_DIR/.pids"
mkdir -p "$PID_DIR" "$BASE_DIR/.logs"

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
  echo "  ⚠️ $name 未在 ${timeout}s 内就绪，请查看 $BASE_DIR/.logs/ 日志"
  return 1
}

start_one() {
  local name="$1" log="$2" pidfile="$3"; shift 3
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "  [跳过] $name 已在运行 (PID $(cat "$pidfile"))"
    return 0
  fi
  rotate_log "$log"
  nohup "$@" > "$log" 2>&1 &
  echo $! > "$pidfile"
  echo "  [启动] $name (PID $!，日志 $log)"
}

stop_one() {
  local name="$1" pidfile="$2" port="$3"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    kill "$(cat "$pidfile")" 2>/dev/null
    echo "  [停止] $name (PID $(cat "$pidfile"))"
    rm -f "$pidfile"
  else
    echo "  [跳过] $name 未在运行"
  fi
  # 端口残留兜底：npm/vite 等包装进程可能留下子进程，按端口强制清理
  if [ -n "$port" ] && port_in_use "$port"; then
    kill_by_port "$port"
    sleep 1
    if port_in_use "$port"; then
      kill_by_port "$port" KILL
    fi
    echo "  [清理] $name 端口 $port 残留进程已结束"
  fi
}

status_one() {
  local name="$1" port="$2" pidfile="$3"
  if [ -f "$pidfile" ] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "  [运行中] $name → http://127.0.0.1:$port (PID $(cat "$pidfile"))"
  else
    echo "  [已停止] $name"
  fi
}

case "${1:-start}" in
  stop)
    echo "== 停止全部第三方服务 =="
    stop_one "MoneyPrinterPlus"      "$PID_DIR/mpp.pid" 8501
    stop_one "MediaCrawler-WebUI"    "$PID_DIR/mcw.pid" 5174
    stop_one "MediaCrawler-API"      "$PID_DIR/mca.pid" 8082
    stop_one "视频文案提取"           "$PID_DIR/uve.pid" 7860
    ;;
  status)
    echo "== 第三方服务状态 =="
    status_one "MediaCrawler WebUI(数据采集)" 5174 "$PID_DIR/mcw.pid"
    status_one "MediaCrawler API"             8082 "$PID_DIR/mca.pid"
    status_one "视频文案提取"                   7860 "$PID_DIR/uve.pid"
    status_one "MoneyPrinterPlus(混剪发布)"    8501 "$PID_DIR/mpp.pid"
    ;;
  *)
    echo "== 启动全部第三方服务 =="
    start_one "MediaCrawler-API" "$BASE_DIR/.logs/mca.log" "$PID_DIR/mca.pid" \
      "$BASE_DIR/MediaCrawler/.venv/bin/uvicorn" --app-dir "$BASE_DIR/MediaCrawler" api.main:app --host 0.0.0.0 --port 8082
    start_one "MediaCrawler-WebUI" "$BASE_DIR/.logs/mcw.log" "$PID_DIR/mcw.pid" \
      bash -c "cd $BASE_DIR/MediaCrawler/webui && npm run dev"
    start_one "视频文案提取" "$BASE_DIR/.logs/uve.log" "$PID_DIR/uve.pid" \
      "$BASE_DIR/universal-video-extractor/.venv/bin/python" "$BASE_DIR/universal-video-extractor/app.py"
    start_one "MoneyPrinterPlus" "$BASE_DIR/.logs/mpp.log" "$PID_DIR/mpp.pid" \
      "$BASE_DIR/MoneyPrinterPlus/.venv/bin/streamlit" run "$BASE_DIR/MoneyPrinterPlus/gui.py" --server.port 8501 --server.headless true
    echo ""
    echo "== 等待服务就绪 =="
    wait_ready "MediaCrawler-API"    "http://localhost:8082/docs" 30
    wait_ready "MediaCrawler-WebUI"  "http://localhost:5174" 30
    wait_ready "视频文案提取"         "http://localhost:7860" 60
    wait_ready "MoneyPrinterPlus"    "http://localhost:8501" 60
    echo ""
    echo "  🟢 MediaCrawler 数据采集 → http://localhost:5174"
    echo "  🟢 视频文案提取        → http://127.0.0.1:7860"
    echo "  🟢 MoneyPrinterPlus    → http://127.0.0.1:8501"
    echo ""
    echo "提示：日志在 third-party/.logs/ 下，停止用 bash start-third-party.sh stop"
    ;;
esac
