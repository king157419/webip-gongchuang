import time

import pytest

from conftest import ORIGIN, TEST_PASSWORD, TEST_USER, W, login, make_app


def test_login_success_sets_safe_cookie(client):
    r = login(client)
    assert r.status_code == 200
    cookie = r.headers["set-cookie"]
    low = cookie.lower()
    assert "club_admin_session=" in cookie
    assert "httponly" in low
    assert "samesite=strict" in low
    assert "path=/" in low
    assert "max-age=43200" in low
    assert "secure" not in low.replace("samesite", "")
    me = client.get("/admin/api/me")
    assert me.status_code == 200 and me.json()["user"] == TEST_USER


def test_cookie_secure_switch(settings, original_content):
    from dataclasses import replace
    from fastapi.testclient import TestClient
    app, _ = make_app(replace(settings, cookie_secure=True), original_content)
    with TestClient(app, base_url=ORIGIN) as c:
        r = login(c)
        assert r.status_code == 200
        assert "; secure" in r.headers["set-cookie"].lower()


def test_login_failure(client):
    assert login(client, password="wrong-password-xx").status_code == 401
    assert login(client, user="nobody").status_code == 401
    assert client.get("/admin/api/me").status_code == 401
    r = client.post("/admin/api/login", json={"username": TEST_USER}, headers=W)
    assert r.status_code == 400


def test_rate_limit_locks_ip_for_10_minutes(client, monkeypatch):
    for i in range(4):
        assert login(client, password=f"bad-{i}-xxxxxxx").status_code == 401
    r = login(client, password="bad-5-xxxxxxx")
    assert r.status_code == 429
    # 锁定期间正确密码也不行
    assert login(client).status_code == 429
    # 10 分钟后解锁
    import club_admin.auth as auth_mod
    real = time.time
    monkeypatch.setattr(auth_mod.time, "time", lambda: real() + 601)
    assert login(client).status_code == 200


def test_success_resets_failure_count(client):
    for i in range(4):
        login(client, password=f"bad-{i}-xxxxxxx")
    assert login(client).status_code == 200
    for i in range(4):
        assert login(client, password=f"bad-{i}-xxxxxxx").status_code == 401


@pytest.mark.parametrize("method,path", [
    ("GET", "/admin/api/me"), ("GET", "/admin/api/content"), ("GET", "/admin/api/schema"),
    ("GET", "/admin/api/history"), ("GET", "/admin/api/audit"), ("GET", "/admin/api/status"),
    ("PUT", "/admin/api/content/news"), ("POST", "/admin/api/uploads"),
    ("POST", "/admin/api/history/20260101-000000-x.json/restore"),
])
def test_unauthenticated_rejected(client, method, path):
    r = client.request(method, path, headers=W, json={})
    assert r.status_code == 401


def test_logout_invalidates_session(authed):
    tok = authed.cookies.get("club_admin_session")
    assert authed.post("/admin/api/logout", headers=W).status_code == 200
    authed.cookies.set("club_admin_session", tok)
    assert authed.get("/admin/api/me").status_code == 401


def test_forged_cookie_rejected(client):
    client.cookies.set("club_admin_session", "x" * 43)
    assert client.get("/admin/api/content").status_code == 401


def test_session_expires_after_12_hours(authed, monkeypatch):
    import club_admin.auth as auth_mod
    real = time.time
    monkeypatch.setattr(auth_mod.time, "time", lambda: real() + 12 * 3600 + 5)
    assert authed.get("/admin/api/me").status_code == 401


def test_removed_admin_loses_access(authed, app_state):
    _, state = app_state
    state.admins.remove(TEST_USER)
    assert authed.get("/admin/api/me").status_code == 401


def test_sessions_survive_restart(authed, settings):
    """会话存在 SQLite 里：换一个新的 app 实例（相当于重启），Cookie 仍然有效。"""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from club_admin import install
    app2 = FastAPI()
    install(app2, settings)
    with TestClient(app2, base_url=ORIGIN) as c2:
        c2.cookies.set("club_admin_session", authed.cookies.get("club_admin_session"))
        assert c2.get("/admin/api/me").status_code == 200


# ---------------------------------------------------------------- CSRF / 同源
def _put_news(c, data, version, headers):
    return c.put("/admin/api/content/news", json={"data": data, "base_version": version}, headers=headers)


def test_cross_site_origin_rejected(authed):
    cur = authed.get("/admin/api/content").json()
    news = cur["data"]["news"]
    assert _put_news(authed, news, cur["version"], {"Origin": "http://evil.example"}).status_code == 403
    assert _put_news(authed, news, cur["version"], {"Origin": "null"}).status_code == 403
    assert _put_news(authed, news, cur["version"], {}).status_code == 403  # 没有 Origin 也没有 Referer
    assert _put_news(authed, news, cur["version"], {"Referer": "http://evil.example/x"}).status_code == 403
    # 同源 Referer（没有 Origin）可以
    assert _put_news(authed, news, cur["version"], {"Referer": ORIGIN + "/admin/"}).status_code == 200
    assert authed.post("/admin/api/logout", headers={"Origin": "http://evil.example"}).status_code == 403


def test_login_csrf_rejected(client):
    assert login(client, origin="http://evil.example").status_code == 403
    assert login(client, origin=None).status_code == 403


def test_json_content_type_required(authed):
    cur = authed.get("/admin/api/content").json()
    r = authed.put("/admin/api/content/news", content=b'{"data": [], "base_version": "x"}',
                   headers={**W, "Content-Type": "text/plain"})
    assert r.status_code == 415


def test_allowed_origins_setting(settings, original_content):
    from dataclasses import replace
    from fastapi.testclient import TestClient
    app, _ = make_app(replace(settings, allowed_origins=("https://ai.example.edu",)), original_content)
    with TestClient(app, base_url=ORIGIN) as c:
        assert login(c, origin="https://ai.example.edu").status_code == 200


def test_admin_pages_have_security_headers(client):
    r = client.get("/admin/")
    assert r.status_code == 200
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert r.headers["x-frame-options"] == "DENY"
    assert "HTTP" in r.text and "明文" in r.text
    assert client.get("/admin/static/admin.js").status_code == 200
    assert client.get("/admin/static/../web.py").status_code == 404
    assert client.get("/admin", follow_redirects=False).status_code == 301


def test_password_hash_format(app_state, settings):
    import json
    data = json.loads(settings.admins_path.read_text("utf-8"))
    h = data["users"][TEST_USER]["hash"]
    assert h.startswith("scrypt$") and TEST_PASSWORD not in settings.admins_path.read_text("utf-8")
