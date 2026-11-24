"""HTTP 接口：公开的 /shared/content.js、/uploads/…，以及 /admin/ 后台。"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from . import status as status_mod
from .auth import PASSWORD_MAX, AdminDB, AdminStore
from .content import Conflict, ContentStore, changed_sections, diff_summary, version_of
from .schema import SECTION_KEYS, SECTION_LABELS, SECTIONS, ValidationFailed, validate_section
from .settings import Settings
from .uploads import MEDIA_TYPES, UploadRejected, save_upload, upload_path

log = logging.getLogger("club_admin")

COOKIE = "club_admin_session"
STATIC = Path(__file__).resolve().parent / "static"
ADMIN_FILES = {"admin.js": "text/javascript; charset=utf-8", "admin.css": "text/css; charset=utf-8"}
JSON_LIMIT = 2 * 1024 * 1024

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
       "connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")


class State:
    def __init__(self, settings: Settings):
        self.s = settings
        settings.ensure_dirs()
        self.content = ContentStore(settings)
        self.admins = AdminStore(settings)
        self.db = AdminDB(settings)
        # 排行榜库打不开不影响后台其它功能：「排行榜」栏会显示不可用
        try:
            from .board import BoardStore
            self.board: Any = BoardStore(settings)
        except Exception:  # noqa: BLE001
            log.exception("排行榜数据库打不开，后台的「排行榜」栏不可用")
            self.board = None


def _client_ip(request: Request) -> str:
    # uvicorn --proxy-headers 已经按 X-Forwarded-For（仅信任 127.0.0.1 的代理）换成真实地址
    return (request.client.host if request.client else "") or "unknown"


def _netloc(url: str) -> str | None:
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return None
    return parts.netloc.lower()


def _origin_ok(request: Request, settings: Settings) -> bool:
    """写操作必须同源：Origin（没有就看 Referer）的主机名要等于本次请求的 Host。"""
    hosts = {h.strip().lower() for h in (request.headers.get("host", ""), request.headers.get("x-forwarded-host", ""))
             if h.strip()}
    origin = request.headers.get("origin")
    candidate = origin if origin and origin != "null" else request.headers.get("referer")
    if not candidate:
        return False
    if origin and origin.rstrip("/") in settings.allowed_origins:
        return True
    nl = _netloc(candidate)
    if nl is None:
        return False
    if nl in hosts:
        return True
    return any(_netloc(o) == nl for o in settings.allowed_origins)


def _json_response(data: Any, status: int = 200) -> JSONResponse:
    return JSONResponse(data, status_code=status, headers={"Cache-Control": "no-store"})


def _err(status: int, msg: str, **extra: Any) -> JSONResponse:
    return _json_response({"detail": msg, **extra}, status)


async def _read_limited(request: Request, limit: int) -> bytes:
    cl = request.headers.get("content-length", "")
    if cl.isdigit() and int(cl) > limit:
        raise HTTPException(413, "内容太大")
    buf = bytearray()
    async for chunk in request.stream():
        buf += chunk
        if len(buf) > limit:
            raise HTTPException(413, "内容太大")
    return bytes(buf)


async def _read_json(request: Request) -> dict[str, Any]:
    ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if ctype != "application/json":
        raise HTTPException(415, "需要 application/json")
    raw = await _read_limited(request, JSON_LIMIT)
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise HTTPException(400, "JSON 格式不对")
    if not isinstance(data, dict):
        raise HTTPException(400, "请求体应该是对象")
    return data


def _sites(settings: Settings) -> list[dict[str, str]]:
    root = settings.site_dir
    out = []
    if root.is_dir():
        for d in sorted(root.iterdir()):
            if d.is_dir() and (d / "index.html").is_file():
                out.append({"name": d.name, "url": f"/{d.name}/"})
    out.sort(key=lambda x: x["name"] != "v5-zhi")  # 首页跳转的是 v5-zhi，放第一个
    return out


def build_router(state: State) -> APIRouter:
    s = state.s
    r = APIRouter()

    # ------------------------------------------------------------------ 依赖
    def require_user(request: Request) -> str:
        sess = state.db.session_user(request.cookies.get(COOKIE))
        if not sess or not state.admins.exists(sess[0]):
            raise HTTPException(401, "未登录或登录已过期")
        return sess[0]

    def require_same_origin(request: Request) -> None:
        if not _origin_ok(request, s):
            raise HTTPException(403, "来源校验失败（疑似跨站请求）")

    # ------------------------------------------------------------------ 公开
    @r.api_route("/shared/content.js", methods=["GET", "HEAD"], include_in_schema=False)
    def content_js(request: Request) -> Response:
        try:
            p = state.content.public_js()
        except Exception:  # 理论上 public_js 不抛；再兜一层，交给静态文件
            log.exception("生成 content.js 失败")
            if s.static_content_js.is_file():
                return FileResponse(s.static_content_js, media_type="application/javascript; charset=utf-8",
                                    headers={"Cache-Control": "no-cache"})
            raise
        headers = {"Cache-Control": "no-cache", "ETag": p.etag, "X-Content-Source": p.source.split(":")[0]}
        inm = request.headers.get("if-none-match", "")
        if p.etag in [t.strip().removeprefix("W/") for t in inm.split(",")]:
            return Response(status_code=304, headers=headers)
        body = b"" if request.method == "HEAD" else p.body
        headers["Content-Length"] = str(len(p.body))
        return Response(body, media_type="application/javascript; charset=utf-8", headers=headers)

    def _serve_upload(name: str) -> Response:
        p = upload_path(s, name)
        if p is None:
            raise HTTPException(404, "Not Found")
        return FileResponse(p, media_type=MEDIA_TYPES[p.suffix[1:]],
                            headers={"Cache-Control": "public, max-age=31536000, immutable",
                                     "X-Content-Type-Options": "nosniff",
                                     "Content-Security-Policy": "default-src 'none'"})

    @r.get("/uploads/{name}", include_in_schema=False)
    def uploads_public(name: str) -> Response:
        return _serve_upload(name)

    # 网站各版本把图片字段拼成 ../shared/img/<字段>，所以 uploads/x.jpg 会请求到这里
    @r.get("/shared/img/uploads/{name}", include_in_schema=False)
    def uploads_shared(name: str) -> Response:
        return _serve_upload(name)

    # ------------------------------------------------------------------ 页面
    @r.get("/admin", include_in_schema=False)
    def admin_noslash() -> Response:
        return RedirectResponse("/admin/", status_code=301)

    @r.get("/admin/", include_in_schema=False)
    def admin_index() -> Response:
        return FileResponse(STATIC / "index.html", media_type="text/html; charset=utf-8")

    @r.get("/admin/static/{fname}", include_in_schema=False)
    def admin_static(fname: str) -> Response:
        if fname not in ADMIN_FILES:
            raise HTTPException(404, "Not Found")
        return FileResponse(STATIC / fname, media_type=ADMIN_FILES[fname])

    # ------------------------------------------------------------------ 登录
    @r.post("/admin/api/login", dependencies=[Depends(require_same_origin)])
    async def login(request: Request) -> Response:
        ip = _client_ip(request)
        wait = state.db.locked_for(ip)
        if wait:
            return _err(429, f"登录失败次数过多，请 {max(1, wait // 60)} 分钟后再试")
        body = await _read_json(request)
        user, pw = body.get("username"), body.get("password")
        if not isinstance(user, str) or not isinstance(pw, str) or not user or not pw or len(pw) > PASSWORD_MAX:
            return _err(400, "请填写用户名和密码")
        user = user.strip()
        if not state.admins.verify(user, pw):
            locked = state.db.record_failure(ip)
            state.db.audit(user[:32] or "?", "登录失败", None, "", ip)
            if locked:
                return _err(429, f"连续失败 {s.max_fail} 次，已锁定 {s.lock_minutes} 分钟")
            return _err(401, "用户名或密码错误")
        state.db.clear_failures(ip)
        token, expires = state.db.create_session(user, ip)
        state.db.audit(user, "登录", None, "", ip)
        resp = _json_response({"user": user, "expires": expires})
        resp.set_cookie(COOKIE, token, max_age=s.session_hours * 3600, httponly=True, samesite="strict",
                        path="/", secure=s.cookie_secure)
        return resp

    @r.post("/admin/api/logout", dependencies=[Depends(require_same_origin)])
    def logout(request: Request) -> Response:
        tok = request.cookies.get(COOKIE)
        sess = state.db.session_user(tok)
        state.db.delete_session(tok)
        if sess:
            state.db.audit(sess[0], "退出登录", None, "", _client_ip(request))
        resp = _json_response({"ok": True})
        resp.delete_cookie(COOKIE, path="/", httponly=True, samesite="strict", secure=s.cookie_secure)
        return resp

    @r.get("/admin/api/me")
    def me(request: Request, user: str = Depends(require_user)) -> Response:
        sess = state.db.session_user(request.cookies.get(COOKIE))
        return _json_response({"user": user, "expires": sess[1] if sess else None,
                               "cookie_secure": s.cookie_secure})

    # ------------------------------------------------------------------ 内容
    @r.get("/admin/api/schema")
    def schema(user: str = Depends(require_user)) -> Response:
        return _json_response({"sections": SECTIONS})

    @r.get("/admin/api/content")
    def get_content(user: str = Depends(require_user)) -> Response:
        if not state.content.exists():
            return _err(409, "服务器上还没有 content.json。请在服务器终端执行导入命令（见 server/README.md）。",
                        code="no_content")
        try:
            data, ver = state.content.read_current()
        except Exception as exc:
            msg = "；".join(exc.errors[:5]) if isinstance(exc, ValidationFailed) else str(exc)[:300]
            return _err(500, f"content.json 无法读取：{msg}。官网目前用的是备用内容，可以到「历史版本」恢复一份。",
                        code="broken")
        return _json_response({"data": data, "version": ver, "sites": _sites(s)})

    @r.put("/admin/api/content/{section}", dependencies=[Depends(require_same_origin)])
    async def put_section(section: str, request: Request, user: str = Depends(require_user)) -> Response:
        if section not in SECTION_KEYS:
            return _err(404, "没有这个栏目")
        body = await _read_json(request)
        if "data" not in body:
            return _err(400, "缺少 data")
        base = body.get("base_version")
        if not isinstance(base, str):
            return _err(400, "缺少 base_version")
        try:
            old, _ = state.content.read_current()
        except FileNotFoundError:
            return _err(409, "服务器上还没有 content.json", code="no_content")
        except Exception:
            return _err(500, "content.json 已损坏，请先到「历史版本」恢复", code="broken")
        errs = validate_section(section, body["data"],
                                [p.get("id") for p in old["programs"]] if section != "programs" else None)
        new = dict(old)
        new[section] = body["data"]
        if section == "programs" and not errs:
            # 改了活动类型以后，新闻里的 cat 还得都能对上
            ids = {p.get("id") for p in body["data"]}
            bad = sorted({n.get("cat") for n in old["news"] if n.get("cat") not in ids})
            if bad:
                errs.append(f"新闻还在用这些活动类型 id：{'、'.join(bad)}，不能删除或改名")
        if errs:
            return _err(400, "内容校验未通过", errors=errs)
        try:
            ver = state.content.save(new, user, base)
        except Conflict:
            return _err(409, "别人刚刚保存过，请刷新后再改（你的修改还在页面上，可以先复制出来）", code="conflict")
        except ValidationFailed as exc:
            return _err(400, "内容校验未通过", errors=exc.errors)
        summary = diff_summary(old, new)
        lines = [ln for sec in summary["sections"] for ln in sec["lines"]]
        state.db.audit(user, "保存", SECTION_LABELS[section], "\n".join(lines[:10]) or "无变化", _client_ip(request))
        return _json_response({"version": ver, "changes": lines, "sites": _sites(s)})

    @r.post("/admin/api/uploads", dependencies=[Depends(require_same_origin)])
    async def upload(request: Request, user: str = Depends(require_user)) -> Response:
        ctype = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype not in {"image/jpeg", "image/png", "image/webp"}:
            return _err(415, "只支持 JPG、PNG、WebP 图片")
        data = await _read_limited(request, s.upload_max_bytes + 1)
        try:
            name = save_upload(s, data)
        except UploadRejected as exc:
            return _err(400, str(exc))
        state.db.audit(user, "上传图片", None, f"{name}（{len(data) // 1024} KB）", _client_ip(request))
        return _json_response({"name": name, "value": f"uploads/{name}", "url": f"/uploads/{name}"})

    # ------------------------------------------------------------------ 历史
    def _current_raw() -> tuple[dict[str, Any], str | None]:
        try:
            raw = s.content_path.read_bytes()
        except OSError:
            return {}, None
        try:
            data = json.loads(raw.decode("utf-8"))
            return (data if isinstance(data, dict) else {}), version_of(raw)
        except ValueError:
            return {}, version_of(raw)

    @r.get("/admin/api/history")
    def history(user: str = Depends(require_user)) -> Response:
        _, ver = _current_raw()
        return _json_response({"items": state.content.list_history(), "current_version": ver,
                               "keep": s.history_keep})

    @r.get("/admin/api/history/{name}")
    def history_item(name: str, user: str = Depends(require_user)) -> Response:
        try:
            old = state.content.read_history(name)
        except (FileNotFoundError, ValueError):
            return _err(404, "没有这个历史版本")
        cur, ver = _current_raw()
        # 「恢复它」会让当前内容变成什么样：current → history
        return _json_response({"name": name, "diff": diff_summary(cur, old), "current_version": ver})

    @r.post("/admin/api/history/{name}/restore", dependencies=[Depends(require_same_origin)])
    async def restore(name: str, request: Request, user: str = Depends(require_user)) -> Response:
        body = await _read_json(request)
        base = body.get("base_version")
        try:
            old = state.content.read_history(name)
        except (FileNotFoundError, ValueError):
            return _err(404, "没有这个历史版本")
        cur, cur_ver = _current_raw()
        if cur_ver is not None and base != cur_ver:
            return _err(409, "内容刚刚被改过，请刷新历史页面后再恢复", code="conflict")
        try:
            ver = state.content.save(old, user, cur_ver)
        except Conflict:
            return _err(409, "内容刚刚被改过，请刷新后再试", code="conflict")
        except ValidationFailed as exc:
            return _err(400, "这个历史版本结构不对，不能恢复", errors=exc.errors)
        secs = [SECTION_LABELS[k] for k in changed_sections(cur, old)]
        state.db.audit(user, "恢复历史版本", "、".join(secs) or None, name, _client_ip(request))
        return _json_response({"version": ver, "sites": _sites(s)})

    # ------------------------------------------------------------------ 记录与状态（只读）
    @r.get("/admin/api/audit")
    def audit(user: str = Depends(require_user)) -> Response:
        return _json_response({"items": state.db.audit_list(300)})

    @r.get("/admin/api/status")
    def server_status(user: str = Depends(require_user)) -> Response:
        return _json_response(status_mod.collect(s))

    # ------------------------------------------------------------------ 排行榜（只能看和删）
    def _board_game(game: str) -> Any:
        from .board import GAMES
        if state.board is None:
            raise HTTPException(503, "排行榜数据库打不开，看服务器日志")
        g = GAMES.get(game)
        if g is None:
            raise HTTPException(404, "没有这个游戏")
        return g

    @r.get("/admin/api/board")
    def board_games(user: str = Depends(require_user)) -> Response:
        from .board import GAMES
        if state.board is None:
            return _err(503, "排行榜数据库打不开，看服务器日志")
        return _json_response({"games": [{"key": g.key, "label": g.label, "unit": g.unit,
                                          "total": state.board.total(g), "keep": state.board.keep}
                                         for g in GAMES.values()]})

    @r.get("/admin/api/board/{game}")
    def board_list(game: str, user: str = Depends(require_user)) -> Response:
        g = _board_game(game)
        return _json_response({"game": g.key, "unit": g.unit, "items": state.board.admin_list(g, 200)})

    @r.delete("/admin/api/board/{game}/{row_id}", dependencies=[Depends(require_same_origin)])
    def board_delete(game: str, row_id: int, request: Request, user: str = Depends(require_user)) -> Response:
        g = _board_game(game)
        gone = state.board.delete_id(g, row_id)
        if gone is None:
            return _err(404, "这条记录已经不在了")
        state.db.audit(user, "删除排行榜记录", "排行榜", f"{g.label}：{gone['name']}（{gone['score']} {g.unit}）",
                       _client_ip(request))
        return _json_response({"ok": True})

    return r


def install(app: FastAPI, settings: Settings | None = None) -> State:
    """把后台接到已有的 FastAPI 应用上。必须在挂载 /shared 静态目录之前调用。"""
    state = State(settings or Settings.from_env())
    app.include_router(build_router(state))

    @app.middleware("http")
    async def _admin_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        resp = await call_next(request)
        if request.url.path == "/admin" or request.url.path.startswith("/admin/"):
            resp.headers.setdefault("Cache-Control", "no-store")
            resp.headers["Content-Security-Policy"] = CSP
            resp.headers["X-Frame-Options"] = "DENY"
            resp.headers["X-Content-Type-Options"] = "nosniff"
            resp.headers["Referrer-Policy"] = "same-origin"
        return resp

    app.state.club_admin = state
    log.info("管理后台已加载：数据目录 %s", state.s.data_dir)
    return state
