"""
统一 API Key 下发客户端（页面配置优先）

从系统后端（NestJS, 127.0.0.1:3000）的 /api/internal/runtime-keys 接口拉取
「系统设置 → API密钥配置」页面里维护的 key，使 video-api 不再手工维护
config.toml 中的密钥。

规则：
  - 60 秒内存缓存，页面改 key 后最多 1 分钟生效，无需重启；
  - 后端不可用/超时：静默失败并返回 None，由调用方回退本地文件配置；
  - 仅用于 LLM 类 key（deepseek → deepseek、qwen → dashscope、openai → openai）。
"""
import json
import time
import urllib.request

# 系统后端内部接口（仅本机回环）
_SYSTEM_API = "http://127.0.0.1:3000/api/internal/runtime-keys"
_TIMEOUT = 1.5
_TTL_SECONDS = 60

# video-api 的 llm_provider 名 → 页面平台名
_PLATFORM_MAP = {
    "deepseek": "deepseek",
    "qwen": "dashscope",
    "openai": "openai",
}

_cache: dict | None = None
_cache_at: float = 0.0


def _fetch() -> dict | None:
    """拉取全部已配置平台 key，带 TTL 缓存；失败返回当前缓存或 None。"""
    global _cache, _cache_at
    now = time.time()
    if _cache is not None and now - _cache_at < _TTL_SECONDS:
        return _cache
    try:
        with urllib.request.urlopen(_SYSTEM_API, timeout=_TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        # 兼容系统后端响应包装 {code, message, data, ...}
        if isinstance(data, dict) and isinstance(data.get("data"), dict):
            data = data["data"]
        if isinstance(data, dict):
            _cache = data
            _cache_at = now
    except Exception:
        # 后端未启动 / 超时：保留旧缓存（若有），否则返回 None 由调用方回退
        pass
    return _cache


def get_remote(llm_provider: str) -> dict | None:
    """按 video-api 的 llm_provider 名返回页面配置 {apiKey, baseUrl, model}，无则 None。"""
    platform = _PLATFORM_MAP.get(llm_provider)
    if not platform:
        return None
    keys = _fetch()
    if not keys:
        return None
    return keys.get(platform)
