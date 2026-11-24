"""服务器状态（只读）。

所有外部命令都是写死的参数列表：不经过 shell、带超时、不拼接任何用户输入。
唯一会变的参数是 `systemctl show` 后面的服务名，它们来自 systemctl 自己的输出，并且再用正则过滤一遍。
本机 Windows 没有 systemd / /proc，返回 available=False，页面显示「本机没有 systemd」。
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

from .settings import Settings
from .util import fmt_bj

UNIT_RE = re.compile(r"^[A-Za-z0-9@._:\\-]{1,200}\.service$")
TIMEOUT = 5

CMD_LIST_UNITS = ["systemctl", "--user", "list-units", "--type=service", "--all", "--no-legend", "--no-pager", "--plain"]
CMD_LIST_FILES = ["systemctl", "--user", "list-unit-files", "--type=service", "--no-legend", "--no-pager"]
SHOW_PROPS = "Id,Description,LoadState,ActiveState,SubState,UnitFileState,ActiveEnterTimestampMonotonic,MemoryCurrent,MainPID"
CMD_SHOW = ["systemctl", "--user", "show", "--no-pager", "-p", SHOW_PROPS]
CMD_JOURNAL = ["journalctl", "--user", "-u", "dsh.service", "-n", "50", "--no-pager", "-o", "short-iso"]

COMMANDS = [
    ("查看服务状态", "systemctl --user status dsh.service"),
    ("重启网站服务（改了代码或 serve.py 之后）", "systemctl --user restart dsh.service"),
    ("看最近日志", "journalctl --user -u dsh.service -n 100 --no-pager"),
    ("实时跟踪日志", "journalctl --user -u dsh.service -f"),
    ("新建管理员", "cd /workspace/dsh && venv/bin/python -m club_admin.cli add <用户名>"),
    ("改管理员密码", "cd /workspace/dsh && venv/bin/python -m club_admin.cli passwd <用户名>"),
    ("删除管理员", "cd /workspace/dsh && venv/bin/python -m club_admin.cli remove <用户名>"),
    ("列出管理员", "cd /workspace/dsh && venv/bin/python -m club_admin.cli list"),
    ("部署网站静态文件（在本机 Git Bash）", "bash web/deploy.sh"),
    ("把线上内容拉回本机预览（在本机 Git Bash）", "bash server/pull-content.sh"),
]


def _env() -> dict[str, str]:
    env = dict(os.environ)
    env["SYSTEMD_COLORS"] = "0"
    env["SYSTEMD_PAGER"] = ""
    if "XDG_RUNTIME_DIR" not in env and hasattr(os, "getuid"):
        p = f"/run/user/{os.getuid()}"
        if os.path.isdir(p):
            env["XDG_RUNTIME_DIR"] = p
    return env


def _run(cmd: list[str]) -> tuple[bool, str]:
    if shutil.which(cmd[0]) is None:
        return False, f"本机没有 {cmd[0]}"
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=TIMEOUT, shell=False, env=_env(), stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        return False, f"{cmd[0]} 超时（{TIMEOUT} 秒）"
    except OSError as exc:
        return False, f"{cmd[0]} 无法运行：{exc}"
    out = r.stdout.decode("utf-8", "replace")
    if r.returncode != 0:
        err = r.stderr.decode("utf-8", "replace").strip()
        return False, err or out.strip() or f"{cmd[0]} 返回 {r.returncode}"
    return True, out


def _human_bytes(n: float | None) -> str | None:
    if n is None:
        return None
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return None


def _human_secs(s: float | None) -> str | None:
    if s is None or s < 0:
        return None
    s = int(s)
    d, s = divmod(s, 86400)
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    if d:
        return f"{d} 天 {h} 小时"
    if h:
        return f"{h} 小时 {m} 分"
    if m:
        return f"{m} 分 {s} 秒"
    return f"{s} 秒"


def parse_list_units(text: str) -> dict[str, dict[str, str]]:
    units: dict[str, dict[str, str]] = {}
    for line in text.splitlines():
        line = line.strip().lstrip("●*").strip()
        parts = line.split(None, 4)
        if len(parts) >= 4 and UNIT_RE.match(parts[0]):
            units[parts[0]] = {"load": parts[1], "active": parts[2], "sub": parts[3],
                               "description": parts[4] if len(parts) > 4 else ""}
    return units


def parse_list_files(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 2 and UNIT_RE.match(parts[0]):
            out[parts[0]] = parts[1]
    return out


def parse_show(text: str) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for block in re.split(r"\n\s*\n", text.strip()):
        props: dict[str, str] = {}
        for line in block.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                props[k.strip()] = v.strip()
        if props.get("Id"):
            out[props["Id"]] = props
    return out


def _rss_of(pid: str) -> int | None:
    if not pid.isdigit() or pid == "0":
        return None
    try:
        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) * 1024
    except (OSError, ValueError):
        return None
    return None


def services(main: str) -> dict[str, Any]:
    if shutil.which("systemctl") is None:
        return {"available": False, "message": "本机没有 systemd（Windows 本地测试时正常）", "units": []}
    ok1, t1 = _run(CMD_LIST_UNITS)
    ok2, t2 = _run(CMD_LIST_FILES)
    if not ok1 and not ok2:
        return {"available": False, "message": f"读取 systemd 用户服务失败：{t1}", "units": []}
    loaded = parse_list_units(t1) if ok1 else {}
    files = parse_list_files(t2) if ok2 else {}
    names = sorted(set(loaded) | set(files), key=lambda n: (n != main, n))
    names = [n for n in names if UNIT_RE.match(n)][:100]
    shown: dict[str, dict[str, str]] = {}
    if names:
        ok3, t3 = _run(CMD_SHOW + names)
        if ok3:
            shown = parse_show(t3)
    now_mono = time.monotonic()
    units = []
    for n in names:
        lu, sh = loaded.get(n, {}), shown.get(n, {})
        active = sh.get("ActiveState") or lu.get("active") or "inactive"
        sub = sh.get("SubState") or lu.get("sub") or "dead"
        enabled = sh.get("UnitFileState") or files.get(n) or ""
        running_for = None
        mono = sh.get("ActiveEnterTimestampMonotonic", "0")
        if active == "active" and mono.isdigit() and int(mono) > 0:
            running_for = now_mono - int(mono) / 1e6
        mem = sh.get("MemoryCurrent", "")
        mem_bytes = int(mem) if mem.isdigit() and int(mem) < 2 ** 63 else None
        mem_note = "cgroup"
        if mem_bytes is None:
            mem_bytes = _rss_of(sh.get("MainPID", ""))
            mem_note = "主进程 RSS" if mem_bytes is not None else ""
        units.append({
            "name": n,
            "description": sh.get("Description") or lu.get("description", ""),
            "enabled": enabled,
            "autostart": enabled in {"enabled", "enabled-runtime", "linked", "alias"},
            "active": active,
            "sub": sub,
            "running": active == "active" and sub == "running",
            "running_for": _human_secs(running_for),
            "memory": _human_bytes(mem_bytes),
            "memory_note": mem_note,
            "main": n == main,
        })
    warn = None if (ok1 and ok2) else (t1 if not ok1 else t2)
    return {"available": True, "message": warn, "units": units}


def _meminfo() -> dict[str, Any] | None:
    try:
        info: dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            k, v = line.split(":", 1)
            info[k] = int(v.split()[0]) * 1024
    except (OSError, ValueError):
        return None
    total, avail = info.get("MemTotal"), info.get("MemAvailable")
    res: dict[str, Any] = {"total": _human_bytes(total), "available": _human_bytes(avail)}
    if total and avail is not None:
        res["used_pct"] = round((total - avail) * 100 / total, 1)
    # 容器里 /proc/meminfo 可能是宿主机的数字，再看一眼 cgroup v2 限额
    try:
        cur = int(Path("/sys/fs/cgroup/memory.current").read_text())
        mx = Path("/sys/fs/cgroup/memory.max").read_text().strip()
        res["cgroup_current"] = _human_bytes(cur)
        res["cgroup_max"] = "不限" if mx == "max" else _human_bytes(int(mx))
    except (OSError, ValueError):
        pass
    return res


def system(settings: Settings) -> dict[str, Any]:
    res: dict[str, Any] = {"cpu_count": os.cpu_count()}
    res["memory"] = _meminfo()
    try:
        la = Path("/proc/loadavg").read_text().split()[:3]
        res["load"] = " / ".join(la)
    except OSError:
        res["load"] = None
    try:
        up = float(Path("/proc/uptime").read_text().split()[0])
        res["uptime"] = _human_secs(up)
    except (OSError, ValueError):
        res["uptime"] = None
    disk_path = settings.disk_path if settings.disk_path.exists() else settings.data_dir
    try:
        du = shutil.disk_usage(disk_path)
        res["disk"] = {"path": str(disk_path), "total": _human_bytes(du.total), "used": _human_bytes(du.used),
                       "free": _human_bytes(du.free), "used_pct": round(du.used * 100 / du.total, 1)}
    except OSError:
        res["disk"] = None
    res["has_proc"] = Path("/proc/meminfo").exists()
    return res


def site_dirs(settings: Settings) -> list[dict[str, Any]]:
    root = settings.site_dir
    out = []
    if not root.is_dir():
        return out
    for d in sorted(root.iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        newest = d.stat().st_mtime
        count = 0
        for dirpath, _dirs, fnames in os.walk(d):
            for fn in fnames:
                count += 1
                if count > 3000:
                    break
                try:
                    newest = max(newest, os.stat(os.path.join(dirpath, fn)).st_mtime)
                except OSError:
                    pass
        out.append({"name": d.name, "dir_mtime": fmt_bj(d.stat().st_mtime), "newest_file": fmt_bj(newest),
                    "url": f"/{d.name}/"})
    return out


def journal() -> dict[str, Any]:
    if shutil.which("journalctl") is None:
        return {"available": False, "text": "本机没有 journalctl（Windows 本地测试时正常）"}
    ok, text = _run(CMD_JOURNAL)
    return {"available": ok, "text": text[-20000:]}


def collect(settings: Settings) -> dict[str, Any]:
    return {
        "generated": fmt_bj(time.time()),
        "services": services(settings.main_service),
        "system": system(settings),
        "sites": site_dirs(settings),
        "journal": journal(),
        "commands": [{"label": a, "cmd": b} for a, b in COMMANDS],
    }
