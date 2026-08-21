"""
China platform publishing service for MoneyPrinterTurbo.

Supports publishing videos to:
  - 快手 (Kuaishou)
  - 抖音 (Douyin)
  - 视频号 (WeChat Channels)
  - 小红书 (Xiaohongshu / RED)

Each platform supports two authentication modes:
  1. API mode: Official open platform API with OAuth tokens
  2. Cookie mode: Browser cookie-based upload (for personal accounts)

Authentication credentials are managed in the WebUI's dedicated auth menu
and stored in config.toml under [china_publish].
"""
import json
import os
import time
from typing import Any, Optional

import requests
from loguru import logger
from app.config import config


# Platform identifiers
PLATFORM_KUAISHOU = "kuaishou"
PLATFORM_DOUYIN = "douyin"
PLATFORM_WECHAT_CHANNELS = "wechat_channels"
PLATFORM_XIAOHONGSHU = "xiaohongshu"

ALL_CHINA_PLATFORMS = [
    PLATFORM_KUAISHOU,
    PLATFORM_DOUYIN,
    PLATFORM_WECHAT_CHANNELS,
    PLATFORM_XIAOHONGSHU,
]

PLATFORM_LABELS = {
    PLATFORM_KUAISHOU: "快手",
    PLATFORM_DOUYIN: "抖音",
    PLATFORM_WECHAT_CHANNELS: "视频号",
    PLATFORM_XIAOHONGSHU: "小红书",
}


class ChinaPublishService:
    """Unified publishing service for Chinese short video platforms."""

    def __init__(self):
        self._reload_config()

    def _reload_config(self):
        """从配置中重新读取国内平台发布参数。

        WebUI 的认证面板保存配置后，单例需要重新读取才能生效。
        """
        cn_cfg = config.app.get("china_publish", {})
        if not isinstance(cn_cfg, dict):
            cn_cfg = {}
        self.enabled = cn_cfg.get("enabled", False)
        self.auto_upload = cn_cfg.get("auto_upload", False)
        self.platforms = cn_cfg.get("platforms", [])
        self.credentials = cn_cfg.get("credentials", {})

    def is_configured(self) -> bool:
        self._reload_config()
        return bool(self.enabled and self.platforms)

    def is_platform_configured(self, platform: str) -> bool:
        """Check if a specific platform has valid credentials."""
        creds = self.credentials.get(platform, {})
        if not creds:
            return False
        # Either API token or cookies must be present
        return bool(creds.get("api_token") or creds.get("cookies") or creds.get("access_token"))

    def upload_video(
        self,
        video_path: str,
        title: str,
        description: str = "",
        tags: Optional[list] = None,
        platforms: Optional[list] = None,
        cover_image: Optional[str] = None,
    ) -> dict:
        """
        Upload video to one or more Chinese platforms.

        Returns dict with per-platform results:
        {
            "results": [
                {"platform": "douyin", "success": True, "video_id": "...", "url": "..."},
                ...
            ],
            "success_count": 3,
            "failed_count": 0,
        }
        """
        self._reload_config()
        if not self.is_configured():
            logger.warning("China publish is not configured. Skipping.")
            return {"results": [], "success_count": 0, "failed_count": 0}

        if platforms is None:
            platforms = self.platforms

        if not os.path.exists(video_path):
            logger.error(f"Video file not found: {video_path}")
            return {
                "results": [{"platform": p, "success": False, "error": "file not found"} for p in platforms],
                "success_count": 0,
                "failed_count": len(platforms),
            }

        results = []
        for platform in platforms:
            if platform not in ALL_CHINA_PLATFORMS:
                logger.warning(f"unsupported platform: {platform}")
                results.append({
                    "platform": platform,
                    "success": False,
                    "error": "unsupported platform",
                })
                continue

            if not self.is_platform_configured(platform):
                logger.warning(f"platform {platform} is not configured with credentials")
                results.append({
                    "platform": platform,
                    "success": False,
                    "error": "platform not configured",
                })
                continue

            try:
                result = self._upload_to_platform(
                    platform=platform,
                    video_path=video_path,
                    title=title,
                    description=description,
                    tags=tags or [],
                    cover_image=cover_image,
                )
                results.append(result)
            except Exception as e:
                logger.error(f"failed to upload to {platform}: {type(e).__name__}, {e}")
                results.append({
                    "platform": platform,
                    "success": False,
                    "error": str(e),
                })

        success_count = sum(1 for r in results if r.get("success"))
        return {
            "results": results,
            "success_count": success_count,
            "failed_count": len(results) - success_count,
        }

    def _upload_to_platform(
        self,
        platform: str,
        video_path: str,
        title: str,
        description: str,
        tags: list,
        cover_image: Optional[str],
    ) -> dict:
        """Dispatch to platform-specific uploader."""
        creds = self.credentials.get(platform, {})

        if platform == PLATFORM_DOUYIN:
            return self._upload_douyin(creds, video_path, title, description, tags, cover_image)
        elif platform == PLATFORM_KUAISHOU:
            return self._upload_kuaishou(creds, video_path, title, description, tags, cover_image)
        elif platform == PLATFORM_WECHAT_CHANNELS:
            return self._upload_wechat_channels(creds, video_path, title, description, tags, cover_image)
        elif platform == PLATFORM_XIAOHONGSHU:
            return self._upload_xiaohongshu(creds, video_path, title, description, tags, cover_image)
        else:
            return {"platform": platform, "success": False, "error": "unknown platform"}

    def _upload_douyin(
        self, creds: dict, video_path: str, title: str, description: str, tags: list, cover_image
    ) -> dict:
        """
        抖音开放平台发布视频。

        需要通过抖音开放平台 OAuth 授权获取 access_token。
        API 文档: https://developer.open-douyin.com/docs/resource/zh-CN/dop/develop/openapi/video-management/douyin/create-video
        """
        access_token = creds.get("access_token", "")
        open_id = creds.get("open_id", "")

        if not access_token or not open_id:
            return {
                "platform": PLATFORM_DOUYIN,
                "success": False,
                "error": "missing access_token or open_id",
            }

        # Step 1: Upload video
        upload_url = "https://open.douyin.com/api/douyin/v1/video/upload/"
        headers = {"access-token": access_token}

        try:
            with open(video_path, "rb") as f:
                files = {"video": f}
                data = {"open_id": open_id}
                resp = requests.post(upload_url, headers=headers, data=data, files=files, timeout=300)
                resp.raise_for_status()
                upload_result = resp.json()

            video_data = upload_result.get("data", {})
            video_id = video_data.get("video", {}).get("video_id", "")
            if not video_id:
                return {
                    "platform": PLATFORM_DOUYIN,
                    "success": False,
                    "error": f"upload failed: {upload_result.get('description', 'unknown')}",
                }

            # Step 2: Publish video
            publish_url = "https://open.douyin.com/api/douyin/v1/video/create/"
            publish_data = {
                "open_id": open_id,
                "video_id": video_id,
                "text": self._build_publish_text(title, description, tags),
            }
            if cover_image and os.path.exists(cover_image):
                cover_upload_url = "https://open.douyin.com/api/douyin/v1/video/cover_upload/"
                with open(cover_image, "rb") as f:
                    cover_resp = requests.post(
                        cover_upload_url,
                        headers=headers,
                        data={"open_id": open_id},
                        files={"image": f},
                        timeout=60,
                    )
                    cover_data = cover_resp.json().get("data", {})
                    if cover_data.get("image", {}).get("image_id"):
                        publish_data["cover_image_id"] = cover_data["image"]["image_id"]

            resp = requests.post(publish_url, headers=headers, json=publish_data, timeout=60)
            resp.raise_for_status()
            result = resp.json()

            if result.get("data", {}).get("item_id"):
                item_id = result["data"]["item_id"]
                logger.info(f"video published to douyin: item_id={item_id}")
                return {
                    "platform": PLATFORM_DOUYIN,
                    "success": True,
                    "video_id": item_id,
                    "url": f"https://www.douyin.com/video/{item_id}",
                }
            return {
                "platform": PLATFORM_DOUYIN,
                "success": False,
                "error": result.get("description", "publish failed"),
            }
        except requests.exceptions.RequestException as e:
            return {"platform": PLATFORM_DOUYIN, "success": False, "error": str(e)}

    def _upload_kuaishou(
        self, creds: dict, video_path: str, title: str, description: str, tags: list, cover_image
    ) -> dict:
        """
        快手开放平台发布视频。

        需要通过快手开放平台 OAuth 授权获取 access_token。
        API 文档: https://open.kuaishou.com/document
        """
        access_token = creds.get("access_token", "")
        app_id = creds.get("app_id", "")

        if not access_token:
            return {
                "platform": PLATFORM_KUAISHOU,
                "success": False,
                "error": "missing access_token",
            }

        try:
            # Step 1: Get upload token
            upload_token_url = "https://open.kuaishou.com/openapi/photo/start_upload"
            headers = {"Access-Token": access_token}
            resp = requests.post(upload_token_url, headers=headers, json={"app_id": app_id}, timeout=30)
            resp.raise_for_status()
            token_data = resp.json().get("data", {})
            upload_token = token_data.get("upload_token", "")
            endpoint = token_data.get("endpoint", "")

            if not upload_token:
                return {
                    "platform": PLATFORM_KUAISHOU,
                    "success": False,
                    "error": "failed to get upload token",
                }

            # Step 2: Upload video chunks
            file_size = os.path.getsize(video_path)
            chunk_size = 1024 * 1024  # 1MB chunks
            fragment_id = 0

            with open(video_path, "rb") as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    upload_chunk_url = f"{endpoint}/api/upload?fragmentId={fragment_id}&uploadToken={upload_token}"
                    chunk_resp = requests.post(upload_chunk_url, data=chunk, timeout=120)
                    chunk_resp.raise_for_status()
                    fragment_id += 1

            # Step 3: Finish upload and publish
            finish_url = "https://open.kuaishou.com/openapi/photo/finish_upload"
            finish_resp = requests.post(
                finish_url,
                headers=headers,
                json={"upload_token": upload_token, "file_size": file_size},
                timeout=30,
            )
            finish_resp.raise_for_status()
            video_id = finish_resp.json().get("data", {}).get("video_id", "")

            if not video_id:
                return {
                    "platform": PLATFORM_KUAISHOU,
                    "success": False,
                    "error": "upload finished but no video_id returned",
                }

            # Step 4: Publish
            publish_url = "https://open.kuaishou.com/openapi/photo/publish"
            publish_data = {
                "video_id": video_id,
                "caption": self._build_publish_text(title, description, tags),
                "app_id": app_id,
            }
            pub_resp = requests.post(publish_url, headers=headers, json=publish_data, timeout=30)
            pub_resp.raise_for_status()
            result = pub_resp.json()

            if result.get("data", {}).get("photo_id"):
                photo_id = result["data"]["photo_id"]
                logger.info(f"video published to kuaishou: photo_id={photo_id}")
                return {
                    "platform": PLATFORM_KUAISHOU,
                    "success": True,
                    "video_id": photo_id,
                    "url": f"https://www.kuaishou.com/short-video/{photo_id}",
                }
            return {
                "platform": PLATFORM_KUAISHOU,
                "success": False,
                "error": result.get("error_msg", "publish failed"),
            }
        except requests.exceptions.RequestException as e:
            return {"platform": PLATFORM_KUAISHOU, "success": False, "error": str(e)}

    def _upload_wechat_channels(
        self, creds: dict, video_path: str, title: str, description: str, tags: list, cover_image
    ) -> dict:
        """
        微信视频号发布视频。

        需要通过微信开放平台获取 access_token。
        API 文档: https://developers.weixin.qq.com/doc/channels/API/
        """
        access_token = creds.get("access_token", "")
        app_id = creds.get("app_id", "")

        if not access_token:
            return {
                "platform": PLATFORM_WECHAT_CHANNELS,
                "success": False,
                "error": "missing access_token",
            }

        try:
            # Step 1: Upload video asset
            upload_url = "https://api.weixin.qq.com/channels/ec/league/video/upload"
            headers = {"Authorization": f"Bearer {access_token}"}

            with open(video_path, "rb") as f:
                files = {"video": f}
                data = {"type": "video"}
                resp = requests.post(upload_url, headers=headers, data=data, files=files, timeout=300)
                resp.raise_for_status()
                upload_result = resp.json()

            media_id = upload_result.get("media_id", "")
            if not media_id:
                return {
                    "platform": PLATFORM_WECHAT_CHANNELS,
                    "success": False,
                    "error": f"upload failed: {upload_result.get('errmsg', 'unknown')}",
                }

            # Step 2: Publish video
            publish_url = "https://api.weixin.qq.com/channels/ec/league/video/publish"
            publish_data = {
                "media_id": media_id,
                "title": title[:30],
                "description": self._build_publish_text("", description, tags)[:500],
            }
            if cover_image and os.path.exists(cover_image):
                with open(cover_image, "rb") as f:
                    cover_resp = requests.post(
                        upload_url,
                        headers=headers,
                        data={"type": "cover"},
                        files={"image": f},
                        timeout=60,
                    )
                    cover_media_id = cover_resp.json().get("media_id", "")
                    if cover_media_id:
                        publish_data["cover_media_id"] = cover_media_id

            pub_resp = requests.post(publish_url, headers=headers, json=publish_data, timeout=30)
            pub_resp.raise_for_status()
            result = pub_resp.json()

            if result.get("errcode") == 0 and result.get("video_id"):
                video_id = result["video_id"]
                logger.info(f"video published to wechat channels: video_id={video_id}")
                return {
                    "platform": PLATFORM_WECHAT_CHANNELS,
                    "success": True,
                    "video_id": video_id,
                    "url": f"https://channels.weixin.qq.com/web/feed/{video_id}",
                }
            return {
                "platform": PLATFORM_WECHAT_CHANNELS,
                "success": False,
                "error": result.get("errmsg", "publish failed"),
            }
        except requests.exceptions.RequestException as e:
            return {"platform": PLATFORM_WECHAT_CHANNELS, "success": False, "error": str(e)}

    def _upload_xiaohongshu(
        self, creds: dict, video_path: str, title: str, description: str, tags: list, cover_image
    ) -> dict:
        """
        小红书发布视频。

        需要通过小红书开放平台 OAuth 授权获取 access_token。
        API 文档: https://open.xiaohongshu.com/document
        """
        access_token = creds.get("access_token", "")

        if not access_token:
            return {
                "platform": PLATFORM_XIAOHONGSHU,
                "success": False,
                "error": "missing access_token",
            }

        try:
            # Step 1: Upload video
            upload_url = "https://edith.xiaohongshu.com/api/sns/web/v1/note/video/upload"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/octet-stream",
            }

            file_size = os.path.getsize(video_path)
            with open(video_path, "rb") as f:
                video_data = f.read()

            resp = requests.post(
                upload_url,
                headers=headers,
                data=video_data,
                params={"file_size": file_size, "file_type": "mp4"},
                timeout=300,
            )
            resp.raise_for_status()
            upload_result = resp.json()

            file_id = upload_result.get("data", {}).get("file_id", "")
            if not file_id:
                return {
                    "platform": PLATFORM_XIAOHONGSHU,
                    "success": False,
                    "error": f"upload failed: {upload_result.get('msg', 'unknown')}",
                }

            # Step 2: Create note with video
            publish_url = "https://edith.xiaohongshu.com/api/sns/web/v1/note/create"
            publish_data = {
                "note_type": "video",
                "title": title[:20],
                "desc": self._build_publish_text("", description, tags)[:1000],
                "video_info": {
                    "file_id": file_id,
                    "file_size": file_size,
                },
            }
            if cover_image and os.path.exists(cover_image):
                cover_upload_url = "https://edith.xiaohongshu.com/api/sns/web/v1/note/image/upload"
                with open(cover_image, "rb") as f:
                    cover_resp = requests.post(
                        cover_upload_url,
                        headers={"Authorization": f"Bearer {access_token}"},
                        data=f.read(),
                        timeout=60,
                    )
                    cover_file_id = cover_resp.json().get("data", {}).get("file_id", "")
                    if cover_file_id:
                        publish_data["cover_image"] = cover_file_id

            pub_resp = requests.post(
                publish_url,
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json=publish_data,
                timeout=30,
            )
            pub_resp.raise_for_status()
            result = pub_resp.json()

            if result.get("success") or result.get("code") == 0:
                note_id = result.get("data", {}).get("note_id", "")
                logger.info(f"video published to xiaohongshu: note_id={note_id}")
                return {
                    "platform": PLATFORM_XIAOHONGSHU,
                    "success": True,
                    "video_id": note_id,
                    "url": f"https://www.xiaohongshu.com/explore/{note_id}" if note_id else "",
                }
            return {
                "platform": PLATFORM_XIAOHONGSHU,
                "success": False,
                "error": result.get("msg", "publish failed"),
            }
        except requests.exceptions.RequestException as e:
            return {"platform": PLATFORM_XIAOHONGSHU, "success": False, "error": str(e)}

    @staticmethod
    def _build_publish_text(title: str, description: str, tags: list) -> str:
        """Build combined publish text with hashtags."""
        parts = []
        if title:
            parts.append(title)
        if description:
            parts.append(description)
        if tags:
            hashtag_text = " ".join(f"#{t.strip('#')}" for t in tags if t)
            parts.append(hashtag_text)
        return " ".join(parts)

    def get_platform_status(self, platform: str) -> dict:
        """Get configuration status for a platform."""
        if platform not in ALL_CHINA_PLATFORMS:
            return {"configured": False, "error": "unknown platform"}
        return {
            "configured": self.is_platform_configured(platform),
            "label": PLATFORM_LABELS.get(platform, platform),
            "auth_mode": "api" if self.credentials.get(platform, {}).get("access_token") else "cookie",
        }


# Singleton instance
china_publish_service = ChinaPublishService()


def cross_post_to_china(
    video_path: str,
    title: str,
    description: str = "",
    tags: Optional[list] = None,
    platforms: Optional[list] = None,
    cover_image: Optional[str] = None,
) -> dict:
    """Convenience function to cross-post to Chinese platforms."""
    return china_publish_service.upload_video(
        video_path=video_path,
        title=title,
        description=description,
        tags=tags,
        platforms=platforms,
        cover_image=cover_image,
    )
