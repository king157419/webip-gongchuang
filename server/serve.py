"""服务器入口：社团网站 + 社团网站管理后台，同一个进程。

求职罗盘已于 2026-11-21 停用：这里不再加载 app.main（它的页面、接口、定时任务都不会启动）。
/workspace/dsh/app 和 /workspace/dsh/data 原样保留；要恢复就把 serve.py 换回 serve.py.bak-20261121。

/                  → 主页（/workspace/club/index.html，六个版本的入口）
/shared/content.js → 管理后台按服务器上的 content.json 动态生成（必须排在 /shared 静态目录之前）
/uploads/…         → 后台上传的图片（/shared/img/uploads/… 也指向同一批文件）
/admin/            → 社团网站管理后台
/api/board/…       → 全社团排行榜（slice / fold 两个游戏）
/v…/ /shared/ /_thumbs/ → 社团网站静态文件（/workspace/club 下的每个文件夹）
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

CLUB = Path(os.environ.get("CLUB_SITE_DIR", "/workspace/club"))

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/", include_in_schema=False)
async def root():
    home = CLUB / "index.html"
    if home.is_file():
        return FileResponse(home, media_type="text/html", headers={"Cache-Control": "no-cache"})
    return RedirectResponse("/v5-zhi/", status_code=302)


# 管理后台：路由要在下面挂载静态目录之前注册，/shared/content.js 才会先匹配到这里。
# 后台加载失败（代码出错、数据目录没权限等）不影响官网：/shared/content.js 会由静态目录提供打包时的版本。
try:
    from club_admin import install as install_club_admin

    install_club_admin(app)
except Exception:  # noqa: BLE001
    logging.getLogger("club_admin").exception("管理后台加载失败，官网继续用静态 content.js 运行")

# 全社团排行榜（/api/board/slice、/api/board/fold）：同样要排在静态目录之前。
# 加载失败只是没有公用榜，两个游戏页面会自动退回只显示本机纪录。
try:
    from club_admin.board import install as install_board

    install_board(app)
except Exception:  # noqa: BLE001
    logging.getLogger("club_admin.board").exception("排行榜加载失败，游戏页面只显示本机纪录")


for d in sorted(CLUB.iterdir()) if CLUB.is_dir() else []:
    if d.is_dir():
        app.mount(f"/{d.name}", StaticFiles(directory=d, html=True), name=f"club-{d.name}")
