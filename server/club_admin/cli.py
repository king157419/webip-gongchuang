"""服务器终端里维护管理员和导入内容。网页上没有任何创建管理员的入口。

    python -m club_admin.cli add <用户名>       新建管理员（交互输入两次密码）
    python -m club_admin.cli passwd <用户名>    改密码（该用户已登录的会话全部失效）
    python -m club_admin.cli remove <用户名>    删除管理员（会话全部失效）
    python -m club_admin.cli list               列出管理员
    python -m club_admin.cli import <content.json>   导入/覆盖内容（旧内容先进历史版本）
    python -m club_admin.cli board-list <slice|fold> [-n 50]   列出排行榜
    python -m club_admin.cli board-rm <slice|fold> <昵称>      删除一条排行榜记录（不当昵称）

数据目录由环境变量 CLUB_DATA_DIR 决定，默认 /workspace/clubdata。
密码不接受命令行参数（会留在 shell 历史和进程列表里），只能交互输入。
"""
from __future__ import annotations

import argparse
import getpass
import json
import sys
from pathlib import Path

from .auth import AdminDB, AdminStore
from .content import ContentStore
from .schema import validate_content
from .settings import Settings
from .util import fmt_bj


def _ask_password() -> str:
    pw1 = getpass.getpass("新密码（至少 10 位，输入时不显示）：")
    pw2 = getpass.getpass("再输一次：")
    if pw1 != pw2:
        raise SystemExit("两次输入不一致，未做任何修改。")
    return pw1


def _board_cmd(args: argparse.Namespace) -> int:
    from .board import GAMES, BoardStore
    settings = Settings.from_env()
    store = BoardStore(settings)
    g = GAMES[args.game]
    print(f"排行榜：{store.path}（{g.label}）")
    if args.cmd == "board-list":
        items = store.admin_list(g, max(1, args.n))
        if not items:
            print("  还没有记录。")
        for it in items:
            print(f"  {it['rank']:>3}. {it['name']:<14} {it['score']:>7} {g.unit}  {it['updated']}  {it['ip']}")
        return 0
    gone = store.delete_name(g, args.name)
    if gone is None:
        print(f"失败：没有找到昵称「{args.name}」", file=sys.stderr)
        return 1
    AdminDB(settings).audit("cli", "删除排行榜记录", "排行榜", f"{g.label}：{gone['name']}（{gone['score']} {g.unit}）")
    print(f"已删除「{gone['name']}」（{gone['score']} {g.unit}）。")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m club_admin.cli", description="社团官网后台：管理员与内容")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, helptext in (("add", "新建管理员"), ("passwd", "修改密码"), ("remove", "删除管理员")):
        p = sub.add_parser(name, help=helptext)
        p.add_argument("username")
    sub.add_parser("list", help="列出管理员")
    p = sub.add_parser("import", help="导入 content.json（旧内容自动进历史版本）")
    p.add_argument("file", type=Path)
    p = sub.add_parser("board-list", help="列出排行榜记录（game 是 slice 或 fold）")
    p.add_argument("game", choices=["slice", "fold"])
    p.add_argument("-n", type=int, default=50, help="列出前几名，默认 50")
    p = sub.add_parser("board-rm", help="按昵称删除一条排行榜记录")
    p.add_argument("game", choices=["slice", "fold"])
    p.add_argument("name")
    args = ap.parse_args(argv)

    if args.cmd in {"board-list", "board-rm"}:
        return _board_cmd(args)

    settings = Settings.from_env()
    settings.ensure_dirs()
    admins = AdminStore(settings)
    print(f"数据目录：{settings.data_dir}")

    try:
        if args.cmd == "add":
            admins.set_password(args.username, _ask_password(), create=True)
            AdminDB(settings).audit("cli", "新建管理员", None, args.username)
            print(f"已创建管理员 {args.username}。")
        elif args.cmd == "passwd":
            if not admins.exists(args.username):
                raise ValueError(f"管理员 {args.username} 不存在")
            admins.set_password(args.username, _ask_password(), create=False)
            db = AdminDB(settings)
            n = db.delete_user_sessions(args.username)
            db.audit("cli", "修改密码", None, args.username)
            print(f"已修改 {args.username} 的密码，注销了 {n} 个登录会话。")
        elif args.cmd == "remove":
            admins.remove(args.username)
            db = AdminDB(settings)
            n = db.delete_user_sessions(args.username)
            db.audit("cli", "删除管理员", None, args.username)
            print(f"已删除管理员 {args.username}，注销了 {n} 个登录会话。")
        elif args.cmd == "list":
            users = admins.users()
            if not users:
                print("还没有管理员。用 add <用户名> 创建。")
            for name, u in sorted(users.items()):
                print(f"  {name:<20} 创建 {fmt_bj(u.get('created', 0))}  最近改密码 {fmt_bj(u.get('updated', 0))}")
        elif args.cmd == "import":
            data = json.loads(args.file.read_text("utf-8"))
            errs = validate_content(data)
            if errs:
                print("内容校验未通过，未导入：", file=sys.stderr)
                for e in errs[:30]:
                    print("  - " + e, file=sys.stderr)
                return 1
            ver = ContentStore(settings).import_initial(data, "cli")
            AdminDB(settings).audit("cli", "导入内容", None, str(args.file))
            print(f"已导入到 {settings.content_path}（版本 {ver}）。")
    except (ValueError, RuntimeError) as exc:
        print(f"失败：{exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
