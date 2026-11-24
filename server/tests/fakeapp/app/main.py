"""求职罗盘 app.main 的替身：只提供 serve.py 用到的 app 和 STATIC_DIR。"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

app = FastAPI(title="fake jobfair")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(STATIC_DIR / "index.html", media_type="text/html")


@app.get("/api/health")
async def health():
    return {"ok": True}
