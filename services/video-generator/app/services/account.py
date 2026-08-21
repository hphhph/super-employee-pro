"""Lightweight account system for 商家宝 WebUI.

This module provides a session-based account management layer. It supports
phone-number login (with a configurable demo verification code) and WeChat
openid login as placeholders for real OAuth / SMS integrations.

Storage: JSON file under ``storage/accounts.json`` so no external database is
required for a single-tenant local deployment.
"""

from __future__ import annotations

import json
import os
import secrets
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from loguru import logger


class AccountRole(str, Enum):
    admin = "admin"
    member = "member"


class AccountPermission(str, Enum):
    """Function-level permissions that can be assigned to sub-accounts."""

    video_create = "video_create"
    video_template = "video_template"
    material_manage = "material_manage"
    publish_manage = "publish_manage"
    account_manage = "account_manage"
    data_center = "data_center"
    settings_manage = "settings_manage"


DEFAULT_PERMISSION_LABELS = {
    AccountPermission.video_create: "视频生成",
    AccountPermission.video_template: "视频模板",
    AccountPermission.material_manage: "素材管理",
    AccountPermission.publish_manage: "发布管理",
    AccountPermission.account_manage: "账户管理",
    AccountPermission.data_center: "数据中心",
    AccountPermission.settings_manage: "系统设置",
}


@dataclass
class UserAccount:
    id: str
    phone: str = ""
    wechat_openid: str = ""
    nickname: str = ""
    avatar: str = ""
    role: AccountRole = AccountRole.member
    parent_id: str = ""  # empty for root accounts
    permissions: list[str] = field(default_factory=list)
    created_at: int = 0
    last_login_at: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "phone": self.phone,
            "wechat_openid": self.wechat_openid,
            "nickname": self.nickname,
            "avatar": self.avatar,
            "role": self.role.value,
            "parent_id": self.parent_id,
            "permissions": list(self.permissions),
            "created_at": self.created_at,
            "last_login_at": self.last_login_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UserAccount":
        return cls(
            id=str(data.get("id", "")),
            phone=str(data.get("phone", "")),
            wechat_openid=str(data.get("wechat_openid", "")),
            nickname=str(data.get("nickname", "")),
            avatar=str(data.get("avatar", "")),
            role=AccountRole(data.get("role", "member")),
            parent_id=str(data.get("parent_id", "")),
            permissions=list(data.get("permissions", [])),
            created_at=int(data.get("created_at", 0) or 0),
            last_login_at=int(data.get("last_login_at", 0) or 0),
        )

    def can(self, permission: AccountPermission | str) -> bool:
        if self.role == AccountRole.admin:
            return True
        perm = permission.value if isinstance(permission, AccountPermission) else permission
        return perm in self.permissions


class AccountService:
    """Manage local user accounts."""

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            # Go two levels up from app/services/account.py -> project root
            root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            storage_dir = os.path.join(root_dir, "storage")
        self._storage_dir = storage_dir
        os.makedirs(self._storage_dir, exist_ok=True)
        self._file_path = os.path.join(self._storage_dir, "accounts.json")
        self._accounts: dict[str, UserAccount] = {}
        self._sessions: dict[str, str] = {}  # token -> user_id
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._file_path):
            self._ensure_default_admin()
            return
        try:
            with open(self._file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for user_id, raw in data.get("accounts", {}).items():
                self._accounts[user_id] = UserAccount.from_dict(raw)
            self._sessions = {
                str(k): str(v) for k, v in data.get("sessions", {}).items()
            }
        except Exception as exc:
            logger.warning(f"failed to load accounts: {exc}; starting fresh")
            self._accounts = {}
            self._ensure_default_admin()

    def _save(self) -> None:
        try:
            payload = {
                "accounts": {
                    user_id: account.to_dict()
                    for user_id, account in self._accounts.items()
                },
                "sessions": dict(self._sessions),
            }
            tmp_path = self._file_path + ".tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, self._file_path)
        except Exception as exc:
            logger.error(f"failed to save accounts: {exc}")

    def _ensure_default_admin(self) -> None:
        """Create a default admin if no accounts exist."""
        if self._accounts:
            return
        admin = UserAccount(
            id=str(uuid.uuid4()),
            phone="13800000000",
            nickname="管理员",
            role=AccountRole.admin,
            created_at=int(time.time()),
        )
        self._accounts[admin.id] = admin
        self._save()

    # ------------------------------------------------------------------
    # Public query API
    # ------------------------------------------------------------------

    def get_account(self, user_id: str) -> Optional[UserAccount]:
        return self._accounts.get(user_id)

    def find_by_phone(self, phone: str) -> Optional[UserAccount]:
        phone = phone.strip()
        for account in self._accounts.values():
            if account.phone == phone:
                return account
        return None

    def find_by_wechat(self, openid: str) -> Optional[UserAccount]:
        openid = openid.strip()
        for account in self._accounts.values():
            if account.wechat_openid == openid:
                return account
        return None

    def list_accounts(self, parent_id: Optional[str] = None) -> list[UserAccount]:
        if parent_id is None:
            return list(self._accounts.values())
        return [
            account for account in self._accounts.values()
            if account.parent_id == parent_id
        ]

    # ------------------------------------------------------------------
    # Auth flow
    # ------------------------------------------------------------------

    def send_phone_code(self, phone: str, demo_code: str = "123456") -> str:
        """Return a verification code for the given phone number.

        In production this should integrate with an SMS gateway. For local
        deployments the demo code is returned directly so users can log in
        without external credentials.
        """
        phone = phone.strip()
        if not phone:
            raise ValueError("phone number is required")
        logger.info(f"phone verification code sent to {phone}")
        return demo_code

    def verify_phone_code(self, phone: str, code: str, expected_code: str = "123456") -> bool:
        return code.strip() == expected_code and bool(phone.strip())

    def login_or_register_phone(self, phone: str, nickname: str = "") -> UserAccount:
        account = self.find_by_phone(phone)
        if account is None:
            account = UserAccount(
                id=str(uuid.uuid4()),
                phone=phone,
                nickname=nickname or f"用户{phone[-4:]}",
                role=AccountRole.member,
                created_at=int(time.time()),
            )
            self._accounts[account.id] = account
        account.last_login_at = int(time.time())
        self._save()
        return account

    def login_or_register_wechat(self, openid: str, nickname: str = "", avatar: str = "") -> UserAccount:
        account = self.find_by_wechat(openid)
        if account is None:
            account = UserAccount(
                id=str(uuid.uuid4()),
                wechat_openid=openid,
                nickname=nickname or f"微信用户{openid[-6:]}",
                avatar=avatar,
                role=AccountRole.member,
                created_at=int(time.time()),
            )
            self._accounts[account.id] = account
        account.last_login_at = int(time.time())
        self._save()
        return account

    def create_session(self, account: UserAccount) -> str:
        token = secrets.token_urlsafe(32)
        self._sessions[token] = account.id
        self._save()
        return token

    def validate_session(self, token: str) -> Optional[UserAccount]:
        user_id = self._sessions.get(token)
        if not user_id:
            return None
        return self._accounts.get(user_id)

    def logout(self, token: str) -> None:
        self._sessions.pop(token, None)
        self._save()

    # ------------------------------------------------------------------
    # Account authorization / permission assignment
    # ------------------------------------------------------------------

    def create_sub_account(
        self,
        parent_id: str,
        phone: str = "",
        wechat_openid: str = "",
        nickname: str = "",
        permissions: Optional[list[str]] = None,
    ) -> UserAccount:
        parent = self._accounts.get(parent_id)
        if parent is None:
            raise ValueError("parent account not found")
        if parent.role != AccountRole.admin:
            raise PermissionError("only admin can create sub-accounts")
        if phone and self.find_by_phone(phone):
            raise ValueError("phone number already registered")
        if wechat_openid and self.find_by_wechat(wechat_openid):
            raise ValueError("wechat openid already registered")

        account = UserAccount(
            id=str(uuid.uuid4()),
            phone=phone,
            wechat_openid=wechat_openid,
            nickname=nickname or "子账号",
            role=AccountRole.member,
            parent_id=parent_id,
            permissions=list(permissions or []),
            created_at=int(time.time()),
        )
        self._accounts[account.id] = account
        self._save()
        return account

    def update_permissions(self, admin_id: str, target_id: str, permissions: list[str]) -> UserAccount:
        admin = self._accounts.get(admin_id)
        if admin is None or admin.role != AccountRole.admin:
            raise PermissionError("only admin can update permissions")
        target = self._accounts.get(target_id)
        if target is None:
            raise ValueError("target account not found")
        # Prevent privilege escalation: a sub-account cannot modify its parent.
        if target.id == admin.id:
            raise ValueError("cannot modify your own permissions here")
        if target.parent_id and target.parent_id != admin.id:
            raise PermissionError("can only update permissions of your own sub-accounts")
        target.permissions = list(permissions)
        self._save()
        return target

    def delete_account(self, admin_id: str, target_id: str) -> None:
        admin = self._accounts.get(admin_id)
        if admin is None or admin.role != AccountRole.admin:
            raise PermissionError("only admin can delete accounts")
        target = self._accounts.get(target_id)
        if target is None:
            return
        if target.id == admin.id:
            raise ValueError("cannot delete yourself")
        if target.parent_id and target.parent_id != admin.id:
            raise PermissionError("can only delete your own sub-accounts")
        self._accounts.pop(target_id, None)
        # Invalidate sessions for the deleted account.
        tokens_to_remove = [
            token for token, uid in self._sessions.items() if uid == target_id
        ]
        for token in tokens_to_remove:
            self._sessions.pop(token, None)
        self._save()


# Module-level singleton for the WebUI process.
account_service = AccountService()
