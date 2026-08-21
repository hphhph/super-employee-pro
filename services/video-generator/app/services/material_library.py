"""素材管家服务（模块五 · 5.2 素材管家）。

为 商家宝 WebUI 提供面向小白的素材库能力：
  - 分组管理：按 文本/图片/音频/视频 四类创建分组
  - 素材管理：文本素材直接录入，图片/音频/视频素材上传落盘
  - AI 爆款文案：复用现有 LLM 配置生成可朗读的短视频口播文案
  - 持久化：storage/material_library.json（索引）+ storage/materials/（文件）

素材文件与索引分开存放：索引 JSON 只记录相对路径、标题、分组等元数据，
实际文件存放在 storage/materials/ 下，删除素材时同时清理文件。
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from loguru import logger

from app.services import llm

# 素材类型
MATERIAL_TYPE_TEXT = "text"
MATERIAL_TYPE_IMAGE = "image"
MATERIAL_TYPE_AUDIO = "audio"
MATERIAL_TYPE_VIDEO = "video"
MATERIAL_TYPES = [MATERIAL_TYPE_TEXT, MATERIAL_TYPE_IMAGE, MATERIAL_TYPE_AUDIO, MATERIAL_TYPE_VIDEO]

MATERIAL_TYPE_LABELS = {
    MATERIAL_TYPE_TEXT: "文本",
    MATERIAL_TYPE_IMAGE: "图片",
    MATERIAL_TYPE_AUDIO: "音频",
    MATERIAL_TYPE_VIDEO: "视频",
}

# 上传文件扩展名白名单
FILE_EXTENSIONS = {
    MATERIAL_TYPE_IMAGE: {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"},
    MATERIAL_TYPE_AUDIO: {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"},
    MATERIAL_TYPE_VIDEO: {".mp4", ".mov", ".mkv", ".webm", ".avi"},
}

DEFAULT_GROUP_NAME = "默认分组"

# 上传大小上限（MB）
MAX_FILE_SIZE_MB = 200
# AI 文案长度上限（字符）
MAX_AI_COPY_LENGTH = 2000
# 引用文案长度上限
MAX_REFERENCE_LENGTH = 6000


def _safe_group_name(name: str) -> str:
    return (name or "").strip()[:30]


def _safe_title(title: str) -> str:
    return (title or "").strip()[:80]


@dataclass
class MaterialGroup:
    id: str
    name: str
    type: str = MATERIAL_TYPE_TEXT
    created_at: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MaterialGroup":
        return cls(
            id=str(data.get("id", "")),
            name=str(data.get("name", "")),
            type=str(data.get("type", MATERIAL_TYPE_TEXT)),
            created_at=int(data.get("created_at", 0) or 0),
        )


@dataclass
class MaterialItem:
    id: str
    group_id: str = ""
    type: str = MATERIAL_TYPE_TEXT
    title: str = ""
    content: str = ""          # 文本素材内容；文件素材可为空
    file_path: str = ""        # 相对 storage/materials 的路径（文件素材）
    created_at: int = 0
    source: str = "manual"     # manual / ai / upload

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "group_id": self.group_id,
            "type": self.type,
            "title": self.title,
            "content": self.content,
            "file_path": self.file_path,
            "created_at": self.created_at,
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MaterialItem":
        return cls(
            id=str(data.get("id", "")),
            group_id=str(data.get("group_id", "")),
            type=str(data.get("type", MATERIAL_TYPE_TEXT)),
            title=str(data.get("title", "")),
            content=str(data.get("content", "")),
            file_path=str(data.get("file_path", "")),
            created_at=int(data.get("created_at", 0) or 0),
            source=str(data.get("source", "manual")),
        )

    def absolute_path(self, materials_dir: str) -> str:
        if not self.file_path:
            return ""
        candidate = os.path.abspath(os.path.join(materials_dir, self.file_path))
        root = os.path.abspath(materials_dir)
        if os.path.commonpath([root, candidate]) != root:
            return ""
        return candidate


class MaterialLibraryService:
    """本地素材库：分组 + 四类素材 + AI 爆款文案。"""

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            storage_dir = os.path.join(root_dir, "storage")
        self._storage_dir = storage_dir
        self._materials_dir = os.path.join(storage_dir, "materials")
        self._file_path = os.path.join(storage_dir, "material_library.json")
        os.makedirs(self._storage_dir, exist_ok=True)
        os.makedirs(self._materials_dir, exist_ok=True)
        self._lock = threading.RLock()
        self._groups: list[MaterialGroup] = []
        self._materials: list[MaterialItem] = []
        self._load()

    # ------------------------------------------------------------------
    # 持久化
    # ------------------------------------------------------------------

    def _load(self) -> None:
        if not os.path.exists(self._file_path):
            self._groups = []
            self._materials = []
            return
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._groups = [
                MaterialGroup.from_dict(item) for item in data.get("groups", [])
            ]
            self._materials = [
                MaterialItem.from_dict(item) for item in data.get("materials", [])
            ]
            logger.info(
                f"loaded material library: groups={len(self._groups)}, "
                f"materials={len(self._materials)}"
            )
        except Exception as exc:
            logger.warning(f"failed to load material library: {exc}")
            self._groups = []
            self._materials = []

    def _save(self) -> None:
        payload = {
            "version": 1,
            "groups": [g.to_dict() for g in self._groups],
            "materials": [m.to_dict() for m in self._materials],
        }
        temp_path = self._file_path + ".tmp"
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temp_path, self._file_path)
        except Exception as exc:
            logger.warning(f"failed to save material library: {exc}")

    # ------------------------------------------------------------------
    # 分组管理
    # ------------------------------------------------------------------

    def _ensure_default_group(self, material_type: str) -> str:
        """为指定类型返回默认分组；不存在则自动创建。"""
        for group in self._groups:
            if group.type == material_type and group.name == DEFAULT_GROUP_NAME:
                return group.id
        group = MaterialGroup(
            id=str(uuid.uuid4()),
            name=DEFAULT_GROUP_NAME,
            type=material_type,
            created_at=int(time.time()),
        )
        self._groups.append(group)
        self._save()
        return group.id

    def create_group(self, name: str, material_type: str = MATERIAL_TYPE_TEXT) -> MaterialGroup:
        with self._lock:
            safe_name = _safe_group_name(name) or DEFAULT_GROUP_NAME
            if material_type not in MATERIAL_TYPES:
                material_type = MATERIAL_TYPE_TEXT
            group = MaterialGroup(
                id=str(uuid.uuid4()),
                name=safe_name,
                type=material_type,
                created_at=int(time.time()),
            )
            self._groups.append(group)
            self._save()
            return group

    def delete_group(self, group_id: str) -> bool:
        with self._lock:
            group = next((g for g in self._groups if g.id == group_id), None)
            if group is None:
                return False
            self._groups = [g for g in self._groups if g.id != group_id]
            # 组内素材一并删除（含文件）
            moved = []
            for material in self._materials:
                if material.group_id == group_id:
                    self._remove_material_file(material)
                else:
                    moved.append(material)
            self._materials = moved
            self._save()
            return True

    def list_groups(self, material_type: Optional[str] = None) -> list[MaterialGroup]:
        if material_type and material_type in MATERIAL_TYPES:
            return [g for g in self._groups if g.type == material_type]
        return list(self._groups)

    def group_material_count(self, group_id: str) -> int:
        return sum(1 for m in self._materials if m.group_id == group_id)

    # ------------------------------------------------------------------
    # 素材管理
    # ------------------------------------------------------------------

    def add_text_material(
        self,
        group_id: str,
        title: str,
        content: str,
        material_type: str = MATERIAL_TYPE_TEXT,
        source: str = "manual",
    ) -> MaterialItem:
        with self._lock:
            group = next((g for g in self._groups if g.id == group_id), None)
            if group is None:
                group_id = self._ensure_default_group(material_type)
            item = MaterialItem(
                id=str(uuid.uuid4()),
                group_id=group_id,
                type=material_type,
                title=_safe_title(title),
                content=(content or "").strip(),
                created_at=int(time.time()),
                source=source,
            )
            self._materials.append(item)
            self._save()
            return item

    def add_file_material(
        self,
        group_id: str,
        title: str,
        file_bytes: bytes,
        filename: str,
        material_type: str,
        source: str = "upload",
    ) -> MaterialItem:
        with self._lock:
            group = next((g for g in self._groups if g.id == group_id), None)
            if group is None:
                group_id = self._ensure_default_group(material_type)
            ext = os.path.splitext(filename or "")[1].lower()
            if ext not in FILE_EXTENSIONS.get(material_type, set()):
                raise ValueError(f"unsupported {material_type} file extension: {ext or '<none>'}")
            safe_name = f"{uuid.uuid4().hex}{ext}"
            target = os.path.join(self._materials_dir, safe_name)
            try:
                with open(target, "wb") as f:
                    f.write(file_bytes)
            except OSError as exc:
                logger.error(f"failed to write material file: {exc}")
                raise ValueError("failed to save uploaded material file")
            item = MaterialItem(
                id=str(uuid.uuid4()),
                group_id=group_id,
                type=material_type,
                title=_safe_title(title) or os.path.splitext(filename or "")[0][:80],
                file_path=safe_name,
                created_at=int(time.time()),
                source=source,
            )
            self._materials.append(item)
            self._save()
            return item

    def delete_material(self, material_id: str) -> bool:
        with self._lock:
            material = next((m for m in self._materials if m.id == material_id), None)
            if material is None:
                return False
            self._materials = [m for m in self._materials if m.id != material_id]
            self._remove_material_file(material)
            self._save()
            return True

    def _remove_material_file(self, material: MaterialItem) -> None:
        if not material.file_path:
            return
        candidate = material.absolute_path(self._materials_dir)
        if not candidate:
            return
        try:
            if os.path.isfile(candidate):
                os.remove(candidate)
        except OSError as exc:
            logger.warning(f"failed to remove material file {candidate}: {exc}")

    def list_materials(
        self,
        material_type: Optional[str] = None,
        group_id: Optional[str] = None,
    ) -> list[MaterialItem]:
        items = list(self._materials)
        if material_type and material_type in MATERIAL_TYPES:
            items = [m for m in items if m.type == material_type]
        if group_id:
            items = [m for m in items if m.group_id == group_id]
        return sorted(items, key=lambda m: m.created_at, reverse=True)

    def get_material(self, material_id: str) -> Optional[MaterialItem]:
        return next((m for m in self._materials if m.id == material_id), None)

    def group_name(self, group_id: str) -> str:
        group = next((g for g in self._groups if g.id == group_id), None)
        return group.name if group else ""

    # ------------------------------------------------------------------
    # AI 爆款文案（模块五 · 5.2 AI生成素材）
    # ------------------------------------------------------------------

    def generate_ai_copy(
        self,
        subject: str,
        requirement: str = "",
        max_chars: int = 200,
        language: str = "zh-CN",
    ) -> str:
        """生成短视频口播文案。

        与主流水线的脚本生成不同，这里面向“素材库沉淀”，输出更短、更口语化、
        适合直接复用的爆款文案。复用 llm._generate_response 走当前配置的
        Provider，保证与视频生成使用同一套模型配置。
        """
        subject = (subject or "").strip()[:200]
        if not subject:
            raise ValueError("subject is required")
        max_chars = max(50, min(int(max_chars or 200), MAX_AI_COPY_LENGTH))
        requirement = (requirement or "").strip()[:500]

        prompt = f"""# Role: 短视频爆款文案写手

## Goal
基于主题创作一段可直接用于口播的短视频文案，突出吸引力和转化力。

## Constraints
1. 只返回文案正文，不要标题、不要序号、不要任何 markdown 格式。
2. 文案口语化、有节奏感，前 3 秒要有钩子（悬念/痛点/利益点）。
3. 全文不超过 {max_chars} 个字符。
4. 使用 {language} 语言撰写。
5. 不要提及“文案”“视频”等创作说明类词汇。

## Context
### 主题
{subject}
"""

        if requirement:
            prompt += f"""
### 附加要求
{requirement}
"""
        prompt = prompt.rstrip()
        logger.info(f"generating AI copy: subject={subject}, max_chars={max_chars}")
        response = llm._generate_response(prompt)
        if isinstance(response, str) and response.startswith("Error: "):
            logger.error(f"failed to generate AI copy: {response}")
            return ""
        # 清理 markdown 符号与多余空行
        cleaned = re.sub(r"[*#`>]", "", response)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
        if not cleaned:
            logger.warning("AI copy generation returned empty content")
            return ""
        if len(cleaned) > max_chars:
            cleaned = cleaned[:max_chars].rstrip()
        return cleaned


# 全局单例
material_library_service = MaterialLibraryService()
