"""本机端到端冒烟：真起一个 uvicorn，走一遍「建测试管理员 → 登录 → 改一条新闻 → 官网读到新内容」。

    .venv\\Scripts\\python.exe tests\\e2e_smoke.py <临时目录> [求职罗盘代码目录]

不传求职罗盘目录时用 tests/fakeapp 替身。脚本结束时会关掉 uvicorn，不留常驻进程。
测试账号密码来自 tests/conftest.py，只用于本机。
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
SERVER = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(SERVER))
from conftest import CONVERT, FAKEAPP, NODE, ORIGINAL_JS, TEST_PASSWORD, TEST_USER, WEB_DIR  # noqa: E402

PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"


def main() -> int:
    work = Path(sys.argv[1]).resolve()
    app_dir = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else FAKEAPP
    data = work / "clubdata"
    work.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, CLUB_DATA_DIR=str(data), CLUB_SITE_DIR=str(WEB_DIR), JOBFAIR_DATA_DIR=str(work / "jobfair"),
               PYTHONPATH=os.pathsep.join([str(SERVER), str(app_dir)]), PYTHONIOENCODING="utf-8")

    # 1. content.js → content.json → 导入
    cj = work / "content.json"
    subprocess.run([NODE, str(CONVERT), "js2json", str(ORIGINAL_JS), str(cj)], check=True)
    subprocess.run([sys.executable, "-m", "club_admin.cli", "import", str(cj)], check=True, env=env, cwd=SERVER)
    # 2. 测试管理员（CLI 只接受交互输入密码，这里直接调同一个函数）
    os.environ["CLUB_DATA_DIR"] = str(data)
    from club_admin.auth import AdminStore
    from club_admin.settings import Settings
    st = AdminStore(Settings.from_env())
    if not st.exists(TEST_USER):
        st.set_password(TEST_USER, TEST_PASSWORD, create=True)

    log = open(work / "uvicorn.log", "wb")
    proc = subprocess.Popen([sys.executable, "-m", "uvicorn", "serve:app", "--host", "127.0.0.1", "--port", str(PORT),
                             "--workers", "1", "--proxy-headers"], cwd=SERVER, env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try:
                httpx.get(BASE + "/admin/", timeout=1)
                break
            except httpx.HTTPError:
                time.sleep(0.2)
        c = httpx.Client(base_url=BASE, headers={"Origin": BASE})
        steps = []

        def ok(name, cond, extra=""):
            steps.append((name, bool(cond)))
            print(("通过 " if cond else "失败 ") + name + (f"  {extra}" if extra else ""))

        r = c.get("/v5-zhi/")
        ok("官网 /v5-zhi/ 可访问", r.status_code == 200 and "../shared/content.js" in r.text)
        js0 = c.get("/shared/content.js")
        ok("content.js 由后台生成", js0.headers.get("x-content-source") == "current", js0.headers.get("etag"))
        r = c.post("/admin/api/login", json={"username": TEST_USER, "password": "wrong-password!!"})
        ok("错误密码被拒", r.status_code == 401)
        r = c.post("/admin/api/login", json={"username": TEST_USER, "password": TEST_PASSWORD})
        ok("登录成功", r.status_code == 200, r.headers.get("set-cookie", "").split(";", 1)[1].strip())
        cur = c.get("/admin/api/content").json()
        news = cur["data"]["news"]
        old_title = news[0]["title"]
        news[0]["title"] = "【后台冒烟测试】" + old_title
        r = c.put("/admin/api/content/news", json={"data": news, "base_version": cur["version"]})
        ok("保存新闻", r.status_code == 200, "；".join(r.json().get("changes", [])))
        js1 = c.get("/shared/content.js")
        ok("官网读到新标题", "【后台冒烟测试】" in js1.text and js1.headers["etag"] != js0.headers["etag"])
        r = c.put("/admin/api/content/news", json={"data": news, "base_version": cur["version"]},
                  headers={"Origin": "http://evil.example"})
        ok("跨站请求被拒", r.status_code == 403)
        st_ = c.get("/admin/api/status").json()
        ok("状态页可读（本机无 systemd）", st_["services"]["available"] is False, st_["services"]["message"])
        hist = c.get("/admin/api/history").json()
        ok("历史版本 1 份", len(hist["items"]) == 1)
        r = c.post(f"/admin/api/history/{hist['items'][0]['name']}/restore", json={"base_version": hist["current_version"]})
        ok("一键恢复", r.status_code == 200 and "【后台冒烟测试】" not in c.get("/shared/content.js").text)
        return 0 if all(s[1] for s in steps) else 1
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()
        print("uvicorn 已关闭，退出码", proc.returncode)


if __name__ == "__main__":
    raise SystemExit(main())
