"""运行配置：全部来自环境变量，测试时直接构造 Settings。"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    # 内容数据、管理员、会话、历史版本、上传图片都在这里
    data_dir: Path = Path("/workspace/clubdata")
    # 网站静态文件（各版本目录 + shared/）；状态页列目录、content.js 最后兜底都用它
    site_dir: Path = Path("/workspace/club")
    # 放到 HTTPS 后面以后设 CLUB_COOKIE_SECURE=1，Cookie 会带 Secure
    cookie_secure: bool = False
    # 额外允许的来源（逗号分隔，如 "https://ai.shu.edu.cn"）；默认只认请求自己的 Host
    allowed_origins: tuple[str, ...] = field(default_factory=tuple)
    # 状态页里需要重点标出和看日志的服务
    main_service: str = "dsh.service"
    # 状态页里磁盘占用看哪个目录
    disk_path: Path = Path("/workspace")

    session_hours: int = 12
    max_fail: int = 5
    lock_minutes: int = 10
    history_keep: int = 100
    upload_max_bytes: int = 3 * 1024 * 1024

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            o.strip().rstrip("/")
            for o in os.environ.get("CLUB_ALLOWED_ORIGINS", "").split(",")
            if o.strip()
        )
        return cls(
            data_dir=Path(os.environ.get("CLUB_DATA_DIR", "/workspace/clubdata")),
            site_dir=Path(os.environ.get("CLUB_SITE_DIR", "/workspace/club")),
            cookie_secure=_flag("CLUB_COOKIE_SECURE"),
            allowed_origins=origins,
            disk_path=Path(os.environ.get("CLUB_DISK_PATH", "/workspace")),
        )

    # ---- 派生路径 ----
    @property
    def content_path(self) -> Path:
        return self.data_dir / "content.json"

    @property
    def admins_path(self) -> Path:
        return self.data_dir / "admins.json"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "admin.db"

    @property
    def history_dir(self) -> Path:
        return self.data_dir / "history"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def static_content_js(self) -> Path:
        return self.site_dir / "shared" / "content.js"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.history_dir, self.uploads_dir):
            p.mkdir(parents=True, exist_ok=True)
