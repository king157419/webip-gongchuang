"""把思源宋体（Noto Serif SC，SIL OFL 1.1）切成网页用的 woff2 分片。

用法（在本机运行，需要 fontTools 和 brotli）：
    python -I -X utf8 build_fonts.py <NotoSerifSC-VF.ttf 路径> [要额外收进第一片的文本文件...]

输出到本目录：
    serif-<字重>-<序号>.woff2  和  fonts.css（@font-face + unicode-range）
浏览器只下载页面上实际出现的字所在的分片。第 0 片是网站现在用到的字，
其余按 GB2312 常用字切片，后台新增内容用到新字时才会多下载一小片。
"""
import re
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

HERE = Path(__file__).resolve().parent
WEB = HERE.parent.parent
WEIGHTS = {"200": 200, "400": 400, "900": 900}
CHUNK = 350
SITE_DIRS = ["v[589]-*", "v1[0-9]-*"]   # 首块字表从这些版本目录里收字

def site_text() -> str:
    parts = []
    files = list(WEB.glob("shared/content.js"))
    for d in SITE_DIRS:
        files += list(WEB.glob(d + "/**/*.html")) + list(WEB.glob(d + "/**/*.js"))
    for p in files:
        parts.append(p.read_text("utf-8", errors="ignore"))
    for extra in sys.argv[2:]:
        parts.append(Path(extra).read_text("utf-8", errors="ignore"))
    return "".join(parts)

def gb2312_hanzi() -> list[int]:
    out = []
    for cp in range(0x4E00, 0xA000):
        try:
            chr(cp).encode("gb2312")
            out.append(cp)
        except UnicodeEncodeError:
            pass
    return out

def ranges(cps: list[int]) -> str:
    cps = sorted(set(cps))
    out, start, prev = [], None, None
    for c in cps:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            out.append((start, prev)); start = prev = c
    if start is not None:
        out.append((start, prev))
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in out)

def main():
    src = sys.argv[1]
    base = TTFont(src)
    cmap = set(base.getBestCmap())

    basic = set(range(0x20, 0x7F)) | set(range(0x3000, 0x3040)) | set(range(0xFF00, 0xFFF0)) \
        | {0xB7, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x00D7, 0x2192}
    used = {ord(ch) for ch in site_text() if ord(ch) >= 0x20}
    first = sorted((basic | used) & cmap)
    rest = [c for c in gb2312_hanzi() if c in cmap and c not in set(first)]
    chunks = [first] + [rest[i:i + CHUNK] for i in range(0, len(rest), CHUNK)]

    css = ["/* 思源宋体 Noto Serif SC · SIL Open Font License 1.1 · 由 build_fonts.py 生成，勿手改 */"]
    for name, wght in WEIGHTS.items():
        tmp = HERE / f"_inst-{name}.ttf"
        instancer.instantiateVariableFont(TTFont(src), {"wght": wght}).save(tmp)
        for i, cps in enumerate(chunks):
            opts = subset.Options()
            opts.flavor = "woff2"
            opts.layout_features = ["*"]
            opts.name_IDs = ["*"]
            opts.notdef_outline = True
            sub = subset.Subsetter(opts)
            sub.populate(unicodes=cps)
            f = TTFont(tmp)  # subset 会改动字体对象，每片重新读一份
            sub.subset(f)
            out = HERE / f"serif-{name}-{i:02d}.woff2"
            f.flavor = "woff2"
            f.save(out)
            css.append(
                "@font-face{font-family:'SHU Serif';font-style:normal;font-weight:%s;font-display:swap;"
                "src:url('serif-%s-%02d.woff2') format('woff2');unicode-range:%s}" % (name, name, i, ranges(cps))
            )
            print(out.name, out.stat().st_size // 1024, "KB", len(cps), "字")
        tmp.unlink()
    css.append("/* Geist Mono · SIL OFL 1.1（vercel/geist-font，经 Fontsource 切片，未修改） */")
    css.append("@font-face{font-family:'Geist Mono';font-style:normal;font-weight:100 900;font-display:swap;"
               "src:url('GeistMono-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2212}")
    (HERE / "fonts.css").write_text("\n".join(css) + "\n", "utf-8")
    print("fonts.css 已写出")

if __name__ == "__main__":
    main()
