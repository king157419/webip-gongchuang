"""图片上传：只看文件内容的魔数判断类型，不信任文件名和浏览器给的类型；随机文件名。"""
from __future__ import annotations

import re
import secrets
from pathlib import Path

from .settings import Settings
from .util import atomic_write_bytes

NAME_RE = re.compile(r"^[0-9a-f]{32}\.(?:jpg|png|webp)$")
MEDIA_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


class UploadRejected(ValueError):
    pass


def sniff(data: bytes) -> str | None:
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def save_upload(settings: Settings, data: bytes) -> str:
    if not data:
        raise UploadRejected("文件是空的")
    if len(data) > settings.upload_max_bytes:
        raise UploadRejected(f"图片不能超过 {settings.upload_max_bytes // (1024 * 1024)} MB")
    ext = sniff(data)
    if ext is None:
        raise UploadRejected("只支持 JPG、PNG、WebP 图片")
    name = f"{secrets.token_hex(16)}.{ext}"
    atomic_write_bytes(settings.uploads_dir / name, data)
    return name


def upload_path(settings: Settings, name: str) -> Path | None:
    if not NAME_RE.match(name):
        return None
    p = settings.uploads_dir / name
    return p if p.is_file() else None
