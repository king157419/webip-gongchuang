"""内容结构定义 + 校验。

同一份 SCHEMA 通过 /admin/api/schema 发给前端：前端照它生成表单、做同样的校验，
后端保存前再校验一遍，结构不对的数据一律拒绝。字段完全按 web/shared/content.js 现有字段来。
"""
from __future__ import annotations

import re
from datetime import date
from typing import Any

STR_MAX = 300
TEXT_MAX = 5000
URL_MAX = 1000
LIST_MAX = 1000

SLUG_RE = re.compile(r"^[a-z0-9_-]{1,32}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://[^\s\"'<>\\]+$")
# 图片字段写 shared/img/ 下的相对路径（网站各版本会在前面拼 ../shared/img/），
# 上传的图片写 uploads/<随机名>。不允许 ..、绝对路径和协议头。
IMAGE_RE = re.compile(r"^(?!/)(?!.*\.\.)[A-Za-z0-9_\-./一-鿿]{1,200}\.(?:png|jpe?g|webp|gif|svg)$", re.I)


def f(key: str, label: str, type: str, **kw: Any) -> dict[str, Any]:
    d = {"key": key, "label": label, "type": type}
    d.update(kw)
    return d


PERSON = [
    f("name", "姓名", "string", required=True),
    f("role", "身份 / 职务", "string"),
    f("desc", "介绍", "text"),
    f("awards", "获奖经历（一行一条）", "stringlist"),
    f("photo", "照片", "image", nullable=True, help="shared/img/ 下的文件名，或上传后自动填入 uploads/…"),
]

SECTIONS: list[dict[str, Any]] = [
    {
        "key": "news", "label": "新闻动态", "type": "list", "itemLabel": "新闻",
        "summary": ["date", "title"], "help": "按时间倒序，最新的放最上面。",
        "item": [
            f("date", "日期", "date", required=True),
            f("cat", "活动类型", "ref", required=True, ref="programs", help="对应「活动类型」栏目里的 id"),
            f("title", "标题", "string", required=True),
            f("summary", "摘要", "text"),
            f("source", "原文链接", "url", nullable=True),
            f("cover", "封面图", "image", nullable=True, help="可选。目前各版本网站还没有显示封面的位置"),
        ],
    },
    {
        "key": "programs", "label": "活动类型", "type": "list", "itemLabel": "活动类型",
        "summary": ["id", "name"], "unique": "id",
        "help": "id 被新闻的「活动类型」引用，改 id 前先确认没有新闻在用。",
        "item": [
            f("id", "id（小写英文）", "slug", required=True),
            f("name", "名称", "string", required=True),
            f("desc", "介绍", "text"),
            f("where", "常用地点", "string"),
        ],
    },
    {
        "key": "honors", "label": "荣誉成果", "type": "list", "itemLabel": "荣誉",
        "summary": ["year", "text"], "help": "只收录原文明确与社团相关的条目。",
        "item": [
            f("year", "年份", "string", required=True),
            f("text", "内容", "text", required=True),
            f("source", "原文链接", "url", nullable=True),
        ],
    },
    {
        "key": "people", "label": "人物", "type": "object",
        "fields": [
            f("leaders", "社长 / 骨干", "list", itemLabel="人物", summary=["name", "role"], item=PERSON),
            f("teachers", "指导老师", "list", itemLabel="老师", summary=["name", "role"], item=PERSON),
        ],
    },
    {
        "key": "join", "label": "加入我们", "type": "object",
        "fields": [
            f("steps", "加入步骤", "list", itemLabel="步骤", summary=["t"], item=[
                f("t", "标题", "string", required=True),
                f("d", "说明", "text"),
            ]),
            f("season", "招新时间", "string", nullable=True, help="例：每年 9 月 – 10 月；留空显示「待社团补充」"),
            f("formUrl", "报名问卷链接", "url", nullable=True, help="填了以后各版本的报名按钮会启用"),
            f("faq", "常见问题", "list", itemLabel="问题", summary=["q"], item=[
                f("q", "问题", "string", required=True),
                f("a", "回答", "text", required=True),
            ]),
        ],
    },
    {
        "key": "meta", "label": "社团信息", "type": "object",
        "fields": [
            f("name", "社团全称", "string", required=True),
            f("short", "简称", "string", required=True),
            f("en", "英文名", "string"),
            f("type", "社团类型", "string"),
            f("host", "挂靠单位", "string"),
            f("founded", "成立年份", "int", nullable=True),
            f("audience", "面向对象", "text"),
            f("intro", "简介", "text", required=True),
            f("departments", "部门", "list", itemLabel="部门", summary=["name"], item=[
                f("name", "部门名", "string", required=True),
                f("desc", "职责", "string"),
            ]),
            f("members", "成员人数", "int", nullable=True, help="留空显示「待社团补充」"),
            f("contact", "联系方式", "object", fields=[
                f("email", "邮箱", "string", nullable=True),
                f("wechat", "微信公众号", "string", nullable=True),
                f("qqGroup", "QQ 群", "string", nullable=True),
            ]),
            f("location", "活动地点", "string", nullable=True),
        ],
    },
]

SECTION_KEYS = [s["key"] for s in SECTIONS]
SECTION_LABELS = {s["key"]: s["label"] for s in SECTIONS}
_SECTION_BY_KEY = {s["key"]: s for s in SECTIONS}


class ValidationFailed(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("；".join(errors[:5]))
        self.errors = errors


def _check_value(node: dict[str, Any], value: Any, path: str, errs: list[str], ctx: dict[str, Any]) -> None:
    t = node["type"]
    label = node.get("label", path)
    where = f"{path}（{label}）"
    if value is None:
        if node.get("nullable"):
            return
        errs.append(f"{where} 不能为空")
        return
    if t in {"string", "text", "slug", "date", "url", "image", "ref"}:
        if not isinstance(value, str):
            errs.append(f"{where} 应该是文字")
            return
        limit = TEXT_MAX if t == "text" else URL_MAX if t == "url" else STR_MAX
        if len(value) > limit:
            errs.append(f"{where} 太长（最多 {limit} 字）")
        if node.get("required") and not value.strip():
            errs.append(f"{where} 必填")
            return
        if not value:
            return
        if t == "slug" and not SLUG_RE.match(value):
            errs.append(f"{where} 只能用小写字母、数字、- 和 _")
        elif t == "date":
            ok = bool(DATE_RE.match(value))
            if ok:
                try:
                    date.fromisoformat(value)
                except ValueError:
                    ok = False
            if not ok:
                errs.append(f"{where} 日期格式应为 YYYY-MM-DD")
        elif t == "url" and not URL_RE.match(value):
            errs.append(f"{where} 链接必须以 http:// 或 https:// 开头，且不能含空格、引号、尖括号")
        elif t == "image" and not IMAGE_RE.match(value):
            errs.append(f"{where} 图片路径不合法（例：renjie.png 或 uploads/xxxx.jpg）")
        elif t == "ref":
            ctx.setdefault("refs", []).append((node["ref"], value, where))
    elif t == "int":
        if isinstance(value, bool) or not isinstance(value, int):
            errs.append(f"{where} 应该是整数")
        elif not (0 <= value <= 1_000_000):
            errs.append(f"{where} 数值超出范围")
    elif t == "stringlist":
        if not isinstance(value, list):
            errs.append(f"{where} 应该是文字列表")
            return
        if len(value) > LIST_MAX:
            errs.append(f"{where} 条目太多")
        for i, v in enumerate(value):
            if not isinstance(v, str):
                errs.append(f"{path}[{i}] 应该是文字")
            elif len(v) > STR_MAX * 2:
                errs.append(f"{path}[{i}] 太长")
    elif t == "object":
        _check_object(node["fields"], value, path, errs, ctx)
    elif t == "list":
        if not isinstance(value, list):
            errs.append(f"{where} 应该是列表")
            return
        if len(value) > LIST_MAX:
            errs.append(f"{where} 条目太多（最多 {LIST_MAX}）")
            return
        seen: set[Any] = set()
        uniq = node.get("unique")
        for i, item in enumerate(value):
            _check_object(node["item"], item, f"{path}[{i}]", errs, ctx)
            if uniq and isinstance(item, dict):
                k = item.get(uniq)
                if k in seen:
                    errs.append(f"{path}[{i}].{uniq} 重复：{k}")
                seen.add(k)
        if path in {"programs"}:
            ctx["programs"] = [it.get("id") for it in value if isinstance(it, dict)]
    else:  # pragma: no cover - schema 写错
        errs.append(f"{where} 未知字段类型 {t}")


def _check_object(fields: list[dict[str, Any]], value: Any, path: str, errs: list[str], ctx: dict[str, Any]) -> None:
    if not isinstance(value, dict):
        errs.append(f"{path} 应该是对象 {{…}}")
        return
    known = {fd["key"] for fd in fields}
    for k in value:
        if k not in known:
            errs.append(f"{path}.{k} 是未知字段（允许：{'、'.join(sorted(known))}）")
    for fd in fields:
        k = fd["key"]
        sub = f"{path}.{k}" if path else k
        if k not in value:
            if fd.get("required"):
                errs.append(f"{sub}（{fd['label']}）缺失")
            continue
        _check_value(fd, value[k], sub, errs, ctx)


def validate_section(key: str, value: Any, programs: list[str] | None = None) -> list[str]:
    """单独校验一个栏目。news 需要 programs 的 id 列表来检查 cat。"""
    if key not in _SECTION_BY_KEY:
        return [f"未知栏目 {key}"]
    errs: list[str] = []
    ctx: dict[str, Any] = {}
    node = _SECTION_BY_KEY[key]
    _check_value(node, value, key, errs, ctx)
    progs = ctx.get("programs", programs) or []
    for _ref, v, where in ctx.get("refs", []):
        if v not in progs:
            errs.append(f"{where} 是 {v}，但「活动类型」里没有这个 id")
    return errs


def validate_content(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return ["内容应该是一个对象 {…}"]
    errs: list[str] = []
    for k in data:
        if k not in _SECTION_BY_KEY:
            errs.append(f"顶层未知栏目 {k}")
    for k in SECTION_KEYS:
        if k not in data:
            errs.append(f"缺少栏目 {k}（{SECTION_LABELS[k]}）")
    if errs:
        return errs
    programs = [p.get("id") for p in data["programs"] if isinstance(p, dict)] if isinstance(data["programs"], list) else []
    for k in SECTION_KEYS:
        errs.extend(validate_section(k, data[k], programs))
    return errs


def require_valid(data: Any) -> None:
    errs = validate_content(data)
    if errs:
        raise ValidationFailed(errs)
