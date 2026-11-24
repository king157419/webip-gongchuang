"""四视图预览：python preview.py zhi_v3.stl  → zhi_v3_preview.png（正面 / 侧面 / 背面 / 3/4 后侧）"""
import sys, os, numpy as np, trimesh
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
f = sys.argv[1]; OUT = os.path.dirname(os.path.abspath(__file__))
m = trimesh.load(os.path.join(OUT, f))
if len(m.faces) > 80000: m = m.simplify_quadric_decimation(face_count=80000)
V, F = m.vertices, m.faces
fig = plt.figure(figsize=(16, 4.4), dpi=110)
for i, (t, az, el) in enumerate([("正面", -90, 8), ("侧面", 0, 5), ("背面", 90, 8), ("3/4 后侧", 40, 18)]):
    ax = fig.add_subplot(1, 4, i + 1, projection="3d")
    a, e = np.radians(az), np.radians(el)
    eye = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
    tri = V[F]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1)[:, None] + 1e-12
    vis = (n @ eye) > 0; tri, n = tri[vis], n[vis]
    o = np.argsort(tri.mean(1) @ eye); tri, n = tri[o], n[o]
    L = eye * 0.6 + np.array([0.3, -0.3, 0.7]); L /= np.linalg.norm(L)
    s = np.clip(n @ L, 0, 1) * 0.75 + 0.25
    ax.add_collection3d(Poly3DCollection(tri, facecolors=np.c_[0.31 * s + 0.05, 0.76 * s + 0.05, 0.97 * s, np.ones_like(s)], edgecolors="none", antialiased=False))
    c = (V.max(0) + V.min(0)) / 2; R = (V.max(0) - V.min(0)).max() / 2
    ax.set_xlim(c[0] - R, c[0] + R); ax.set_ylim(c[1] - R, c[1] + R); ax.set_zlim(c[2] - R, c[2] + R)
    ax.view_init(el, az); ax.set_box_aspect((1, 1, 1)); ax.axis("off"); ax.set_title(t, fontname="Microsoft YaHei")
plt.tight_layout(); plt.savefig(os.path.join(OUT, f.replace(".stl", "_preview.png"))); print("ok")
