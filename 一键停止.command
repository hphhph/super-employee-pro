#!/bin/bash
# 双击即可一键停止全部服务
cd "$(dirname "$0")"
echo "========================================"
echo "  AI 超级员工系统 - 一键停止"
echo "========================================"
echo ""
bash start-all.sh stop
echo ""
echo "已全部停止。本窗口可以关闭。"
exec bash
