import copy
import json
import subprocess

import pytest

from conftest import CONVERT, NODE, ORIGIN, W, make_app, node_load


def _get(c):
    r = c.get("/admin/api/content")
    assert r.status_code == 200, r.text
    return r.json()


def _put(c, section, data, version):
    return c.put(f"/admin/api/content/{section}", json={"data": data, "base_version": version}, headers=W)


def test_content_js_headers_and_etag(client):
    r = client.get("/shared/content.js")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-cache"
    assert r.headers["content-type"].startswith("application/javascript")
    etag = r.headers["etag"]
    assert r.text.lstrip().startswith("/*") and "window.CLUB = " in r.text
    r2 = client.get("/shared/content.js", headers={"If-None-Match": etag})
    assert r2.status_code == 304
    assert client.head("/shared/content.js").status_code == 200


def test_save_news_changes_content_js(authed):
    before = authed.get("/shared/content.js")
    cur = _get(authed)
    news = cur["data"]["news"]
    news[0]["title"] = "测试：改过的新闻标题"
    r = _put(authed, "news", news, cur["version"])
    assert r.status_code == 200, r.text
    assert any("修改" in line for line in r.json()["changes"])
    assert r.json()["sites"][0]["name"] == "v5-zhi"
    after = authed.get("/shared/content.js")
    assert "测试：改过的新闻标题" in after.text
    assert after.headers["etag"] != before.headers["etag"]
    # 旧 ETag 不再 304
    assert authed.get("/shared/content.js", headers={"If-None-Match": before.headers["etag"]}).status_code == 200


def test_add_delete_move_news(authed, original_content):
    cur = _get(authed)
    news = cur["data"]["news"]
    new_item = {"date": "2026-11-16", "cat": "talk", "title": "新增的一条", "summary": "", "source": None,
                "cover": "uploads/0123456789abcdef0123456789abcdef.png"}
    news.insert(0, new_item)
    news[1], news[2] = news[2], news[1]
    del news[-1]
    r = _put(authed, "news", news, cur["version"])
    assert r.status_code == 200, r.text
    got = _get(authed)["data"]["news"]
    assert got[0]["title"] == "新增的一条"
    assert len(got) == len(original_content["news"])
    assert got[1] == original_content["news"][1]


@pytest.mark.parametrize("mutate,expect", [
    (lambda d: d["news"][0].__setitem__("source", "javascript:alert(1)"), "http"),
    (lambda d: d["news"][0].__setitem__("cat", "nope"), "活动类型"),
    (lambda d: d["news"][0].__setitem__("date", "2026-13-01"), "日期"),
    (lambda d: d["news"][0].__setitem__("evil", "x"), "未知字段"),
    (lambda d: d["news"][0].pop("title"), "缺失"),
    (lambda d: d["news"][0].__setitem__("title", 123), "文字"),
    (lambda d: d["news"][0].__setitem__("cover", "../../admins.json"), "图片"),
    (lambda d: d["news"].append("not an object"), "对象"),
])
def test_bad_news_rejected(authed, mutate, expect):
    cur = _get(authed)
    data = copy.deepcopy(cur["data"])
    mutate(data)
    r = _put(authed, "news", data["news"], cur["version"])
    assert r.status_code == 400, r.text
    assert any(expect in e for e in r.json()["errors"]), r.json()
    assert _get(authed)["version"] == cur["version"]  # 没有写入


def test_bad_other_sections_rejected(authed):
    cur = _get(authed)
    d = cur["data"]
    assert _put(authed, "meta", {**d["meta"], "founded": "二〇二一"}, cur["version"]).status_code == 400
    assert _put(authed, "people", {"leaders": "x", "teachers": []}, cur["version"]).status_code == 400
    assert _put(authed, "join", "not object", cur["version"]).status_code == 400
    # 删掉被新闻引用的活动类型
    progs = [p for p in d["programs"] if p["id"] != "weld"]
    r = _put(authed, "programs", progs, cur["version"])
    assert r.status_code == 400 and "weld" in "".join(r.json()["errors"])
    # 重复 id
    r = _put(authed, "programs", d["programs"] + [d["programs"][0]], cur["version"])
    assert r.status_code == 400
    assert authed.put("/admin/api/content/hacker", json={"data": 1, "base_version": "x"}, headers=W).status_code == 404


def test_not_json_rejected(authed):
    r = authed.put("/admin/api/content/news", content=b"{oops", headers={**W, "Content-Type": "application/json"})
    assert r.status_code == 400


def test_conflict_detected(authed):
    cur = _get(authed)
    news = cur["data"]["news"]
    news[0]["summary"] = "第一次"
    assert _put(authed, "news", news, cur["version"]).status_code == 200
    news[0]["summary"] = "用旧版本号再存"
    r = _put(authed, "news", news, cur["version"])
    assert r.status_code == 409


def test_edit_every_section(authed):
    cur = _get(authed)
    d = cur["data"]
    ver = cur["version"]
    d["meta"]["members"] = 120
    d["meta"]["contact"]["email"] = "ai@example.edu"
    d["honors"].append({"year": "2026", "text": "测试荣誉", "source": None})
    d["people"]["teachers"][0]["photo"] = "uploads/0123456789abcdef0123456789abcdef.jpg"
    d["join"]["formUrl"] = "https://example.edu/form"
    d["programs"][0]["where"] = "新地点"
    for sec in ("meta", "honors", "people", "join", "programs"):
        r = _put(authed, sec, d[sec], ver)
        assert r.status_code == 200, (sec, r.text)
        ver = r.json()["version"]
    assert _get(authed)["data"] == d


def test_history_and_restore(authed, settings, original_content):
    cur = _get(authed)
    news = cur["data"]["news"]
    news[0]["title"] = "第一次修改"
    v1 = _put(authed, "news", news, cur["version"]).json()["version"]
    news[0]["title"] = "第二次修改"
    v2 = _put(authed, "news", news, v1).json()["version"]
    h = authed.get("/admin/api/history").json()
    assert len(h["items"]) == 2  # 首次导入时还没有旧文件，不备份；两次保存各备份一份
    names = [it["name"] for it in h["items"]]
    assert all("-tester" in n for n in names) and all(it["user"] == "tester" for it in h["items"])
    # 最旧的一份就是原始内容
    oldest = names[-1]
    d = authed.get(f"/admin/api/history/{oldest}").json()
    assert not d["diff"]["same"]
    assert [s["label"] for s in d["diff"]["sections"]] == ["新闻动态"]
    # 用过期的版本号恢复被拒
    assert authed.post(f"/admin/api/history/{oldest}/restore", json={"base_version": v1}, headers=W).status_code == 409
    r = authed.post(f"/admin/api/history/{oldest}/restore", json={"base_version": h["current_version"]}, headers=W)
    assert r.status_code == 200, r.text
    assert _get(authed)["data"] == original_content
    assert "第二次修改" not in authed.get("/shared/content.js").text
    # 恢复前的内容也进了历史
    assert len(authed.get("/admin/api/history").json()["items"]) == 3
    # 操作记录
    audit = authed.get("/admin/api/audit").json()["items"]
    actions = [a["action"] for a in audit]
    assert "恢复历史版本" in actions and actions.count("保存") == 2 and "登录" in actions
    assert all(len(a["time"]) == 19 for a in audit)


def test_history_kept_to_limit(settings, original_content):
    from dataclasses import replace
    from club_admin.content import ContentStore
    s = replace(settings, history_keep=3)
    store = ContentStore(s)
    store.import_initial(original_content)
    data = copy.deepcopy(original_content)
    for i in range(6):
        data["news"][0]["summary"] = f"第 {i} 次"
        store.save(data, "tester", None)
    assert len(store.list_history()) == 3
    # 同一秒多次保存不会互相覆盖：最新一份应该是第 4 次保存后的内容
    assert store.read_history(store.list_history()[0]["name"])["news"][0]["summary"] == "第 4 次"


def test_history_name_traversal(authed):
    for bad in ("..%2Fadmins.json", "admins.json", "20260101-000000-..json", "..%5C..%5Cadmins.json"):
        assert authed.get(f"/admin/api/history/{bad}").status_code == 404


# ---------------------------------------------------------------- 官网兜底
def test_corrupt_content_json_keeps_site_alive(authed, settings, original_content):
    good = authed.get("/shared/content.js")
    settings.content_path.write_text("{ 坏掉的 json", "utf-8")
    r = authed.get("/shared/content.js")
    assert r.status_code == 200 and r.text == good.text
    assert r.headers["x-content-source"] == "last-good"
    # 后台能明确报错
    assert authed.get("/admin/api/content").status_code == 500


def test_corrupt_after_restart_uses_history_then_static(settings, original_content):
    from fastapi.testclient import TestClient
    from club_admin.content import ContentStore
    store = ContentStore(settings)
    store.import_initial(original_content)
    changed = copy.deepcopy(original_content)
    changed["news"][0]["title"] = "历史里的标题"
    store.save(changed, "a", None)                # 历史里现在有 original
    settings.content_path.write_text('{"meta": 1}', "utf-8")  # 结构错误
    app, _ = make_app(settings, None)            # 相当于重启：内存里没有上一份
    with TestClient(app, base_url=ORIGIN) as c:
        r = c.get("/shared/content.js")
        assert r.status_code == 200 and r.headers["x-content-source"] == "history"
        assert node_parse_text(r.text, settings.data_dir) == original_content
    # 没有历史：退回网站自带的静态 content.js
    for p in settings.history_dir.iterdir():
        p.unlink()
    app, _ = make_app(settings, None)
    with TestClient(app, base_url=ORIGIN) as c:
        r = c.get("/shared/content.js")
        assert r.headers["x-content-source"] == "static"
        assert r.content == settings.static_content_js.read_bytes()


def test_no_content_json_serves_static(settings):
    from fastapi.testclient import TestClient
    app, _ = make_app(settings, None)
    with TestClient(app, base_url=ORIGIN) as c:
        r = c.get("/shared/content.js")
        assert r.status_code == 200 and r.headers["x-content-source"] == "static"


def node_parse_text(js_text: str, tmpdir) -> dict:
    p = tmpdir / "_tmp_content.js"
    p.write_text(js_text, "utf-8")
    return node_load(p)


# ---------------------------------------------------------------- Node 能解析，且与原 content.js 一致
@pytest.mark.skipif(NODE is None, reason="没有 node")
def test_generated_js_matches_original(client, original_content, settings):
    served = client.get("/shared/content.js").text
    assert node_parse_text(served, settings.data_dir) == original_content
    # 本地脚本 json2js 生成的也一致
    j = settings.data_dir / "_c.json"
    j.write_text(json.dumps(original_content, ensure_ascii=False), "utf-8")
    out = settings.data_dir / "_c.js"
    subprocess.run([NODE, str(CONVERT), "json2js", str(j), str(out)], check=True, capture_output=True, timeout=30)
    assert node_load(out) == original_content


def test_render_js_escapes_line_separators():
    from club_admin.content import render_js
    js = render_js({"x": "a b"}).decode("utf-8")
    assert " " not in js and "\\u2028" in js
