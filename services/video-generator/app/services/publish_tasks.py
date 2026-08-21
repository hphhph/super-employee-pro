"""发布任务中心服务（模块五 · 5.3 矩阵任务管理 / 5.7 本地发布管家）。

把“已生成成片”组织成可管理的发布任务：
  - 创建任务：选择成片视频 + 目标平台 + 标题/描述 + 立即发布或定时发布
  - 后台守护线程：到点自动调用 china_publish 发布到已配置平台
  - 状态机：pending(待发布) → publishing(发布中) → published(已发布) / failed(失败)
  - 持久化：storage/publish_tasks.json
  - 进程重启恢复：中断的 publishing 任务标记为 failed，待发布任务保留

说明：真正执行发布依赖“设置 → 国内平台发布”中配置的平台凭据；未配置平台时
任务会进入 failed 并给出可读提示，方便引导用户去完成授权。
"""

from __future__ import annotations

import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from loguru import logger

from app.services import china_publish
from app.services.china_publish import ALL_CHINA_PLATFORMS, PLATFORM_LABELS

# 任务状态
TASK_STATUS_PENDING = "pending"
TASK_STATUS_PUBLISHING = "publishing"
TASK_STATUS_PUBLISHED = "published"
TASK_STATUS_FAILED = "failed"

STATUS_LABELS = {
    TASK_STATUS_PENDING: "待发布",
    TASK_STATUS_PUBLISHING: "发布中",
    TASK_STATUS_PUBLISHED: "已发布",
    TASK_STATUS_FAILED: "失败",
}

# 调度器轮询间隔（秒）
_POLL_INTERVAL_SECONDS = 5


def format_platforms(platforms: list[str]) -> str:
    return "、".join(PLATFORM_LABELS.get(p, p) for p in (platforms or []))


@dataclass
class PublishTask:
    id: str
    video_path: str = ""
    title: str = ""
    description: str = ""
    platforms: list[str] = field(default_factory=list)
    scheduled_at: int = 0       # 0 表示立即发布
    created_at: int = 0
    status: str = TASK_STATUS_PENDING
    published_at: int = 0
    error: str = ""
    result: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "video_path": self.video_path,
            "title": self.title,
            "description": self.description,
            "platforms": list(self.platforms),
            "scheduled_at": self.scheduled_at,
            "created_at": self.created_at,
            "status": self.status,
            "published_at": self.published_at,
            "error": self.error,
            "result": self.result,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PublishTask":
        return cls(
            id=str(data.get("id", "")),
            video_path=str(data.get("video_path", "")),
            title=str(data.get("title", "")),
            description=str(data.get("description", "")),
            platforms=list(data.get("platforms", [])),
            scheduled_at=int(data.get("scheduled_at", 0) or 0),
            created_at=int(data.get("created_at", 0) or 0),
            status=str(data.get("status", TASK_STATUS_PENDING)),
            published_at=int(data.get("published_at", 0) or 0),
            error=str(data.get("error", "")),
            result=dict(data.get("result", {}) or {}),
        )


class PublishTaskService:
    """发布任务调度中心。"""

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            storage_dir = os.path.join(root_dir, "storage")
        self._storage_dir = storage_dir
        self._file_path = os.path.join(storage_dir, "publish_tasks.json")
        os.makedirs(self._storage_dir, exist_ok=True)
        self._lock = threading.RLock()
        self._tasks: list[PublishTask] = []
        self._scheduler: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._load()

    # ------------------------------------------------------------------
    # 持久化
    # ------------------------------------------------------------------

    def _load(self) -> None:
        if not os.path.exists(self._file_path):
            self._tasks = []
            return
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._tasks = [PublishTask.from_dict(item) for item in data.get("tasks", [])]
            # 进程重启恢复：上次运行中断的“发布中”任务标记为失败，避免永久悬挂。
            changed = False
            for task in self._tasks:
                if task.status == TASK_STATUS_PUBLISHING:
                    task.status = TASK_STATUS_FAILED
                    task.error = "服务重启，发布任务中断，请重新发布"
                    changed = True
            if changed:
                self._save()
            logger.info(f"loaded publish tasks: {len(self._tasks)}")
        except Exception as exc:
            logger.warning(f"failed to load publish tasks: {exc}")
            self._tasks = []

    def _save(self) -> None:
        payload = {"version": 1, "tasks": [t.to_dict() for t in self._tasks]}
        temp_path = self._file_path + ".tmp"
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, self._file_path)
        except Exception as exc:
            logger.warning(f"failed to save publish tasks: {exc}")

    # ------------------------------------------------------------------
    # 任务创建与管理
    # ------------------------------------------------------------------

    def create_task(
        self,
        video_path: str,
        platforms: list[str],
        title: str = "",
        description: str = "",
        scheduled_at: int = 0,
    ) -> PublishTask:
        """创建发布任务并启动调度线程。scheduled_at=0 表示立即发布。"""
        if not video_path or not os.path.isfile(video_path):
            raise ValueError("video file does not exist")
        valid_platforms = [p for p in (platforms or []) if p in ALL_CHINA_PLATFORMS]
        if not valid_platforms:
            raise ValueError("at least one valid publish platform is required")
        now = int(time.time())
        task = PublishTask(
            id=str(uuid.uuid4()),
            video_path=video_path,
            title=(title or "").strip()[:200],
            description=(description or "").strip()[:2000],
            platforms=valid_platforms,
            scheduled_at=max(0, int(scheduled_at or 0)),
            created_at=now,
            status=TASK_STATUS_PENDING,
        )
        with self._lock:
            self._tasks.append(task)
            self._save()
        self._ensure_scheduler()
        logger.info(
            f"created publish task: id={task.id}, platforms={valid_platforms}, "
            f"scheduled_at={task.scheduled_at or 'immediate'}"
        )
        return task

    def list_tasks(self, limit: int = 100) -> list[PublishTask]:
        with self._lock:
            tasks = sorted(self._tasks, key=lambda t: t.created_at, reverse=True)
            return tasks[:limit]

    def get_task(self, task_id: str) -> Optional[PublishTask]:
        with self._lock:
            return next((t for t in self._tasks if t.id == task_id), None)

    def delete_task(self, task_id: str) -> bool:
        with self._lock:
            task = next((t for t in self._tasks if t.id == task_id), None)
            if task is None:
                return False
            if task.status == TASK_STATUS_PUBLISHING:
                return False
            self._tasks = [t for t in self._tasks if t.id != task_id]
            self._save()
            return True

    def retry_task(self, task_id: str) -> bool:
        """将失败任务重置为待发布并立即执行。"""
        with self._lock:
            task = next((t for t in self._tasks if t.id == task_id), None)
            if task is None or task.status != TASK_STATUS_FAILED:
                return False
            task.status = TASK_STATUS_PENDING
            task.error = ""
            task.scheduled_at = 0
            task.published_at = 0
            self._save()
        self._ensure_scheduler()
        return True

    def _update_status(
        self,
        task: PublishTask,
        status: str,
        error: str = "",
        published_at: int = 0,
        result: Optional[dict] = None,
    ) -> None:
        with self._lock:
            task.status = status
            task.error = error or ""
            if published_at:
                task.published_at = published_at
            if result is not None:
                task.result = result
            self._save()

    # ------------------------------------------------------------------
    # 调度器
    # ------------------------------------------------------------------

    def _ensure_scheduler(self) -> None:
        if self._scheduler is not None and self._scheduler.is_alive():
            return
        self._stop_event.clear()
        self._scheduler = threading.Thread(
            target=self._scheduler_loop,
            name="publish-task-scheduler",
            daemon=True,
        )
        self._scheduler.start()
        logger.info("publish task scheduler started")

    def _scheduler_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._tick()
            except Exception as exc:
                logger.warning(f"publish scheduler tick failed: {exc}")
            self._stop_event.wait(_POLL_INTERVAL_SECONDS)

    def _tick(self) -> None:
        now = int(time.time())
        with self._lock:
            due_tasks = [
                t
                for t in self._tasks
                if t.status == TASK_STATUS_PENDING and t.scheduled_at <= now
            ]
        for task in due_tasks:
            self._execute_task(task)

    def _execute_task(self, task: PublishTask) -> None:
        self._update_status(task, TASK_STATUS_PUBLISHING)
        logger.info(
            f"publishing task started: id={task.id}, "
            f"platforms={task.platforms}, video={task.video_path}"
        )
        try:
            result = china_publish.upload_video(
                video_path=task.video_path,
                title=task.title,
                description=task.description,
                platforms=task.platforms,
            )
            results = result.get("results", [])
            success_count = result.get("success_count", 0)
            failed_count = result.get("failed_count", 0)
            if success_count == 0 and results:
                # 平台未配置/全部失败：进入 failed 并给出可读原因。
                reasons = []
                for item in results:
                    reasons.append(
                        f"{PLATFORM_LABELS.get(item.get('platform', ''), item.get('platform', ''))}"
                        f": {item.get('error', '未知错误')}"
                    )
                error_text = "；".join(reasons) or "发布失败，请检查平台授权配置"
                self._update_status(
                    task, TASK_STATUS_FAILED, error=error_text, result=result
                )
                logger.warning(f"publish task failed: id={task.id}, {error_text}")
                return
            self._update_status(
                task,
                TASK_STATUS_PUBLISHED,
                published_at=int(time.time()),
                result=result,
            )
            logger.success(
                f"publish task completed: id={task.id}, "
                f"success={success_count}, failed={failed_count}"
            )
        except Exception as exc:
            error_text = f"{type(exc).__name__}: {exc}"
            self._update_status(task, TASK_STATUS_FAILED, error=error_text)
            logger.exception(f"publish task crashed: id={task.id}, {exc}")


# 全局单例
publish_task_service = PublishTaskService()
