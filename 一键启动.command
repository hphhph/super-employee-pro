#!/bin/bash
# 双击即可一键启动全部服务
cd "$(dirname "$0")"
echo "========================================"
echo "  AI 超级员工系统 - 一键启动"
echo "========================================"
echo ""
bash start-all.sh start
echo ""
echo "启动完成，本窗口可以关闭（服务在后台继续运行）。"
echo "关闭窗口请直接按 Cmd+W 或输入 exit 回车"
exec bash
