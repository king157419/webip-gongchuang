"""全社团排行榜：BoardStore、公开接口 /api/board/<game>、后台的看/删、命令行、serve.py 接入与容错。"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from conftest import FAKEAPP, ORIGIN, SERVER_DIR, W, login

from club_admin.board import GAMES, BoardError, BoardStore, NameTaken, RateLimited, clean_name, parse_score

KEY_A = "a" * 24
KEY_B = "b" * 24
SLICE, FOLD = GAMES["slice"], GAMES["fold"]


# ---------------------------------------------------------------------- 纯函数
@pytest.mark.parametrize("raw,want", [
    ("小明", "小明"), ("  Tom  Lee ", "Tom Lee"), ("ＡＢＣ１２", "ABC12"), ("a_b-c·d.e", "a_b-c·d.e"),
    ("一二三四五六七八九十一二", "一二三四五六七八九十一二"),
])
def test_clean_name_ok(raw, want):
    assert clean_name(raw) == want


@pytest.mark.parametrize("raw", ["", "   ", None, 123, "一二三四五六七八九十一二三", "<script>", "a​b", "x\x00y", "😀", "a/b",
                                 "\"q\"", "名字&"])
def test_clean_name_rejects(raw):
    with pytest.raises(BoardError):
        clean_name(raw)


def test_parse_score():
    assert parse_score(SLICE, 1) == 1
    assert parse_score(SLICE, 50000) == 50000
    assert parse_score(SLICE, 12.0) == 12
    assert parse_score(FOLD, 20.7) == 207
    assert parse_score(FOLD, 0.6) == 6
    assert parse_score(FOLD, 13.3) == 133
    for bad in (0, -1, 50001, 1.5, True, "12", None, float("nan"), float("inf")):
        with pytest.raises(BoardError):
            parse_score(SLICE, bad)
    for bad in (0.5, 20.8, 12.34, 100, "3"):
        with pytest.raises(BoardError):
            parse_score(FOLD, bad)


# ---------------------------------------------------------------------- BoardStore
@pytest.fixture
def store(settings):
    return BoardStore(settings, keep=5, rate_n=100, new_names_per_day=100)


def test_best_only_and_rank(store):
    r = store.submit(SLICE, "小明", 10, KEY_A, "1.1.1.1")
    assert r["improved"] and r["me"] == {"name": "小明", "score": 10, "rank": 1}
    r = store.submit(SLICE, "小红", 30, KEY_B, "1.1.1.2")
    assert r["me"]["rank"] == 1
    r = store.submit(SLICE, "小明", 5, KEY_A, "1.1.1.1")         # 更低：不覆盖
    assert not r["improved"] and r["me"]["score"] == 10 and r["me"]["rank"] == 2
    r = store.submit(SLICE, "小明", 40, KEY_A, "1.1.1.1")        # 更高：刷新
    assert r["improved"] and r["me"] == {"name": "小明", "score": 40, "rank": 1}
    assert [t["name"] for t in r["top"]] == ["小明", "小红"] and r["total"] == 2
    # 两个游戏互不影响；米数按 1 位小数返回
    r = store.submit(FOLD, "小明", 12.3, KEY_A, "1.1.1.1")
    assert r["me"]["score"] == 12.3 and r["total"] == 1


def test_same_score_earlier_first(store):
    store.submit(FOLD, "早", 20.7, KEY_A, "ip")
    store.submit(FOLD, "晚", 20.7, KEY_B, "ip")
    assert [t["name"] for t in store.top(FOLD)] == ["早", "晚"]
    assert store.me(FOLD, "晚")["rank"] == 2


def test_name_owned_by_first_browser(store):
    store.submit(SLICE, "Tom", 10, KEY_A, "ip")
    with pytest.raises(NameTaken):
        store.submit(SLICE, "tom", 99, KEY_B, "ip")        # 大小写不同也算同一个昵称
    assert store.me(SLICE, "TOM")["score"] == 10


def test_keep_limit(store):
    for i in range(8):
        store.submit(SLICE, f"p{i}", i + 1, "k" * 16 + str(i), "ip")
    assert store.total(SLICE) == 5
    assert [t["score"] for t in store.top(SLICE)] == [8, 7, 6, 5, 4]
    r = store.submit(SLICE, "low", 1, KEY_A, "ip")          # 挤不进前 5：存不下，me 为 None
    assert r["me"] is None and store.total(SLICE) == 5


def test_rate_limit(settings):
    st = BoardStore(settings, rate_n=3, rate_window=300, new_names_per_day=100)
    for i in range(3):
        st.submit(SLICE, "a", i + 1, KEY_A, "9.9.9.9")
    with pytest.raises(RateLimited) as ei:
        st.submit(SLICE, "a", 9, KEY_A, "9.9.9.9")
    assert 0 < ei.value.wait <= 301
    st.submit(SLICE, "b", 9, KEY_B, "8.8.8.8")              # 别的 IP 不受影响


def test_new_name_limit(settings):
    st = BoardStore(settings, rate_n=100, new_names_per_day=2)
    st.submit(SLICE, "n1", 1, KEY_A, "ip")
    st.submit(SLICE, "n2", 1, KEY_A, "ip")
    with pytest.raises(RateLimited):
        st.submit(SLICE, "n3", 1, KEY_A, "ip")
    st.submit(SLICE, "n1", 5, KEY_A, "ip")                  # 老昵称刷新成绩不受影响


def test_bad_key(store):
    for k in (None, "short", "x" * 65, "有中文的key有中文的key有中文的key"):
        with pytest.raises(BoardError):
            store.submit(SLICE, "a", 1, k, "ip")


def test_delete(store):
    store.submit(SLICE, "坏名字", 5, KEY_A, "ip")
    assert store.delete_name(SLICE, "坏名字") == {"name": "坏名字", "score": 5}
    assert store.delete_name(SLICE, "坏名字") is None
    store.submit(SLICE, "x", 5, KEY_A, "ip")
    rid = store.admin_list(SLICE)[0]["id"]
    assert store.delete_id(FOLD, rid) is None              # 游戏对不上不删
    assert store.delete_id(SLICE, rid)["name"] == "x"
    assert store.total(SLICE) == 0


# ---------------------------------------------------------------------- 公开接口
@pytest.fixture
def board_client(settings):
    from club_admin.board import install
    app = FastAPI()
    st = install(app, settings)
    st.rate_n = 4
    with TestClient(app, base_url=ORIGIN) as c:
        c.store = st
        yield c


def post(c, game, body, headers=W, **kw):
    return c.post(f"/api/board/{game}", json=body, headers=headers, **kw)


def test_api_flow(board_client):
    c = board_client
    r = c.get("/api/board/slice")
    assert r.status_code == 200 and r.json() == {"game": "slice", "unit": "分", "top": [], "total": 0, "me": None}
    assert r.headers["cache-control"] == "no-store"
    r = post(c, "slice", {"name": "<b>x</b>", "score": 3, "key": KEY_A})
    assert r.status_code == 400 and "昵称" in r.json()["detail"]
    r = post(c, "slice", {"name": "小明", "score": 999999, "key": KEY_A})
    assert r.status_code == 400 and "范围" in r.json()["detail"]
    r = post(c, "slice", {"name": "小明", "score": 21, "key": KEY_A})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ok"] and d["improved"] and d["me"]["rank"] == 1 and d["top"][0]["name"] == "小明"
    r = c.get("/api/board/slice", params={"me": "小明"})
    assert r.json()["me"] == {"name": "小明", "score": 21, "rank": 1}
    assert c.get("/api/board/slice", params={"me": "<bad>"}).json()["me"] is None
    r = post(c, "slice", {"name": "小明", "score": 25, "key": KEY_B})
    assert r.status_code == 409
    r = post(c, "fold", {"name": "小明", "score": 12.3, "key": KEY_A})
    assert r.status_code == 200 and r.json()["me"]["score"] == 12.3
    # rate_n=4：校验没过、昵称被占的不计数；这是第 3、4 次，第 5 次 → 429
    for s in (30, 31):
        assert post(c, "slice", {"name": "小明", "score": s, "key": KEY_A}).status_code == 200
    r = post(c, "slice", {"name": "小明", "score": 32, "key": KEY_A})
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0


def test_api_rejects(board_client):
    c = board_client
    assert c.get("/api/board/tetris").status_code == 404
    assert post(c, "tetris", {"name": "a", "score": 1, "key": KEY_A}).status_code == 404
    ok = {"name": "a", "score": 1, "key": KEY_A}
    assert post(c, "slice", ok, headers={}).status_code == 403                         # 没有 Origin/Referer
    assert post(c, "slice", ok, headers={"Origin": "http://evil.example"}).status_code == 403
    assert post(c, "slice", ok, headers={"Referer": "http://testserver/v17-slice-r2/"}).status_code == 200
    r = c.post("/api/board/slice", content=json.dumps(ok), headers={**W, "Content-Type": "text/plain"})
    assert r.status_code == 415
    r = c.post("/api/board/slice", content="x" * 2000, headers={**W, "Content-Type": "application/json"})
    assert r.status_code == 413
    r = c.post("/api/board/slice", content="[1]", headers={**W, "Content-Type": "application/json"})
    assert r.status_code == 400
    r = c.post("/api/board/slice", content="{bad", headers={**W, "Content-Type": "application/json"})
    assert r.status_code == 400
    assert post(c, "slice", {"name": "a", "score": 1}).status_code == 400              # 缺 key
    assert c.put("/api/board/slice", json=ok, headers=W).status_code == 405


# ---------------------------------------------------------------------- 后台
def test_admin_board(app_state):
    from club_admin.board import install
    app, state = app_state
    install(app, state.s)
    with TestClient(app, base_url=ORIGIN) as c:
        assert c.get("/admin/api/board").status_code == 401
        assert c.delete("/admin/api/board/slice/1", headers=W).status_code in (401, 403)
        post(c, "slice", {"name": "脏话", "score": 7, "key": KEY_A})
        assert login(c).status_code == 200
        games = c.get("/admin/api/board").json()["games"]
        assert [g["key"] for g in games] == ["slice", "fold"] and games[0]["total"] == 1
        items = c.get("/admin/api/board/slice").json()["items"]
        assert items[0]["name"] == "脏话" and items[0]["ip"]
        rid = items[0]["id"]
        assert c.delete(f"/admin/api/board/slice/{rid}").status_code == 403              # 没有同源头
        assert c.delete(f"/admin/api/board/slice/{rid}", headers=W).status_code == 200
        assert c.delete(f"/admin/api/board/slice/{rid}", headers=W).status_code == 404
        assert c.get("/admin/api/board/nope").status_code == 404
        assert c.get("/api/board/slice").json()["total"] == 0
        audit = c.get("/admin/api/audit").json()["items"]
        assert audit[0]["action"] == "删除排行榜记录" and "脏话" in audit[0]["detail"]
        # 后台页面带了排行榜入口
        assert 'data-route="board"' in c.get("/admin/").text


# ---------------------------------------------------------------------- 命令行
def test_cli_board(settings, monkeypatch, capsys):
    from club_admin import cli
    monkeypatch.setenv("CLUB_DATA_DIR", str(settings.data_dir))
    BoardStore(settings).submit(FOLD, "坏昵称", 9.9, KEY_A, "1.2.3.4")
    assert cli.main(["board-list", "fold"]) == 0
    out = capsys.readouterr().out
    assert "坏昵称" in out and "9.9 米" in out and "1.2.3.4" in out
    assert cli.main(["board-rm", "fold", "坏昵称"]) == 0
    assert cli.main(["board-rm", "fold", "坏昵称"]) == 1
    assert BoardStore(settings).total(FOLD) == 0


# ---------------------------------------------------------------------- serve.py 接入与容错
SCRIPT = r"""
import json
from fastapi.testclient import TestClient
import serve
c = TestClient(serve.app, base_url="http://testserver")
out = {}
r = c.get("/api/board/fold"); out["get"] = r.status_code
r = c.post("/api/board/fold", json={"name": "小明", "score": 8.8, "key": "k" * 20}, headers={"Origin": "http://testserver"})
out["post"] = [r.status_code, (r.json().get("me") or {}).get("rank") if r.status_code == 200 else None]
r = c.get("/v5-zhi/"); out["v5"] = r.status_code
r = c.get("/admin/"); out["admin"] = r.status_code
print("RESULT" + json.dumps(out))
"""


def run(tmp_path: Path, site_dir: Path, data_dir: Path) -> dict:
    env = dict(os.environ)
    env.update({"CLUB_SITE_DIR": str(site_dir), "CLUB_DATA_DIR": str(data_dir),
                "PYTHONPATH": os.pathsep.join([str(SERVER_DIR), str(FAKEAPP)]), "PYTHONIOENCODING": "utf-8"})
    p = subprocess.run([sys.executable, "-c", SCRIPT], cwd=str(tmp_path), env=env, capture_output=True, timeout=120)
    assert p.returncode == 0, p.stderr.decode("utf-8", "replace")[-3000:]
    line = next(ln for ln in p.stdout.decode("utf-8", "replace").splitlines() if ln.startswith("RESULT"))
    return json.loads(line[len("RESULT"):])


def test_serve_has_board(tmp_path, site_dir):
    res = run(tmp_path, site_dir, tmp_path / "clubdata")
    assert res == {"get": 200, "post": [200, 1], "v5": 200, "admin": 200}
    assert (tmp_path / "clubdata" / "board.db").is_file()


def test_serve_survives_board_failure(tmp_path, site_dir):
    data = tmp_path / "clubdata"
    (data / "board.db").mkdir(parents=True)        # 库文件位置被一个目录占了：SQLite 打不开
    res = run(tmp_path, site_dir, data)
    assert res["get"] == 404 and res["post"][0] in (404, 405)   # 没有排行榜接口
    assert res["v5"] == 200 and res["admin"] == 200            # 官网和后台照常
