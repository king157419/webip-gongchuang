"""内容读写：content.json、历史版本、生成 content.js、出错兜底。"""
from __future__ import annotations

import copy
import hashlib
import json
import logging
import re
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .schema import SECTION_KEYS, SECTION_LABELS, ValidationFailed, validate_content
from .settings import Settings
from .util import atomic_write_bytes, dump_json, fmt_bj, now_bj

log = logging.getLogger("club_admin")

HISTORY_RE = re.compile(r"^(\d{8}-\d{6})-([A-Za-z0-9_.]{1,40}?)(?:-(\d+))?\.json$")


class Conflict(Exception):
    """别人先保存了，base_version 对不上。"""


def version_of(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()[:16]


def render_js(data: Any) -> bytes:
    body = json.dumps(data, ensure_ascii=False, indent=1)
    # JSON 是 JS 的子集；U+2028/2029 在老引擎里不能出现在字符串里，转义掉更稳
    body = body.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    head = "/* 由管理后台从 content.json 生成，修改请到 /admin/ */\n"
    return (head + "window.CLUB = " + body + ";\n").encode("utf-8")


@dataclass
class JsPayload:
    body: bytes
    etag: str
    source: str  # current / last-good / history:<name> / static / empty


class ContentStore:
    def __init__(self, settings: Settings):
        self.s = settings
        self._lock = threading.RLock()
        self._last_good: JsPayload | None = None
        self._stamp: tuple[int, int] | None = None  # (mtime_ns, size)

    # ------------------------------------------------------------------ 读
    def read_current(self) -> tuple[dict[str, Any], str]:
        """读出当前内容和版本号；文件坏了抛异常（后台编辑时必须知道）。"""
        raw = self.s.content_path.read_bytes()
        data = json.loads(raw.decode("utf-8"))
        errs = validate_content(data)
        if errs:
            raise ValidationFailed(errs)
        return data, version_of(raw)

    def exists(self) -> bool:
        return self.s.content_path.is_file()

    # ------------------------------------------------------------------ 公开 content.js
    def public_js(self) -> JsPayload:
        """给官网用：任何情况下都尽量返回一份能用的 content.js，绝不抛异常。"""
        with self._lock:
            try:
                st = self.s.content_path.stat()
                stamp = (st.st_mtime_ns, st.st_size)
            except OSError:
                stamp = None
            if stamp is not None and stamp == self._stamp and self._last_good and self._last_good.source == "current":
                return self._last_good
            if stamp is not None:
                try:
                    data, _ = self.read_current()
                    body = render_js(data)
                    self._last_good = JsPayload(body, '"' + version_of(body) + '"', "current")
                    self._stamp = stamp
                    return self._last_good
                except Exception as exc:  # 文件损坏：用上一份好的
                    if self._stamp != stamp:
                        log.error("content.json 无法使用（%s），官网改用备用内容", exc)
                    self._stamp = stamp
            if self._last_good is not None:
                return JsPayload(self._last_good.body, self._last_good.etag, "last-good")
            fb = self._fallback_from_history() or self._fallback_static()
            if fb is not None:
                self._last_good = fb
                return fb
            body = b"/* content unavailable */\nwindow.CLUB = window.CLUB || null;\n"
            return JsPayload(body, '"' + version_of(body) + '"', "empty")

    def _fallback_from_history(self) -> JsPayload | None:
        for p in self._history_files():
            try:
                data = json.loads(p.read_bytes().decode("utf-8"))
                if validate_content(data):
                    continue
                body = render_js(data)
                return JsPayload(body, '"' + version_of(body) + '"', "history:" + p.name)
            except Exception:
                continue
        return None

    def _fallback_static(self) -> JsPayload | None:
        try:
            body = self.s.static_content_js.read_bytes()
        except OSError:
            return None
        return JsPayload(body, '"' + version_of(body) + '"', "static")

    # ------------------------------------------------------------------ 写
    def save(self, data: dict[str, Any], user: str, base_version: str | None) -> str:
        """整份保存。先校验，再备份旧版本，再原子写入。返回新版本号。"""
        errs = validate_content(data)
        if errs:
            raise ValidationFailed(errs)
        new_raw = dump_json(data)
        with self._lock:
            old_raw: bytes | None = None
            if self.s.content_path.is_file():
                old_raw = self.s.content_path.read_bytes()
                if base_version is not None and version_of(old_raw) != base_version:
                    raise Conflict()
                if old_raw == new_raw:
                    return version_of(old_raw)
                self._backup(old_raw, user)
            atomic_write_bytes(self.s.content_path, new_raw)
            self._prune()
            return version_of(new_raw)

    def save_section(self, key: str, value: Any, user: str, base_version: str | None) -> str:
        with self._lock:
            data, _ = self.read_current()
            data = copy.deepcopy(data)
            data[key] = value
            return self.save(data, user, base_version)

    def import_initial(self, data: dict[str, Any], user: str = "cli") -> str:
        return self.save(data, user, None)

    # ------------------------------------------------------------------ 历史
    def _backup(self, raw: bytes, user: str) -> Path:
        self.s.history_dir.mkdir(parents=True, exist_ok=True)
        ts = now_bj().strftime("%Y%m%d-%H%M%S")
        safe_user = re.sub(r"[^A-Za-z0-9_.]", "_", user)[:40] or "unknown"
        # 同一秒内多次保存：序号取这一秒已有文件的最大序号 + 1（不论是谁存的），保证排序和不覆盖
        seqs = [int(m.group(3) or 1) for q in self.s.history_dir.iterdir()
                if (m := HISTORY_RE.match(q.name)) and m.group(1) == ts]
        n = max(seqs) + 1 if seqs else 1
        p = self.s.history_dir / (f"{ts}-{safe_user}.json" if n == 1 else f"{ts}-{safe_user}-{n}.json")
        atomic_write_bytes(p, raw)
        return p

    def _history_files(self) -> list[Path]:
        d = self.s.history_dir
        if not d.is_dir():
            return []
        files = [p for p in d.iterdir() if p.is_file() and HISTORY_RE.match(p.name)]
        # 文件名以时间戳开头；同一秒内多份按序号排
        def key(p: Path) -> tuple[str, int]:
            m = HISTORY_RE.match(p.name)
            assert m
            return (m.group(1), int(m.group(3) or 1))
        return sorted(files, key=key, reverse=True)

    def _prune(self) -> None:
        for p in self._history_files()[self.s.history_keep:]:
            try:
                p.unlink()
            except OSError:
                pass

    def history_path(self, name: str) -> Path:
        if not HISTORY_RE.match(name):
            raise FileNotFoundError(name)
        p = self.s.history_dir / name
        if p.resolve().parent != self.s.history_dir.resolve() or not p.is_file():
            raise FileNotFoundError(name)
        return p

    def list_history(self) -> list[dict[str, Any]]:
        out = []
        for p in self._history_files():
            m = HISTORY_RE.match(p.name)
            assert m
            ts = m.group(1)
            when = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[9:11]}:{ts[11:13]}:{ts[13:15]}"
            out.append({"name": p.name, "time": when, "user": m.group(2), "size": p.stat().st_size})
        return out

    def read_history(self, name: str) -> dict[str, Any]:
        return json.loads(self.history_path(name).read_bytes().decode("utf-8"))

    def restore(self, name: str, user: str, base_version: str | None) -> str:
        data = self.read_history(name)
        return self.save(data, user, base_version)


# ---------------------------------------------------------------------- 差异摘要
def _item_label(item: Any) -> str:
    if isinstance(item, dict):
        for k in ("title", "name", "text", "t", "q", "id"):
            v = item.get(k)
            if isinstance(v, str) and v:
                return v if len(v) <= 40 else v[:40] + "…"
    return json.dumps(item, ensure_ascii=False)[:40]


def _diff_list(path: str, old: list, new: list, out: list[str]) -> None:
    old_l = [json.dumps(x, ensure_ascii=False, sort_keys=True) for x in old]
    new_l = [json.dumps(x, ensure_ascii=False, sort_keys=True) for x in new]
    old_set, new_set = set(old_l), set(new_l)
    added = [i for i, s in enumerate(new_l) if s not in old_set]     # new 里的下标
    removed = [i for i, s in enumerate(old_l) if s not in new_set]   # old 里的下标
    changed: list[str] = []
    # 先按标题配对（标题没变、其他字段改了），再按位置配对（改了标题）
    for i in list(added):
        lab = _item_label(new[i])
        j = next((j for j in removed if _item_label(old[j]) == lab), None)
        if j is not None:
            changed.append(f"修改「{lab}」")
            added.remove(i)
            removed.remove(j)
    for i in list(added):
        if i in removed:
            a, b = _item_label(old[i]), _item_label(new[i])
            changed.append(f"修改「{a}」→「{b}」")
            added.remove(i)
            removed.remove(i)
    lines = ([f"新增「{_item_label(new[i])}」" for i in added] + [f"删除「{_item_label(old[j])}」" for j in removed]
             + changed)
    for ln in lines[:12]:
        out.append(f"{path}：{ln}")
    if len(lines) > 12:
        out.append(f"{path}：另有 {len(lines) - 12} 处变化")
    if not lines and old_l != new_l:
        out.append(f"{path}：调整了顺序")
    if len(old) != len(new):
        out.append(f"{path}：条数 {len(old)} → {len(new)}")


def _diff(path: str, old: Any, new: Any, out: list[str]) -> None:
    if old == new:
        return
    if isinstance(old, dict) and isinstance(new, dict):
        for k in list(old) + [k for k in new if k not in old]:
            _diff(f"{path}.{k}", old.get(k), new.get(k), out)
    elif isinstance(old, list) and isinstance(new, list) and all(isinstance(x, dict) for x in old + new):
        _diff_list(path, old, new, out)
    else:
        def short(v: Any) -> str:
            s = json.dumps(v, ensure_ascii=False)
            return s if len(s) <= 30 else s[:30] + "…"
        out.append(f"{path}：{short(old)} → {short(new)}")


def diff_summary(old: dict[str, Any], new: dict[str, Any]) -> dict[str, Any]:
    """old → new 的人话摘要，按栏目分组。"""
    sections = []
    for k in SECTION_KEYS:
        lines: list[str] = []
        _diff(SECTION_LABELS[k], old.get(k) if isinstance(old, dict) else None,
              new.get(k) if isinstance(new, dict) else None, lines)
        if lines:
            sections.append({"key": k, "label": SECTION_LABELS[k], "lines": lines[:30]})
    return {"same": not sections, "sections": sections}


def changed_sections(old: dict[str, Any], new: dict[str, Any]) -> list[str]:
    return [k for k in SECTION_KEYS if old.get(k) != new.get(k)]


__all__ = ["ContentStore", "Conflict", "render_js", "version_of", "diff_summary", "changed_sections", "fmt_bj"]
