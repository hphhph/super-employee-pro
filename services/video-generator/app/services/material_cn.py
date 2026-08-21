"""
Chinese material sources for MoneyPrinterTurbo.

Supports:
  - yingshiju (影视飓风素材库): https://media.stormsr.com
  - aigei (爱给网): https://www.aigei.com
  - jimeng (即梦 AI): https://jimeng.jianying.com

Each provider implements the same interface as the existing Pexels/Pixabay/Coverr
search functions: returns List[MaterialInfo] compatible with the download pipeline.
"""
import os
import time
from typing import Any, List
from urllib.parse import quote_plus, urlencode

import requests
from loguru import logger

from app.config import config
from app.models.schema import MaterialInfo, VideoAspect
from app.services import material
from app.services.material import _safe_public_url, _creator_info, _get_tls_verify
from app.utils import utils


def search_videos_yingshiju(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    """
    影视飓风素材库 (https://media.stormsr.com)

    提供高质量影视素材，需要 API Key。搜索接口返回 JSON，包含视频列表和下载地址。
    """
    aspect = VideoAspect(video_aspect)
    video_width, video_height = aspect.to_resolution()
    api_key = material.get_api_key("yingshiju_api_keys")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    params = {
        "keyword": search_term,
        "page": 1,
        "page_size": 20,
        "sort": "hot",
    }

    orientation = "vertical" if aspect == VideoAspect.portrait else "horizontal"
    if aspect != VideoAspect.square:
        params["orientation"] = orientation

    query_url = f"https://api.media.stormsr.com/v1/videos?{urlencode(params)}"
    logger.info(f"searching videos on yingshiju: term={search_term!r}")

    try:
        r = requests.get(
            query_url,
            headers=headers,
            proxies=config.proxy,
            verify=_get_tls_verify(),
            timeout=(30, 60),
        )
        response = r.json()
        video_items = []

        if not isinstance(response, dict) or "data" not in response:
            logger.error("yingshiju video search returned an unsupported response")
            return video_items

        videos = response.get("data", {}).get("list", [])
        for v in videos:
            duration = int(v.get("duration", 0))
            if duration < minimum_duration:
                continue

            download_url = v.get("download_url") or v.get("video_url")
            if not download_url:
                continue

            w = int(v.get("width", 0))
            h = int(v.get("height", 0))
            if aspect != VideoAspect.square and w > 0 and h > 0:
                if not material._matches_video_aspect(w, h, aspect):
                    continue

            item = MaterialInfo()
            item.provider = "yingshiju"
            item.url = download_url
            item.duration = duration
            item.source_info = {
                "provider": "yingshiju",
                "search_term": search_term,
                "asset_id": str(v.get("id", "")),
                "source_page": _safe_public_url(v.get("page_url") or v.get("url")),
                "creator": _creator_info(v.get("author") or v.get("user")),
                "rendition": {
                    "id": str(v.get("rendition_id", "")),
                    "width": w,
                    "height": h,
                },
            }
            video_items.append(item)

        return video_items
    except Exception as e:
        logger.error(
            "yingshiju video search failed: "
            f"error={type(e).__name__}, detail={material._redact_request_error(e, api_key)}"
        )
    return []


def search_videos_aigei(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    """
    爱给网 (https://www.aigei.com)

    提供免费视频素材、音效、图片等资源。需要 API Key 进行搜索和下载。
    """
    aspect = VideoAspect(video_aspect)
    video_width, video_height = aspect.to_resolution()
    api_key = material.get_api_key("aigei_api_keys")

    headers = {
        "X-API-Key": api_key,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    params = {
        "q": search_term,
        "type": "video",
        "page": 1,
        "size": 20,
        "order": "download",
    }

    orientation = "vertical" if aspect == VideoAspect.portrait else "horizontal"
    if aspect != VideoAspect.square:
        params["orientation"] = orientation

    query_url = f"https://api.aigei.com/v1/search?{urlencode(params)}"
    logger.info(f"searching videos on aigei: term={search_term!r}")

    try:
        r = requests.get(
            query_url,
            headers=headers,
            proxies=config.proxy,
            verify=_get_tls_verify(),
            timeout=(30, 60),
        )
        response = r.json()
        video_items = []

        if not isinstance(response, dict) or "results" not in response:
            logger.error("aigei video search returned an unsupported response")
            return video_items

        for v in response.get("results", []):
            duration = int(v.get("duration", 0))
            if duration < minimum_duration:
                continue

            download_url = v.get("download_url") or v.get("file_url")
            if not download_url:
                continue

            w = int(v.get("width", 0))
            h = int(v.get("height", 0))
            if aspect != VideoAspect.square and w > 0 and h > 0:
                if not material._matches_video_aspect(w, h, aspect):
                    continue

            item = MaterialInfo()
            item.provider = "aigei"
            item.url = download_url
            item.duration = duration
            item.source_info = {
                "provider": "aigei",
                "search_term": search_term,
                "asset_id": str(v.get("id", "")),
                "source_page": _safe_public_url(v.get("page_url") or v.get("url")),
                "creator": _creator_info(v.get("author")),
                "rendition": {
                    "id": str(v.get("quality", "")),
                    "width": w,
                    "height": h,
                },
            }
            video_items.append(item)

        return video_items
    except Exception as e:
        logger.error(
            "aigei video search failed: "
            f"error={type(e).__name__}, detail={material._redact_request_error(e, api_key)}"
        )
    return []


def search_videos_jimeng(
    search_term: str,
    minimum_duration: int,
    video_aspect: VideoAspect = VideoAspect.portrait,
) -> List[MaterialInfo]:
    """
    即梦 AI (https://jimeng.jianying.com)

    字节跳动旗下 AI 创意平台，支持文生视频。需要 API Key。
    当搜索关键词时，会先尝试匹配已有的 AI 生成素材库，如果无匹配结果，
    可通过 generate_jimeng_video 生成新素材。
    """
    aspect = VideoAspect(video_aspect)
    video_width, video_height = aspect.to_resolution()
    api_key = material.get_api_key("jimeng_api_keys")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    orientation = "vertical" if aspect == VideoAspect.portrait else "horizontal"
    params = {
        "keyword": search_term,
        "page": 1,
        "page_size": 20,
        "orientation": orientation,
        "type": "video",
    }

    query_url = f"https://jimeng-api.jianying.com/v1/search?{urlencode(params)}"
    logger.info(f"searching videos on jimeng: term={search_term!r}")

    try:
        r = requests.get(
            query_url,
            headers=headers,
            proxies=config.proxy,
            verify=_get_tls_verify(),
            timeout=(30, 60),
        )
        response = r.json()
        video_items = []

        if not isinstance(response, dict) or "data" not in response:
            logger.error("jimeng video search returned an unsupported response")
            return video_items

        for v in response.get("data", {}).get("list", []):
            duration = int(v.get("duration", 0))
            if duration < minimum_duration:
                continue

            download_url = v.get("video_url") or v.get("download_url")
            if not download_url:
                continue

            w = int(v.get("width", 0))
            h = int(v.get("height", 0))
            if aspect != VideoAspect.square and w > 0 and h > 0:
                if not material._matches_video_aspect(w, h, aspect):
                    continue

            item = MaterialInfo()
            item.provider = "jimeng"
            item.url = download_url
            item.duration = duration
            item.source_info = {
                "provider": "jimeng",
                "search_term": search_term,
                "asset_id": str(v.get("id", "")),
                "source_page": _safe_public_url(v.get("page_url")),
                "creator": _creator_info(v.get("author") or "AI Generated"),
                "rendition": {
                    "id": str(v.get("resolution", "")),
                    "width": w,
                    "height": h,
                },
            }
            video_items.append(item)

        return video_items
    except Exception as e:
        logger.error(
            "jimeng video search failed: "
            f"error={type(e).__name__}, detail={material._redact_request_error(e, api_key)}"
        )
    return []


# Provider registry for Chinese material sources
CN_MATERIAL_PROVIDERS = {
    "yingshiju": search_videos_yingshiju,
    "aigei": search_videos_aigei,
    "jimeng": search_videos_jimeng,
}


def is_cn_material_source(source: str) -> bool:
    """Check if the given source is a Chinese material provider."""
    return source in CN_MATERIAL_PROVIDERS
