"""测试夹具。测试用管理员账号密码只在这里，绝不用于服务器。"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SERVER_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = SERVER_DIR.parent / "web"
ORIGINAL_JS = WEB_DIR / "shared" / "content.js"
CONVERT = SERVER_DIR / "scripts" / "content-convert.js"
FAKEAPP = Path(__file__).resolve().parent / "fakeapp"

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

TEST_USER = "tester"
TEST_PASSWORD = "test-only-password-123"
ORIGIN = "http://testserver"


def find_node() -> str | None:
    for cand in (os.environ.get("NODE"), shutil.which("node"), r"D:\nodejs\node.exe", r"D:\nodejs\node"):
        if cand and Path(cand).exists():
            return cand
    return None


NODE = find_node()


def node_load(js_file: Path) -> dict:
    """用 Node 执行 content.js，取出 window.CLUB。"""
    out = subprocess.run([NODE, str(CONVERT), "js2json", str(js_file)], capture_output=True, check=True, timeout=30)
    return json.loads(out.stdout.decode("utf-8"))


@pytest.fixture(scope="session")
def original_content() -> dict:
    if NODE is None:
        pytest.skip("没有 node，无法转换 content.js")
    return node_load(ORIGINAL_JS)


@pytest.fixture
def site_dir(tmp_path: Path) -> Path:
    site = tmp_path / "club"
    (site / "shared").mkdir(parents=True)
    shutil.copy(ORIGINAL_JS, site / "shared" / "content.js")
    for name in ("v5-zhi", "v4-zhi"):
        (site / name).mkdir()
        (site / name / "index.html").write_text(f"<!doctype html><title>{name}</title>"
                                               '<script src="../shared/content.js"></script>', "utf-8")
    return site


@pytest.fixture
def settings(tmp_path: Path, site_dir: Path):
    from club_admin.settings import Settings
    return Settings(data_dir=tmp_path / "clubdata", site_dir=site_dir, disk_path=tmp_path)


def make_app(settings, content: dict | None):
    from fastapi import FastAPI
    from club_admin import install
    from club_admin.content import ContentStore
    app = FastAPI()
    state = install(app, settings)
    if content is not None:
        ContentStore(settings).import_initial(content, "cli")
    if not state.admins.exists(TEST_USER):
        state.admins.set_password(TEST_USER, TEST_PASSWORD, create=True)
    return app, state


@pytest.fixture
def app_state(settings, original_content):
    return make_app(settings, original_content)


@pytest.fixture
def client(app_state):
    from fastapi.testclient import TestClient
    app, _ = app_state
    with TestClient(app, base_url=ORIGIN) as c:
        yield c


def login(c, user=TEST_USER, password=TEST_PASSWORD, origin=ORIGIN):
    headers = {"Origin": origin} if origin else {}
    return c.post("/admin/api/login", json={"username": user, "password": password}, headers=headers)


@pytest.fixture
def authed(client):
    r = login(client)
    assert r.status_code == 200, r.text
    return client


W = {"Origin": ORIGIN}  # 写操作带的同源头
