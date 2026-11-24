"""新版 serve.py 的集成测试。

默认用替身 app.main（tests/fakeapp）；设置环境变量 DSH_APP_DIR 指向求职罗盘代码目录时，用真的 app.main。
在子进程里跑，避免 serve / app 模块和环境变量互相污染。
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from conftest import FAKEAPP, SERVER_DIR

SCRIPT = r"""
import json, sys
from fastapi.testclient import TestClient
import serve
c = TestClient(serve.app, base_url="http://testserver")
out = {}
r = c.get("/shared/content.js"); out["content_js"] = [r.status_code, r.headers.get("x-content-source"), r.headers.get("cache-control")]
r = c.get("/shared/guide.js"); out["guide_js"] = r.status_code
r = c.get("/v5-zhi/"); out["v5"] = [r.status_code, "content.js" in r.text]
r = c.get("/admin/"); out["admin"] = r.status_code
r = c.get("/admin/api/content"); out["admin_api"] = r.status_code
r = c.get("/", follow_redirects=False); out["root"] = [r.status_code, r.headers.get("location")]
r = c.get("/dsh/"); out["dsh"] = r.status_code
print("RESULT" + json.dumps(out))
"""


def run_serve(tmp_path: Path, site_dir: Path, data_dir: Path | None = None, break_admin: bool = False) -> dict:
    app_dir = Path(os.environ.get("DSH_APP_DIR") or FAKEAPP)
    env = dict(os.environ)
    env.update({
        "CLUB_SITE_DIR": str(site_dir),
        "CLUB_DATA_DIR": str(data_dir or tmp_path / "clubdata"),
        "JOBFAIR_DATA_DIR": str(tmp_path / "jobfair"),
        "PYTHONPATH": os.pathsep.join([str(SERVER_DIR), str(app_dir)]),
        "PYTHONIOENCODING": "utf-8",
    })
    if break_admin:
        # 让后台没法初始化：数据目录是一个文件
        bad = tmp_path / "not-a-dir"
        bad.write_text("x")
        env["CLUB_DATA_DIR"] = str(bad / "sub")
    p = subprocess.run([sys.executable, "-c", SCRIPT], cwd=str(tmp_path), env=env, capture_output=True, timeout=120)
    out = p.stdout.decode("utf-8", "replace")
    assert p.returncode == 0, p.stderr.decode("utf-8", "replace")[-3000:]
    line = next(ln for ln in out.splitlines() if ln.startswith("RESULT"))
    return json.loads(line[len("RESULT"):])


def test_serve_routes(tmp_path, site_dir):
    (site_dir / "shared" / "guide.js").write_text("// guide", "utf-8")
    res = run_serve(tmp_path, site_dir)
    # 后台已接管 content.js（还没导入内容 → 用静态文件兜底），其余 /shared 文件仍由静态目录提供
    assert res["content_js"] == [200, "static", "no-cache"]
    assert res["guide_js"] == 200
    assert res["v5"] == [200, True]
    assert res["admin"] == 200
    assert res["admin_api"] == 401
    assert res["root"] == [302, "/v5-zhi/"]
    assert res["dsh"] == 404  # 求职罗盘 2026-11-21 停用


def test_serve_survives_admin_failure(tmp_path, site_dir):
    res = run_serve(tmp_path, site_dir, break_admin=True)
    # 后台没加载：content.js 由静态目录提供（没有 X-Content-Source），官网照常
    assert res["content_js"][0] == 200 and res["content_js"][1] is None
    assert res["v5"] == [200, True]
    assert res["admin"] == 404
