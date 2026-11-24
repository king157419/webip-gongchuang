"""管理员账号（admins.json）、会话、登录限流、操作记录（SQLite admin.db）。

- 密码：hashlib.scrypt 加随机盐，格式 scrypt$n$r$p$salt$hash（base64）。
- 会话 token 只把 sha256 存进数据库，数据库泄露也拿不到可用的 Cookie。
- 管理员只能用 `python -m club_admin.cli` 在服务器终端维护，网页上没有创建入口。
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from typing import Any, Iterator

from .settings import Settings
from .util import atomic_write_json, fmt_bj

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{2,32}$")
PASSWORD_MIN = 10
PASSWORD_MAX = 256

_SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode("utf-8"), salt=salt, dklen=32, maxmem=64 * 1024 * 1024, **_SCRYPT)
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, dk = stored.split("$")
        if algo != "scrypt":
            return False
        expect = base64.b64decode(dk)
        got = hashlib.scrypt(password.encode("utf-8"), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p),
                             dklen=len(expect), maxmem=64 * 1024 * 1024)
        return hmac.compare_digest(got, expect)
    except Exception:
        return False


# 用户不存在时也算一次哈希，避免靠响应时间猜用户名
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def check_password_strength(pw: str) -> str | None:
    if len(pw) < PASSWORD_MIN:
        return f"密码至少 {PASSWORD_MIN} 位"
    if len(pw) > PASSWORD_MAX:
        return "密码太长"
    return None


class AdminStore:
    """admins.json：{"users": {"name": {"hash": ..., "created": ..., "updated": ...}}}"""

    def __init__(self, settings: Settings):
        self.s = settings
        self._lock = threading.Lock()

    def _load(self) -> dict[str, Any]:
        try:
            data = json.loads(self.s.admins_path.read_text("utf-8"))
            if isinstance(data, dict) and isinstance(data.get("users"), dict):
                return data
        except FileNotFoundError:
            pass
        except (OSError, ValueError):
            # 文件损坏时不让任何人登录，比放行安全
            return {"users": {}, "_broken": True}
        return {"users": {}}

    def users(self) -> dict[str, Any]:
        return self._load()["users"]

    def exists(self, name: str) -> bool:
        return name in self.users()

    def verify(self, name: str, password: str) -> bool:
        user = self.users().get(name) if USERNAME_RE.match(name or "") else None
        if not user or len(password) > PASSWORD_MAX:
            verify_password(password[:PASSWORD_MAX], _DUMMY_HASH)
            return False
        return verify_password(password, user.get("hash", ""))

    def set_password(self, name: str, password: str, *, create: bool) -> None:
        if not USERNAME_RE.match(name):
            raise ValueError("用户名只能用字母、数字、_ 和 .，2–32 位")
        err = check_password_strength(password)
        if err:
            raise ValueError(err)
        with self._lock:
            data = self._load()
            if data.get("_broken"):
                raise RuntimeError(f"{self.s.admins_path} 已损坏，请先手工修复或删除")
            users = data["users"]
            now = time.time()
            if create and name in users:
                raise ValueError(f"管理员 {name} 已存在，改密码用 passwd")
            if not create and name not in users:
                raise ValueError(f"管理员 {name} 不存在")
            entry = users.get(name, {"created": now})
            entry["hash"] = hash_password(password)
            entry["updated"] = now
            users[name] = entry
            self.s.data_dir.mkdir(parents=True, exist_ok=True)
            atomic_write_json(self.s.admins_path, {"users": users})

    def remove(self, name: str) -> None:
        with self._lock:
            data = self._load()
            if name not in data["users"]:
                raise ValueError(f"管理员 {name} 不存在")
            del data["users"][name]
            atomic_write_json(self.s.admins_path, {"users": data["users"]})


class AdminDB:
    """SQLite：sessions / login_failures / audit。每次操作开一个连接，线程安全也简单。"""

    def __init__(self, settings: Settings):
        self.s = settings
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions(
                    token_hash TEXT PRIMARY KEY, user TEXT NOT NULL,
                    created REAL NOT NULL, expires REAL NOT NULL, ip TEXT);
                CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user);
                CREATE TABLE IF NOT EXISTS login_failures(
                    ip TEXT PRIMARY KEY, count INTEGER NOT NULL, last REAL NOT NULL, locked_until REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS audit(
                    id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL NOT NULL, user TEXT NOT NULL,
                    action TEXT NOT NULL, section TEXT, detail TEXT, ip TEXT);
                """
            )

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        c = sqlite3.connect(self.s.db_path, timeout=10)
        try:
            with c:
                yield c
        finally:
            c.close()

    # ---------------- 会话
    @staticmethod
    def _h(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    def create_session(self, user: str, ip: str) -> tuple[str, float]:
        token = secrets.token_urlsafe(32)
        now = time.time()
        expires = now + self.s.session_hours * 3600
        with self._conn() as c:
            c.execute("DELETE FROM sessions WHERE expires < ?", (now,))
            c.execute("INSERT INTO sessions VALUES (?,?,?,?,?)", (self._h(token), user, now, expires, ip))
        return token, expires

    def session_user(self, token: str | None) -> tuple[str, float] | None:
        if not token or len(token) > 200:
            return None
        with self._conn() as c:
            row = c.execute("SELECT user, expires FROM sessions WHERE token_hash=?", (self._h(token),)).fetchone()
        if not row or row[1] < time.time():
            return None
        return row[0], row[1]

    def delete_session(self, token: str | None) -> None:
        if token:
            with self._conn() as c:
                c.execute("DELETE FROM sessions WHERE token_hash=?", (self._h(token),))

    def delete_user_sessions(self, user: str) -> int:
        with self._conn() as c:
            return c.execute("DELETE FROM sessions WHERE user=?", (user,)).rowcount

    # ---------------- 限流：同一 IP 连续失败 max_fail 次锁 lock_minutes 分钟
    def locked_for(self, ip: str) -> int:
        with self._conn() as c:
            row = c.execute("SELECT locked_until FROM login_failures WHERE ip=?", (ip,)).fetchone()
        if row and row[0] > time.time():
            return int(row[0] - time.time()) + 1
        return 0

    def record_failure(self, ip: str) -> int:
        """记一次失败，返回锁定秒数（0 表示还没锁）。"""
        now = time.time()
        with self._conn() as c:
            row = c.execute("SELECT count, locked_until FROM login_failures WHERE ip=?", (ip,)).fetchone()
            count = 1
            if row:
                # 上一轮锁定已结束：重新计数
                count = 1 if (row[1] and row[1] <= now) else row[0] + 1
            locked = now + self.s.lock_minutes * 60 if count >= self.s.max_fail else 0
            c.execute("INSERT OR REPLACE INTO login_failures VALUES (?,?,?,?)", (ip, count, now, locked))
        return int(locked - now) if locked else 0

    def clear_failures(self, ip: str) -> None:
        with self._conn() as c:
            c.execute("DELETE FROM login_failures WHERE ip=?", (ip,))

    # ---------------- 操作记录
    def audit(self, user: str, action: str, section: str | None = None, detail: str = "", ip: str = "") -> None:
        with self._conn() as c:
            c.execute("INSERT INTO audit(ts,user,action,section,detail,ip) VALUES (?,?,?,?,?,?)",
                      (time.time(), user, action, section, detail[:2000], ip))
            # 只留最近 5000 条
            c.execute("DELETE FROM audit WHERE id <= (SELECT MAX(id) FROM audit) - 5000")

    def audit_list(self, limit: int = 200) -> list[dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute("SELECT ts,user,action,section,detail,ip FROM audit ORDER BY id DESC LIMIT ?",
                             (limit,)).fetchall()
        return [{"time": fmt_bj(r[0]), "user": r[1], "action": r[2], "section": r[3], "detail": r[4], "ip": r[5]}
                for r in rows]
