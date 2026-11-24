"""把 zhi-v2.html 打印成 A4 横版 PDF，并把每页渲染成 PNG 方便检查。
运行：D:/conda/miniconda3/python.exe zhi-v2-print.py [输出PDF] [检查图目录]
需要：playwright（用本机 Chrome）、PyMuPDF。
"""
import sys, threading, functools, http.server, socketserver
from pathlib import Path
from playwright.sync_api import sync_playwright
import fitz

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent                      # D:/desk/webip
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "deliverables" / "IP提案_小智_v2.pdf"
CHK = Path(sys.argv[2]) if len(sys.argv) > 2 else None

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page()
    pg.goto(f"http://127.0.0.1:{port}/ip/showcase/zhi-v2.html", wait_until="networkidle")
    pg.evaluate("Promise.all([...document.images].map(i=>i.decode().catch(()=>0)))")
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(1200)
    missing = pg.evaluate("""[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)""")
    fonts = pg.evaluate("""[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight)""")
    print("missing images:", missing)
    print("fonts loaded:", sorted(set(fonts)))
    pg.pdf(path=str(OUT), prefer_css_page_size=True, print_background=True)
    b.close()
srv.shutdown()

doc = fitz.open(OUT)
print(OUT, "pages:", doc.page_count, "size(pt):", doc[0].rect, "bytes:", OUT.stat().st_size)
if CHK:
    CHK.mkdir(parents=True, exist_ok=True)
    for i, page in enumerate(doc):
        page.get_pixmap(dpi=110).save(CHK / f"p{i+1:02d}.png")
