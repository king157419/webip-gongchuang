"""
把图生 3D（Hunyuan3D-2）导出的 GLB 整理成可打印 STL：
Y 轴朝上 → Z 轴朝上、缩放到指定高度、减面、底部切平并封口、校验水密，输出四视图预览。
运行：python postprocess_gen.py gen/zhi_hy3d.glb zhi_v2 74
"""
import sys, os, numpy as np, trimesh
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

src, name, height = sys.argv[1], sys.argv[2], float(sys.argv[3])
OUT = os.path.dirname(os.path.abspath(__file__))
m = trimesh.load(os.path.join(OUT, src), force="mesh")
m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))  # Y-up → Z-up
m.merge_vertices()
parts = m.split(only_watertight=False)
m = max(parts, key=lambda p: len(p.faces))
m.apply_translation(-m.bounds[0])
m.apply_scale(height / m.extents[2])
if len(m.faces) > 300000:
    m = m.simplify_quadric_decimation(face_count=300000)
trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=-0.53, iterations=8)
# flat base: cut off the lowest 1.2 mm and cap
cut = 1.2
m = m.slice_plane([0, 0, cut], [0, 0, 1], cap=True)
m.apply_translation([-m.bounds[0][0] - m.extents[0] / 2, -m.bounds[0][1] - m.extents[1] / 2, -m.bounds[0][2]])
trimesh.repair.fill_holes(m); trimesh.repair.fix_normals(m)
if m.volume < 0: m.invert()
m.export(os.path.join(OUT, f"{name}.stl"))
base = m.section([0, 0, 0.01], [0, 0, 1])
barea = base.to_2D()[0].area if base is not None else 0
print(f"{name}: extents {np.round(m.extents,1)} mm, volume {m.volume/1000:.1f} cm3, faces {len(m.faces)}, watertight {m.is_watertight}, base area {barea:.0f} mm2")

# preview: 4 views, lambert shading, back-face culled painter's sort
V, F = m.vertices, m.faces
if len(F) > 60000:
    mp = m.simplify_quadric_decimation(face_count=60000); V, F = mp.vertices, mp.faces
fig = plt.figure(figsize=(16, 4.4), dpi=110)
views = [("正面", -90, 8), ("侧面", 0, 8), ("背面", 90, 8), ("3/4", -55, 22)]
for i, (t, az, el) in enumerate(views):
    ax = fig.add_subplot(1, 4, i + 1, projection="3d")
    a, e = np.radians(az), np.radians(el)
    eye = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
    tri = V[F]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); n /= np.linalg.norm(n, axis=1)[:, None] + 1e-12
    vis = (n @ eye) > 0
    tri, n = tri[vis], n[vis]
    order = np.argsort(tri.mean(1) @ eye); tri, n = tri[order], n[order]
    light = eye * 0.6 + np.array([0.3, -0.3, 0.7]); light /= np.linalg.norm(light)
    s = np.clip(n @ light, 0, 1) * 0.75 + 0.25
    col = np.c_[0.31 * s + 0.05, 0.76 * s + 0.05, 0.97 * s, np.ones_like(s)]
    ax.add_collection3d(Poly3DCollection(tri, facecolors=col, edgecolors="none"))
    r = V.max(0) - V.min(0); c = (V.max(0) + V.min(0)) / 2; R = r.max() / 2
    ax.set_xlim(c[0] - R, c[0] + R); ax.set_ylim(c[1] - R, c[1] + R); ax.set_zlim(c[2] - R, c[2] + R)
    ax.view_init(el, az); ax.set_box_aspect((1, 1, 1)); ax.axis("off"); ax.set_title(t, fontname="Microsoft YaHei")
plt.tight_layout(); plt.savefig(os.path.join(OUT, f"{name}_preview.png")); print("preview saved")
