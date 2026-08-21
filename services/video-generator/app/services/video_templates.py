"""
Video template presets for MoneyPrinterTurbo.

Provides pre-configured parameter sets for common short video use cases.
Each template defines recommended values for video aspect, subtitle style,
BGM, voice, clip duration, etc. Users can select a template in the WebUI
to quickly populate all settings, then fine-tune as needed.

Templates are read-only definitions; selecting one only fills form fields
and does not override any subsequent user changes.
"""
from typing import Any


# Template identifier -> display label mapping (i18n keys)
# The actual display labels are resolved from i18n translations in the WebUI.
TEMPLATE_IDS = [
    "custom",          # 自定义/Custom - no preset applied
    "ecommerce",       # 短视频带货
    "knowledge",       # 知识科普
    "emotional",       # 情感语录
    "news",            # 新闻资讯
    "product_showcase",# 产品展示
    "story_narrative", # 故事叙事
]

# Each template defines a subset of VideoParams fields.
# Fields not listed here are left at their current/default values.
VIDEO_TEMPLATES: dict[str, dict[str, Any]] = {
    "custom": {
        # No preset - user configures everything manually
    },
    "ecommerce": {
        "video_aspect": "9:16",
        "video_concat_mode": "random",
        "video_clip_duration": 3,
        "video_clip_speed": 1.0,
        "voice_name": "zh-CN-XiaoxiaoNeural-Female",
        "voice_rate": 1.2,
        "voice_volume": 1.0,
        "bgm_type": "random",
        "bgm_volume": 0.15,
        "subtitle_enabled": True,
        "subtitle_position": "bottom",
        "font_size": 65,
        "text_fore_color": "#FFD700",
        "text_background_color": "#000000",
        "stroke_color": "#000000",
        "stroke_width": 2.0,
        "rounded_subtitle_background": True,
        "video_count": 1,
    },
    "knowledge": {
        "video_aspect": "9:16",
        "video_concat_mode": "sequential",
        "video_clip_duration": 5,
        "video_clip_speed": 1.0,
        "voice_name": "zh-CN-YunxiNeural-Male",
        "voice_rate": 1.0,
        "voice_volume": 1.0,
        "bgm_type": "random",
        "bgm_volume": 0.1,
        "subtitle_enabled": True,
        "subtitle_position": "bottom",
        "font_size": 55,
        "text_fore_color": "#FFFFFF",
        "text_background_color": "#000000",
        "stroke_color": "#000000",
        "stroke_width": 1.5,
        "rounded_subtitle_background": False,
        "video_count": 1,
    },
    "emotional": {
        "video_aspect": "9:16",
        "video_concat_mode": "random",
        "video_clip_duration": 6,
        "video_clip_speed": 0.8,
        "voice_name": "zh-CN-XiaoyiNeural-Female",
        "voice_rate": 0.9,
        "voice_volume": 1.0,
        "bgm_type": "random",
        "bgm_volume": 0.25,
        "subtitle_enabled": True,
        "subtitle_position": "center",
        "font_size": 50,
        "text_fore_color": "#FFFFFF",
        "text_background_color": False,
        "stroke_color": "#333333",
        "stroke_width": 1.0,
        "rounded_subtitle_background": False,
        "video_count": 1,
    },
    "news": {
        "video_aspect": "16:9",
        "video_concat_mode": "sequential",
        "video_clip_duration": 4,
        "video_clip_speed": 1.0,
        "voice_name": "zh-CN-YunxiNeural-Male",
        "voice_rate": 1.1,
        "voice_volume": 1.0,
        "bgm_type": "",
        "bgm_volume": 0.0,
        "subtitle_enabled": True,
        "subtitle_position": "bottom",
        "font_size": 50,
        "text_fore_color": "#FFFFFF",
        "text_background_color": "#000000",
        "stroke_color": "#000000",
        "stroke_width": 1.5,
        "rounded_subtitle_background": False,
        "video_count": 1,
    },
    "product_showcase": {
        "video_aspect": "9:16",
        "video_concat_mode": "random",
        "video_clip_duration": 3,
        "video_clip_speed": 1.0,
        "voice_name": "zh-CN-XiaoxiaoNeural-Female",
        "voice_rate": 1.15,
        "voice_volume": 1.0,
        "bgm_type": "random",
        "bgm_volume": 0.2,
        "subtitle_enabled": True,
        "subtitle_position": "top",
        "font_size": 60,
        "text_fore_color": "#FFFFFF",
        "text_background_color": "#000000",
        "stroke_color": "#FF6B00",
        "stroke_width": 2.0,
        "rounded_subtitle_background": True,
        "video_count": 1,
        "watermark_enabled": True,
    },
    "story_narrative": {
        "video_aspect": "9:16",
        "video_concat_mode": "sequential",
        "video_clip_duration": 5,
        "video_clip_speed": 1.0,
        "voice_name": "zh-CN-YunxiNeural-Male",
        "voice_rate": 1.0,
        "voice_volume": 1.0,
        "bgm_type": "random",
        "bgm_volume": 0.2,
        "subtitle_enabled": True,
        "subtitle_position": "bottom",
        "font_size": 55,
        "text_fore_color": "#FFFFFF",
        "text_background_color": False,
        "stroke_color": "#000000",
        "stroke_width": 1.5,
        "rounded_subtitle_background": False,
        "video_count": 1,
    },
}


def get_template(template_id: str) -> dict[str, Any]:
    """Get template parameters by ID. Returns empty dict for unknown/custom."""
    return VIDEO_TEMPLATES.get(template_id, {})


def get_template_ids() -> list[str]:
    """Get all available template IDs."""
    return list(TEMPLATE_IDS)
