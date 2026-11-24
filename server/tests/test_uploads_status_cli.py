import json
import re

import pytest

from conftest import TEST_USER, W

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"\x00" * 64
GIF = b"GIF89a" + b"\x00" * 64


# ---------------------------------------------------------------- 上传
@pytest.mark.parametrize("data,ctype,ext", [(PNG, "image/png", "png"), (JPG, "image/jpeg", "jpg"), (WEBP, "image/webp", "webp")])
def test_upload_ok(authed, data, ctype, ext):
    r = authed.post("/admin/api/uploads", content=data, headers={**W, "Content-Type": ctype})
    assert r.status_code == 200, r.text
    j = r.json()
    assert re.fullmatch(r"[0-9a-f]{32}\." + ext, j["name"])
    assert j["value"] == "uploads/" + j["name"]
    for url in (j["url"], "/shared/img/" + j["value"]):
        g = authed.get(url)
        assert g.status_code == 200 and g.content == data
        assert g.headers["content-type"] == ctype
        assert g.headers["x-content-type-options"] == "nosniff"


def test_upload_type_is_sniffed_not_trusted(authed):
    # 声称是 PNG，实际是 GIF / HTML
    for body in (GIF, b"<html><script>alert(1)</script>"):
        r = authed.post("/admin/api/uploads", content=body, headers={**W, "Content-Type": "image/png"})
        assert r.status_code == 400
    # 声明的类型不在白名单
    r = authed.post("/admin/api/uploads", content=PNG, headers={**W, "Content-Type": "image/svg+xml"})
    assert r.status_code == 415
    r = authed.post("/admin/api/uploads", content=PNG, headers={**W, "Content-Type": "text/html"})
    assert r.status_code == 415


def test_upload_size_limit(authed, settings):
    big = PNG + b"\x00" * (settings.upload_max_bytes + 10)
    r = authed.post("/admin/api/uploads", content=big, headers={**W, "Content-Type": "image/png"})
    assert r.status_code in (400, 413)
    assert list(settings.uploads_dir.iterdir()) == []


def test_upload_requires_same_origin(authed):
    r = authed.post("/admin/api/uploads", content=PNG, headers={"Origin": "http://evil.example", "Content-Type": "image/png"})
    assert r.status_code == 403


def test_upload_paths_cannot_escape(client, settings):
    (settings.data_dir / "secret.png").write_bytes(PNG)
    for bad in ("../secret.png", "..%2Fsecret.png", "secret.png", "0123456789abcdef0123456789abcdef.svg"):
        assert client.get("/uploads/" + bad).status_code == 404


# ---------------------------------------------------------------- 状态页
def test_status_without_systemd(authed, monkeypatch):
    import club_admin.status as st
    monkeypatch.setattr(st.shutil, "which", lambda name: None)
    r = authed.get("/admin/api/status")
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["services"]["available"] is False and "没有 systemd" in j["services"]["message"]
    assert j["journal"]["available"] is False
    assert {s["name"] for s in j["sites"]} >= {"v5-zhi", "v4-zhi", "shared"}
    assert j["system"]["disk"]["used_pct"] >= 0
    assert any("restart dsh.service" in c["cmd"] for c in j["commands"])


def test_status_api_is_read_only(client):
    # 状态相关只有 GET；任何写方法都不存在
    for m in ("POST", "PUT", "DELETE", "PATCH"):
        assert client.request(m, "/admin/api/status", headers=W).status_code in (401, 405)


def test_status_commands_are_fixed_lists():
    import club_admin.status as st
    for cmd in (st.CMD_LIST_UNITS, st.CMD_LIST_FILES, st.CMD_SHOW, st.CMD_JOURNAL):
        assert isinstance(cmd, list) and all(isinstance(x, str) for x in cmd)
    assert st.CMD_JOURNAL[:4] == ["journalctl", "--user", "-u", "dsh.service"]


def test_status_with_fake_systemd(monkeypatch):
    import subprocess

    import club_admin.status as st
    from club_admin.settings import Settings
    outputs = {
        "list-units": "dsh.service loaded active running 求职罗盘 + 社团网站\n"
                      "● king-app.service loaded failed failed 旧占位\n",
        "list-unit-files": "dsh.service enabled enabled\nking-app.service disabled enabled\n",
        "show": "Id=dsh.service\nDescription=求职罗盘 + 社团网站\nActiveState=active\nSubState=running\n"
                "UnitFileState=enabled\nActiveEnterTimestampMonotonic=1000000\nMemoryCurrent=104857600\nMainPID=123\n\n"
                "Id=king-app.service\nActiveState=failed\nSubState=failed\nUnitFileState=disabled\n"
                "ActiveEnterTimestampMonotonic=0\nMemoryCurrent=[not set]\nMainPID=0\n",
        "journalctl": "2026-11-16T10:00:00+0800 host uvicorn[1]: INFO started\n",
    }
    calls = []

    def fake_run(cmd, **kw):
        calls.append((cmd, kw))
        assert kw.get("shell") is False and kw.get("timeout")
        key = "journalctl" if cmd[0] == "journalctl" else cmd[2]
        return subprocess.CompletedProcess(cmd, 0, outputs[key].encode("utf-8"), b"")

    monkeypatch.setattr(st.shutil, "which", lambda n: "/usr/bin/" + n)
    monkeypatch.setattr(st.subprocess, "run", fake_run)
    res = st.collect(Settings())
    units = res["services"]["units"]
    assert [u["name"] for u in units] == ["dsh.service", "king-app.service"]
    dsh, king = units
    assert dsh["main"] and dsh["running"] and dsh["autostart"] and dsh["memory"] == "100.0 MB" and dsh["running_for"]
    assert not king["running"] and not king["autostart"] and king["active"] == "failed"
    assert "INFO started" in res["journal"]["text"]
    # 服务名只来自 systemctl 输出
    show_cmd = next(c for c, _ in calls if c[2] == "show")
    assert show_cmd[-2:] == ["dsh.service", "king-app.service"]


def test_parse_ignores_weird_unit_names():
    import club_admin.status as st
    units = st.parse_list_units("ok.service loaded active running x\n$(rm -rf).service loaded active running y\n")
    assert list(units) == ["ok.service"]


# ---------------------------------------------------------------- CLI
@pytest.fixture
def cli_env(settings, monkeypatch):
    monkeypatch.setenv("CLUB_DATA_DIR", str(settings.data_dir))
    return settings


def _pw(monkeypatch, *answers):
    it = iter(answers)
    monkeypatch.setattr("getpass.getpass", lambda prompt="": next(it))


def test_cli_add_list_passwd_remove(cli_env, monkeypatch, capsys):
    from club_admin import cli
    from club_admin.auth import AdminDB, AdminStore
    _pw(monkeypatch, "first-password-1", "first-password-1")
    assert cli.main(["add", "alice"]) == 0
    store = AdminStore(cli_env)
    assert store.verify("alice", "first-password-1")
    assert cli.main(["list"]) == 0
    assert "alice" in capsys.readouterr().out
    # 已存在
    _pw(monkeypatch, "x" * 12, "x" * 12)
    assert cli.main(["add", "alice"]) == 1
    # 改密码会注销会话
    db = AdminDB(cli_env)
    tok, _ = db.create_session("alice", "1.2.3.4")
    _pw(monkeypatch, "second-password-2", "second-password-2")
    assert cli.main(["passwd", "alice"]) == 0
    assert db.session_user(tok) is None
    assert store.verify("alice", "second-password-2") and not store.verify("alice", "first-password-1")
    tok, _ = db.create_session("alice", "1.2.3.4")
    assert cli.main(["remove", "alice"]) == 0
    assert not store.exists("alice") and db.session_user(tok) is None


def test_cli_rejects_bad_input(cli_env, monkeypatch):
    from club_admin import cli
    _pw(monkeypatch, "short", "short")
    assert cli.main(["add", "bob"]) == 1
    _pw(monkeypatch, "long-enough-pass-1", "different-pass-22")
    with pytest.raises(SystemExit):
        cli.main(["add", "bob"])
    _pw(monkeypatch, "long-enough-pass-1", "long-enough-pass-1")
    assert cli.main(["add", "bad name!"]) == 1
    # 密码不能当参数传
    with pytest.raises(SystemExit):
        cli.main(["add", "bob", "long-enough-pass-1"])


def test_cli_import(cli_env, original_content, tmp_path):
    from club_admin import cli
    from club_admin.content import ContentStore
    good = tmp_path / "c.json"
    good.write_text(json.dumps(original_content, ensure_ascii=False), "utf-8")
    assert cli.main(["import", str(good)]) == 0
    assert ContentStore(cli_env).read_current()[0] == original_content
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"meta": {}}), "utf-8")
    assert cli.main(["import", str(bad)]) == 1
