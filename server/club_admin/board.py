"""全社团公用排行榜：v17-slice-r2（切一刀，得分）和 v24-fold-r2（纸飞机，米数）。

- 数据单独放在 CLUB_DATA_DIR/board.db（SQLite），和后台的 admin.db 分开：排行榜出任何问题都碰不到后台数据。
- 公开接口：GET /api/board/<game> 取前 10 名（?me=昵称 顺带查这个昵称的名次），
  POST /api/board/<game> 提交 {"name", "score", "key"}。game 只能是 slice / fold。
- 同一个游戏里一个昵称只有一行，只留最好成绩；昵称第一次上榜时记下提交者浏览器里的随机 key（只存 sha256），
  以后别的浏览器不能再用这个昵称提交（返回 409），防止被人顶掉。
- 成绩是浏览器自己算的，服务器只能挡住明显不合理的数字，挡不住有心人伪造——这是图个乐的榜，不是比赛。
- 负责人删记录：后台「排行榜」栏，或服务器终端 python -m club_admin.cli board-rm <game> <昵称>。
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import sqlite3
import threading
import time
import unicodedata
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .settings import Settings
from .util import fmt_bj

log = logging.getLogger("club_admin.board")


@dataclass(frozen=True)
class Game:
    key: str
    label: str
    unit: str
    scale: int          # 库里存整数：成绩 × scale（米数保留 1 位小数 → ×10）
    min_score: float
    max_score: float


# 范围从两个游戏的代码推出来（见 server/README.md「排行榜」一节）：
# - slice：每切中 1 个 +1，每 5 连击 +5，一刀切 n 个 +n(n-1)，碰炸弹 −3（最低 0）。一趟会话不封顶，
#   按每秒最多 4 个物件、每个约 4 分的极限节奏玩满 1 小时约 5 万分，取 50000 封顶；0 分没意义，最少 1 分。
# - fold：simulate(power) 在 power∈[0,1] 上的落点是 0.65–20.67 米，页面四舍五入到 0.1 米 → 0.6–20.7。
GAMES: dict[str, Game] = {
    "slice": Game("slice", "切一刀（v17-slice-r2）", "分", 1, 1, 50000),
    "fold": Game("fold", "纸飞机（v24-fold-r2）", "米", 10, 0.6, 20.7),
}

NAME_MAX = 12
# 汉字（含扩展 A）、英文字母、数字、空格和 _ - · .；NFKC 规范化之后再检查，全角字母数字会先变成半角
NAME_RE = re.compile(r"^[㐀-䶿一-鿿A-Za-z0-9_\-·. ]+$")
KEY_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
BODY_LIMIT = 1024          # POST 请求体最大字节数
TOP_N = 10                 # 公开接口返回的前几名


class BoardError(ValueError):
    status = 400


class NameTaken(BoardError):
    status = 409


class RateLimited(BoardError):
    status = 429

    def __init__(self, msg: str, wait: int):
        super().__init__(msg)
        self.wait = wait


def clean_name(raw: Any) -> str:
    """规范化并校验昵称，不合格抛 BoardError（消息直接给用户看）。"""
    if not isinstance(raw, str):
        raise BoardError("请填一个昵称")
    name = " ".join(unicodedata.normalize("NFKC", raw).split())
    if not name:
        raise BoardError("请填一个昵称")
    if len(name) > NAME_MAX:
        raise BoardError(f"昵称最多 {NAME_MAX} 个字")
    if not NAME_RE.match(name):
        raise BoardError("昵称只能用汉字、字母、数字、空格和 _ - · .")
    return name


def name_key(name: str) -> str:
    return name.casefold()


def parse_score(game: Game, raw: Any) -> int:
    """校验成绩并换成库里存的整数（× scale）。"""
    if isinstance(raw, bool) or not isinstance(raw, (int, float)) or not math.isfinite(raw):
        raise BoardError("成绩应该是数字")
    scaled = raw * game.scale
    if abs(scaled - round(scaled)) > 1e-6:
        raise BoardError("成绩的小数位不对" if game.scale > 1 else "成绩应该是整数")
    v = int(round(scaled))
    if not (round(game.min_score * game.scale) <= v <= round(game.max_score * game.scale)):
        raise BoardError(f"成绩不在合理范围内（{fmt_score(game, round(game.min_score * game.scale))}–"
                         f"{fmt_score(game, round(game.max_score * game.scale))} {game.unit}）")
    return v


def fmt_score(game: Game, v: int) -> float | int:
    return v if game.scale == 1 else round(v / game.scale, 3)


def _h(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


class BoardStore:
    def __init__(self, settings: Settings, *, keep: int = 500, rate_n: int = 20, rate_window: int = 300,
                 new_names_per_day: int = 30):
        self.path = settings.data_dir / "board.db"
        self.keep = keep                        # 每个游戏最多保留几条（按名次）
        self.rate_n = rate_n                    # 同一 IP 在 rate_window 秒内最多提交几次
        self.rate_window = rate_window
        self.new_names_per_day = new_names_per_day   # 同一 IP 24 小时内最多新建几个昵称
        self._lock = threading.Lock()
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS scores(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL,
                    score INTEGER NOT NULL, owner TEXT NOT NULL, ip TEXT,
                    created REAL NOT NULL, updated REAL NOT NULL,
                    UNIQUE(game, name_key));
                CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores(game, score DESC, updated ASC);
                CREATE TABLE IF NOT EXISTS submits(
                    ip TEXT NOT NULL, ts REAL NOT NULL, new_name INTEGER NOT NULL);
                CREATE INDEX IF NOT EXISTS idx_submits_ip ON submits(ip, ts);
                """
            )

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        c = sqlite3.connect(self.path, timeout=10)
        try:
            with c:
                yield c
        finally:
            c.close()

    # ---------------------------------------------------------------- 读
    @staticmethod
    def _rank(c: sqlite3.Connection, game: str, score: int, updated: float) -> int:
        # 分高的在前；同分时先达到的在前
        return c.execute("SELECT COUNT(*) FROM scores WHERE game=? AND (score>? OR (score=? AND updated<?))",
                         (game, score, score, updated)).fetchone()[0] + 1

    def top(self, game: Game, limit: int = TOP_N) -> list[dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute("SELECT name, score, updated FROM scores WHERE game=? "
                             "ORDER BY score DESC, updated ASC LIMIT ?", (game.key, limit)).fetchall()
        return [{"rank": i + 1, "name": r[0], "score": fmt_score(game, r[1]), "time": fmt_bj(r[2])[:16]}
                for i, r in enumerate(rows)]

    def total(self, game: Game) -> int:
        with self._conn() as c:
            return c.execute("SELECT COUNT(*) FROM scores WHERE game=?", (game.key,)).fetchone()[0]

    def me(self, game: Game, name: str) -> dict[str, Any] | None:
        with self._conn() as c:
            row = c.execute("SELECT name, score, updated FROM scores WHERE game=? AND name_key=?",
                            (game.key, name_key(name))).fetchone()
            if not row:
                return None
            return {"name": row[0], "score": fmt_score(game, row[1]), "rank": self._rank(c, game.key, row[1], row[2])}

    def board(self, game: Game, me: str | None = None) -> dict[str, Any]:
        out: dict[str, Any] = {"game": game.key, "unit": game.unit, "top": self.top(game),
                               "total": self.total(game), "me": None}
        if me:
            try:
                out["me"] = self.me(game, clean_name(me))
            except BoardError:
                pass
        return out

    # ---------------------------------------------------------------- 写
    def submit(self, game: Game, raw_name: Any, raw_score: Any, raw_key: Any, ip: str) -> dict[str, Any]:
        name = clean_name(raw_name)
        score = parse_score(game, raw_score)
        if not isinstance(raw_key, str) or not KEY_RE.match(raw_key):
            raise BoardError("缺少浏览器标识，请刷新页面再试")
        owner = _h(raw_key)
        nk = name_key(name)
        now = time.time()
        with self._lock, self._conn() as c:
            n_recent = c.execute("SELECT COUNT(*), MIN(ts) FROM submits WHERE ip=? AND ts>?",
                                 (ip, now - self.rate_window)).fetchone()
            if n_recent[0] >= self.rate_n:
                wait = int(n_recent[1] + self.rate_window - now) + 1
                raise RateLimited(f"提交太频繁了，请 {max(1, math.ceil(wait / 60))} 分钟后再试", wait)
            row = c.execute("SELECT id, score, owner FROM scores WHERE game=? AND name_key=?",
                            (game.key, nk)).fetchone()
            if row and row[2] != owner:
                raise NameTaken(f"「{name}」这个昵称已经有人用了，换一个吧")
            if not row:
                made = c.execute("SELECT COUNT(*), MIN(ts) FROM submits WHERE ip=? AND ts>? AND new_name=1",
                                 (ip, now - 86400)).fetchone()
                if made[0] >= self.new_names_per_day:
                    wait = int(made[1] + 86400 - now) + 1
                    raise RateLimited("这个网络今天新起的昵称太多了，明天再来吧", wait)
            c.execute("INSERT INTO submits VALUES (?,?,?)", (ip, now, 0 if row else 1))
            c.execute("DELETE FROM submits WHERE ts < ?", (now - 86400,))
            improved = False
            if not row:
                c.execute("INSERT INTO scores(game,name,name_key,score,owner,ip,created,updated) "
                          "VALUES (?,?,?,?,?,?,?,?)", (game.key, name, nk, score, owner, ip, now, now))
                improved = True
            elif score > row[1]:
                c.execute("UPDATE scores SET score=?, name=?, ip=?, updated=? WHERE id=?",
                          (score, name, ip, now, row[0]))
                improved = True
            # 每个游戏只留前 keep 名
            c.execute("DELETE FROM scores WHERE game=? AND id NOT IN "
                      "(SELECT id FROM scores WHERE game=? ORDER BY score DESC, updated ASC LIMIT ?)",
                      (game.key, game.key, self.keep))
            cur = c.execute("SELECT name, score, updated FROM scores WHERE game=? AND name_key=?",
                            (game.key, nk)).fetchone()
            me = None
            if cur:
                me = {"name": cur[0], "score": fmt_score(game, cur[1]), "rank": self._rank(c, game.key, cur[1], cur[2])}
        out = self.board(game)
        out.update({"ok": True, "improved": improved, "me": me, "kept": self.keep})
        return out

    # ---------------------------------------------------------------- 管理
    def admin_list(self, game: Game, limit: int = 200) -> list[dict[str, Any]]:
        with self._conn() as c:
            rows = c.execute("SELECT id, name, score, ip, created, updated FROM scores WHERE game=? "
                             "ORDER BY score DESC, updated ASC LIMIT ?", (game.key, limit)).fetchall()
        return [{"id": r[0], "rank": i + 1, "name": r[1], "score": fmt_score(game, r[2]), "ip": r[3] or "",
                 "created": fmt_bj(r[4]), "updated": fmt_bj(r[5])} for i, r in enumerate(rows)]

    def delete_id(self, game: Game, row_id: int) -> dict[str, Any] | None:
        with self._lock, self._conn() as c:
            row = c.execute("SELECT name, score FROM scores WHERE game=? AND id=?", (game.key, row_id)).fetchone()
            if not row:
                return None
            c.execute("DELETE FROM scores WHERE id=?", (row_id,))
        return {"name": row[0], "score": fmt_score(game, row[1])}

    def delete_name(self, game: Game, name: str) -> dict[str, Any] | None:
        nk = name_key(" ".join(unicodedata.normalize("NFKC", name).split()))
        with self._lock, self._conn() as c:
            row = c.execute("SELECT id FROM scores WHERE game=? AND name_key=?", (game.key, nk)).fetchone()
        return self.delete_id(game, row[0]) if row else None


# -------------------------------------------------------------------- HTTP（公开接口）
def install(app: Any, settings: Settings | None = None) -> BoardStore:
    """把公开的排行榜接口接到 FastAPI 应用上。必须在挂载静态目录之前调用。"""
    from .web import _client_ip, _origin_ok, _read_limited

    s = settings or Settings.from_env()
    store = BoardStore(s)
    r = APIRouter()
    headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}

    def resp(data: Any, status: int = 200, extra: dict[str, str] | None = None) -> JSONResponse:
        return JSONResponse(data, status_code=status, headers={**headers, **(extra or {})})

    def game_of(key: str) -> Game:
        g = GAMES.get(key)
        if g is None:
            raise HTTPException(404, "没有这个游戏")
        return g

    @r.get("/api/board/{game}", include_in_schema=False)
    def get_board(game: str, me: str | None = None) -> JSONResponse:
        g = game_of(game)
        return resp(store.board(g, me[:64] if me else None))

    @r.post("/api/board/{game}", include_in_schema=False)
    async def post_board(game: str, request: Request) -> JSONResponse:
        g = game_of(game)
        if not _origin_ok(request, s):
            return resp({"detail": "来源校验失败（疑似跨站请求）"}, 403)
        ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype != "application/json":
            return resp({"detail": "需要 application/json"}, 415)
        raw = await _read_limited(request, BODY_LIMIT)
        try:
            body = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            return resp({"detail": "JSON 格式不对"}, 400)
        if not isinstance(body, dict):
            return resp({"detail": "请求体应该是对象"}, 400)
        try:
            out = store.submit(g, body.get("name"), body.get("score"), body.get("key"), _client_ip(request))
        except RateLimited as exc:
            return resp({"detail": str(exc)}, 429, {"Retry-After": str(exc.wait)})
        except BoardError as exc:
            return resp({"detail": str(exc)}, exc.status)
        return resp(out)

    app.include_router(r)
    log.info("排行榜已加载：%s", store.path)
    return store
