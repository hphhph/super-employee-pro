"""Data center / analytics service for 商家宝.

Aggregates social-media metrics (followers, plays, comments, likes, shares,
profile visits) per platform per day. Data is persisted in a local JSON file
under ``storage/analytics.json``. When real platform APIs are connected, the
``record_*`` methods can be used to feed actual numbers; until then the dashboard
shows demo data and any manually recorded entries.
"""

from __future__ import annotations

import csv
import io
import json
import os
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Any, Optional

from loguru import logger


@dataclass
class DailyMetrics:
    date: str  # YYYY-MM-DD
    platform: str  # douyin / kuaishou / wechat_channels / xiaohongshu / total
    followers: int = 0
    plays: int = 0
    comments: int = 0
    likes: int = 0
    shares: int = 0
    profile_visits: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "DailyMetrics":
        return cls(
            date=str(data.get("date", "")),
            platform=str(data.get("platform", "")),
            followers=int(data.get("followers", 0) or 0),
            plays=int(data.get("plays", 0) or 0),
            comments=int(data.get("comments", 0) or 0),
            likes=int(data.get("likes", 0) or 0),
            shares=int(data.get("shares", 0) or 0),
            profile_visits=int(data.get("profile_visits", 0) or 0),
        )


class AnalyticsService:
    """Store, aggregate and export platform analytics data."""

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            root_dir = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            )
            storage_dir = os.path.join(root_dir, "storage")
        self._storage_dir = storage_dir
        os.makedirs(self._storage_dir, exist_ok=True)
        self._file_path = os.path.join(self._storage_dir, "analytics.json")
        self._records: list[DailyMetrics] = []
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._file_path):
            self._records = []
            self._ensure_demo_data()
            return
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._records = [
                DailyMetrics.from_dict(raw) for raw in data.get("records", [])
            ]
        except Exception as exc:
            logger.warning(f"failed to load analytics: {exc}; starting fresh")
            self._records = []
        if not self._records:
            self._ensure_demo_data()

    def _save(self) -> None:
        try:
            payload = {
                "records": [record.to_dict() for record in self._records],
                "updated_at": int(time.time()),
            }
            tmp_path = self._file_path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, self._file_path)
        except Exception as exc:
            logger.error(f"failed to save analytics: {exc}")

    def _ensure_demo_data(self) -> None:
        """Seed the last 7 days with zero metrics so the dashboard is visible."""
        today = date.today()
        platforms = ["douyin", "kuaishou", "wechat_channels", "xiaohongshu"]
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            for platform in platforms:
                self._records.append(
                    DailyMetrics(
                        date=day.isoformat(),
                        platform=platform,
                    )
                )
        self._save()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def record(
        self,
        metrics_date: str,
        platform: str,
        followers: int = 0,
        plays: int = 0,
        comments: int = 0,
        likes: int = 0,
        shares: int = 0,
        profile_visits: int = 0,
    ) -> DailyMetrics:
        """Record or overwrite metrics for a single platform/day."""
        metrics_date = str(metrics_date)
        platform = str(platform)
        existing = next(
            (
                r
                for r in self._records
                if r.date == metrics_date and r.platform == platform
            ),
            None,
        )
        if existing:
            existing.followers = int(followers)
            existing.plays = int(plays)
            existing.comments = int(comments)
            existing.likes = int(likes)
            existing.shares = int(shares)
            existing.profile_visits = int(profile_visits)
            metric = existing
        else:
            metric = DailyMetrics(
                date=metrics_date,
                platform=platform,
                followers=int(followers),
                plays=int(plays),
                comments=int(comments),
                likes=int(likes),
                shares=int(shares),
                profile_visits=int(profile_visits),
            )
            self._records.append(metric)
        self._save()
        return metric

    def query(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> list[DailyMetrics]:
        """Return matching records sorted by date ascending."""
        start = start_date or "1970-01-01"
        end = end_date or "2099-12-31"
        results = [
            r
            for r in self._records
            if start <= r.date <= end
            and (not platform or r.platform == platform)
        ]
        return sorted(results, key=lambda r: (r.date, r.platform))

    def aggregate(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> DailyMetrics:
        """Sum all matching records into a single metrics object."""
        records = self.query(start_date, end_date, platform)
        total = DailyMetrics(date="", platform=platform or "total")
        for r in records:
            total.followers = max(total.followers, r.followers)
            total.plays += r.plays
            total.comments += r.comments
            total.likes += r.likes
            total.shares += r.shares
            total.profile_visits += r.profile_visits
        return total

    def yesterday_delta(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> dict[str, int]:
        """Return yesterday's deltas for each metric vs. the day before."""
        records = self.query(start_date, end_date, platform)
        if not records:
            return {}
        latest_date = max(r.date for r in records)
        try:
            latest_dt = datetime.strptime(latest_date, "%Y-%m-%d").date()
            previous_dt = latest_dt - timedelta(days=1)
            previous_date = previous_dt.isoformat()
        except ValueError:
            previous_date = ""

        latest = DailyMetrics(date=latest_date, platform="latest")
        previous = DailyMetrics(date=previous_date, platform="previous")
        for r in records:
            if r.date == latest_date:
                latest.followers = max(latest.followers, r.followers)
                latest.plays += r.plays
                latest.comments += r.comments
                latest.likes += r.likes
                latest.shares += r.shares
                latest.profile_visits += r.profile_visits
            elif r.date == previous_date:
                previous.followers = max(previous.followers, r.followers)
                previous.plays += r.plays
                previous.comments += r.comments
                previous.likes += r.likes
                previous.shares += r.shares
                previous.profile_visits += r.profile_visits

        return {
            "followers": latest.followers - previous.followers,
            "plays": latest.plays - previous.plays,
            "comments": latest.comments - previous.comments,
            "likes": latest.likes - previous.likes,
            "shares": latest.shares - previous.shares,
            "profile_visits": latest.profile_visits - previous.profile_visits,
        }

    def export_csv(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> str:
        """Export matching records as CSV text (UTF-8 with BOM for Excel)."""
        records = self.query(start_date, end_date, platform)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            ["日期", "平台", "粉丝数", "播放数", "评论数", "点赞数", "分享数", "主页访问"]
        )
        platform_labels = {
            "douyin": "抖音",
            "kuaishou": "快手",
            "wechat_channels": "视频号",
            "xiaohongshu": "小红书",
        }
        for r in records:
            writer.writerow(
                [
                    r.date,
                    platform_labels.get(r.platform, r.platform),
                    r.followers,
                    r.plays,
                    r.comments,
                    r.likes,
                    r.shares,
                    r.profile_visits,
                ]
            )
        return "\ufeff" + output.getvalue()

    def platforms(self) -> list[str]:
        return sorted({r.platform for r in self._records})


analytics_service = AnalyticsService()
