"""小工具：北京时间、原子写文件。"""
from __future__ import annotations

import json
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# 中国不实行夏令时，固定 +8 即可，不依赖 tzdata
BEIJING = timezone(timedelta(hours=8), "北京时间")


def now_bj() -> datetime:
    return datetime.now(BEIJING)


def fmt_bj(ts: float | datetime) -> str:
    if isinstance(ts, (int, float)):
        dt = datetime.fromtimestamp(ts, BEIJING)
    else:
        dt = ts.astimezone(BEIJING)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def atomic_write_bytes(path: Path, data: bytes) -> None:
    """先写同目录临时文件再 os.replace，写一半断电也不会留下半个文件。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="." + path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def dump_json(obj: Any) -> bytes:
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def atomic_write_json(path: Path, obj: Any) -> None:
    atomic_write_bytes(path, dump_json(obj))
