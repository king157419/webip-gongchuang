"""为 zhi-v2.html 准备图片：从 ip/A_zhi、ip/3d、shots-v2 裁切 / 压缩。只读原图，不改原图。"""
from PIL import Image, ImageChops
from pathlib import Path
HERE = Path(__file__).resolve().parent
A = HERE.parent.parent / "A_zhi"
D3 = HERE.parent.parent / "3d"
SH = HERE.parent / "shots-v2"

def trim(im, pad=20, thr=242):
    g = im.convert("L").point(lambda v: 255 if v < thr else 0)
    bb = g.getbbox()
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0-pad), max(0, y0-pad), min(im.width, x1+pad), min(im.height, y1+pad)))

def whiten(im):
    """背景提到纯白（叠底到纸色上不留方框）：按四边中位色做增益，再把接近白的像素推到 255。"""
    im = im.convert("RGB")
    w, h = im.size
    edge = [im.getpixel((x, y)) for x in range(0, w, 7) for y in (2, h - 3)] +            [im.getpixel((x, y)) for y in range(0, h, 7) for x in (2, w - 3)]
    bg = [sorted(c[i] for c in edge)[len(edge) // 2] for i in range(3)]
    luts = []
    for i in range(3):
        g = 255 / max(bg[i], 200)
        luts += [min(255, round(v * g)) for v in range(256)]
    im = im.point(luts)
    lo = 236
    def push(v):
        if v <= lo: return v
        t = (v - lo) / (255 - lo)
        return round(v + (255 - v) * t * t)
    return im.point([push(v) for v in range(256)] * 3)

def save(im, name, maxw=1600, q=88, white=False):
    im = im.convert("RGB")
    if white: im = whiten(im)
    if im.width > maxw:
        im = im.resize((maxw, round(im.height*maxw/im.width)), Image.LANCZOS)
    im.save(HERE / name, quality=q, optimize=True, progressive=True)
    print(name, im.size)

o = lambda f: Image.open(A / f).convert("RGB")
save(trim(o("main.png"), 30), "main.jpg", 1400, white=True)
logo = o("ref_logo.png"); save(trim(logo.crop((0, 0, logo.width, 1010))), "logo_head.jpg", 900, white=True)
for v in ["C_front", "C_left", "C_back"]:
    save(trim(o(v + ".png"), 10), v + ".jpg", 1100, white=True)
tv2 = o("turnaround_v2.png"); save(trim(tv2.crop((620, 0, 1050, 945)), 10), "tv2_side.jpg", 700, white=True)
save(trim(tv2.crop((1050, 0, 1680, 945)), 10), "tv2_back.jpg", 700, white=True)
for v in "ABCD":
    save(trim(o(f"option_{v}.png"), 10), f"opt_{v}.jpg", 1100, white=True)
save(trim(o("option_A2.png"), 10), "opt_A2.jpg", 1100, white=True)
e = o("expressions.png"); h = e.width // 2
for i, (x, y) in enumerate([(0, 0), (h, 0), (0, h), (h, h)]):
    save(trim(e.crop((x, y, x+h, y+h)), 12), f"ex_{i+1}.jpg", 800, white=True)
for i in range(1, 5):
    save(trim(o(f"lenti_{i}.png"), 10), f"lenti_{i}.jpg", 800, white=True)
save(trim(o("flat.png"), 16), "flat.jpg", 1000, white=True)
save(o("scene_poster_v2.png"), "poster_v2.jpg", 1086, 90)
save(o("scene_poster.png"), "poster_v1.jpg", 700)
for f in ["scene_merch", "merch_keychain", "desk_bot", "family"]:
    save(o(f + ".png"), f + ".jpg", 1448, 88)
# 3D 预览：去掉图上的中文标题行，按视图切开
for name in ["zhi_C_preview", "zhi_v3_preview"]:
    p = Image.open(D3 / (name + ".png")).convert("RGB")
    for i, lab in enumerate(["front", "side", "back", "rear34"]):
        save(trim(p.crop((i*440, 60, i*440+440, 484)), 8), f"{name.split('_preview')[0]}_{lab}.jpg", 600, white=True)
# 官网截图
for f, box in [("v5-zhi-1440", None), ("v5-zhi-390", None), ("v15-object-1440", None),
               ("v14-toybox-b", None), ("v4-zhi-1440", None), ("v18-solder-r2-1440", None)]:
    im = Image.open(SH / (f + ".png")).convert("RGB")
    save(im if box is None else im.crop(box), "site_" + f + ".jpg", 1600, 86)

# 被打回的图（.omx/state 里留存的真实版本）
ST = A / ".omx" / "state"
for src, name in [(ST / "round-3" / "rear34-attempt-1.png", "rej_rear34_1.jpg"),
                  (ST / "round-4" / "option_A-attempt-1-native.png", "rej_optA_1.jpg"),
                  (ST / "round-4" / "option_D-attempt-1-native.png", "rej_optD_1.jpg")]:
    save(trim(Image.open(src).convert("RGB"), 10), name, 900, white=True)
save(trim(o("rear34.png"), 10), "rear34.jpg", 900, white=True)
# 官网导航栏原尺寸裁切（1.5 倍截图）
nav = Image.open(SH / "v5-zhi-1440.png").convert("RGB").crop((222, 6, 562, 90))
save(nav, "nav_v5.jpg", 1600, 92)
