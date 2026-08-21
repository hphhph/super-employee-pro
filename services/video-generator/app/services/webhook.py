"""
Webhook callback notification service.

Sends HTTP POST requests to a configured URL after task completion or failure,
enabling integration with external systems (Slack, Discord, n8n, Zapier, etc.).

Webhook configuration sources (in priority order):
1. Per-task params.webhook_url (highest priority)
2. Global config app.webhook_url

Event types:
- "complete": triggered when task finishes successfully
- "failed": triggered when task fails
- "pending": triggered when task starts processing
"""
import json
import threading
from typing import Any, Optional

import requests
from loguru import logger

from app.config import config


# Webhook 通知在独立线程中执行，避免阻塞任务状态更新。
# 使用共享线程池而非每次创建新线程，限制并发避免突发大量通知。
_webhook_lock = threading.Lock()


def _get_webhook_config(params=None) -> tuple[str, str]:
    """读取 webhook URL 和事件类型配置。

    优先使用任务参数中的 webhook_url，其次使用全局配置。
    """
    # 任务级配置优先
    task_url = ""
    task_events = "complete,failed"
    if params is not None:
        task_url = str(getattr(params, "webhook_url", "") or "").strip()
        task_events = str(
            getattr(params, "webhook_events", "complete,failed") or "complete,failed"
        ).strip()

    # 全局配置兜底
    global_url = str(config.app.get("webhook_url", "") or "").strip()
    global_events = str(
        config.app.get("webhook_events", "complete,failed") or "complete,failed"
    ).strip()

    url = task_url or global_url
    events = task_events if task_url else global_events
    return url, events


def _should_notify(event: str, events_config: str) -> bool:
    """判断指定事件是否在配置的通知事件列表中。"""
    if not events_config:
        return False
    event_list = [e.strip().lower() for e in events_config.split(",") if e.strip()]
    return event in event_list


def _build_payload(
    task_id: str,
    event: str,
    task_data: dict[str, Any],
) -> dict[str, Any]:
    """构建 webhook 回调的 JSON 载荷。"""
    return {
        "event": event,
        "task_id": task_id,
        "timestamp": _get_iso_timestamp(),
        "data": {
            "state": task_data.get("state"),
            "progress": task_data.get("progress", 0),
            "videos": task_data.get("videos"),
            "failed_stage": task_data.get("failed_stage"),
            "error": task_data.get("error"),
            "cross_post_state": task_data.get("cross_post_state"),
            "china_cross_post_state": task_data.get("china_cross_post_state"),
        },
    }


def _get_iso_timestamp() -> str:
    """获取当前时间的 ISO 8601 字符串。"""
    from datetime import datetime, timezone, timedelta

    # 使用东八区时间，与项目默认时区一致
    tz = timezone(timedelta(hours=8))
    return datetime.now(tz).isoformat()


def _send_webhook(url: str, payload: dict, timeout: int = 15) -> bool:
    """实际发送 HTTP POST 请求。"""
    try:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "MoneyPrinterTurbo-Webhook/1.0",
        }
        resp = requests.post(
            url,
            data=json.dumps(payload, ensure_ascii=False),
            headers=headers,
            timeout=timeout,
        )
        if resp.status_code < 300:
            logger.info(
                f"webhook notified successfully, url: {url}, "
                f"status: {resp.status_code}, event: {payload.get('event')}"
            )
            return True
        else:
            logger.warning(
                f"webhook returned non-success status, url: {url}, "
                f"status: {resp.status_code}, event: {payload.get('event')}"
            )
            return False
    except Exception as exc:
        logger.warning(
            f"webhook notification failed, url: {url}, "
            f"event: {payload.get('event')}, error: {exc}"
        )
        return False


def notify(
    task_id: str,
    event: str,
    task_data: dict[str, Any],
    params=None,
) -> None:
    """
    异步发送 webhook 通知。

    如果没有配置 webhook URL 或事件不在通知列表中，则静默跳过。
    通知失败不会影响任务本身的执行。
    """
    url, events_config = _get_webhook_config(params)
    if not url:
        return

    if not _should_notify(event, events_config):
        return

    payload = _build_payload(task_id, event, task_data)

    # 在独立线程中发送，避免阻塞任务流程
    thread = threading.Thread(
        target=_send_webhook,
        args=(url, payload),
        daemon=True,
        name=f"mpt-webhook-{task_id[:8]}",
    )
    with _webhook_lock:
        thread.start()
