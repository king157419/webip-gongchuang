"""
社团 IP 3D 打印模型生成脚本（SDF 隐式建模 + Marching Cubes）
-----------------------------------------------------------
三个角色都由简单几何体（椭球、胶囊、圆柱、圆环）“平滑融合”成一个整体，
因此导出的 STL 是单一水密实体，没有悬浮零件、没有细丝，适合 FDM / 光固化打印。
单位：毫米。站立高度约 62–72 mm，底部切平（Z=0）保证能自己站稳。

运行：python build_models.py      （依赖 numpy / scikit-image / trimesh / matplotlib）
输出：<name>.stl（打印用） + <name>_preview.png（四视图预览，按部件上色）
"""
import numpy as np, trimesh, os
from skimage import measure
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

OUT = os.path.dirname(os.path.abspath(__file__))
RES = 0.45  # mm voxel

# ---------- SDF primitives ----------
def ellipsoid(p, c, r):
    q = (p - np.array(c)) / np.array(r)
    k0 = np.linalg.norm(q, axis=-1)
    k1 = np.linalg.norm(q / np.array(r), axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)

def sphere(p, c, r):
    return np.linalg.norm(p - np.array(c), axis=-1) - r

def capsule(p, a, b, r):
    a, b = np.array(a, float), np.array(b, float)
    pa, ba = p - a, b - a
    h = np.clip((pa @ ba) / (ba @ ba), 0, 1)[..., None]
    return np.linalg.norm(pa - ba * h, axis=-1) - r

def cyl(p, c, axis, r, half, round_=1.0):
    q = p - np.array(c)
    ax = {"x": 0, "y": 1, "z": 2}[axis]
    h = np.abs(q[..., ax]) - (half - round_)
    rad = np.linalg.norm(np.delete(q, ax, axis=-1), axis=-1) - (r - round_)
    d = np.stack([rad, h], -1)
    return np.minimum(np.max(d, -1), 0) + np.linalg.norm(np.maximum(d, 0), axis=-1) - round_

def rbox(p, c, half, r):
    q = np.abs(p - np.array(c)) - (np.array(half) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=-1) + np.minimum(np.max(q, -1), 0) - r

def torus_xz(p, c, R, r):  # ring lying in the x-z plane (axis = y)
    q = p - np.array(c)
    xz = np.sqrt(q[..., 0] ** 2 + q[..., 2] ** 2) - R
    return np.sqrt(xz ** 2 + q[..., 1] ** 2) - r

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

def sub(a, b):  # a minus b
    return np.maximum(a, -b)

# ---------- characters ----------
# each returns: list of (part_name, colour, sdf_array, op) applied in order
def zhi(p):
    parts = []
    body = ellipsoid(p, (0, 0, 33), (24, 22, 31))
    for s in (-1, 1):
        body = smin(body, ellipsoid(p, (s * 10, -1, 5), (8.5, 9.5, 5.5)), 2.5)      # feet
        body = smin(body, ellipsoid(p, (s * 22.5, -1, 25), (6.5, 7.5, 10)), 2.5)     # arms
    parts.append(("body", "#4FC3F7", body))
    ph = np.minimum(cyl(p, (-23.5, 0, 43), "x", 11, 4.5, 2), cyl(p, (23.5, 0, 43), "x", 11, 4.5, 2))
    ant = np.minimum.reduce([capsule(p, (s * 8, 0, 58), (s * 11, 0, 66), 3.6) for s in (-1, 1)] +
                            [sphere(p, (s * 11.5, 0, 69), 5.2) for s in (-1, 1)])
    parts.append(("headphones+antennae", "#1565C0", np.minimum(ph, ant)))
    visor = rbox(p, (0, -19.6, 43), (16.5, 3.2, 8.5), 3.5)
    eyes = np.minimum.reduce([
        rbox(p, (-7, -23, 43), (3.6, 1.6, 3.6), 0.6),
        rbox(p, (7, -23, 44.5), (4.2, 1.6, 1.3), 0.6),
    ])
    parts.append(("visor", "#1A1F5C", sub(visor, eyes)))
    parts.append(("eyes+chest light", "#00E5FF", np.minimum(
        rbox(p, (-7, -22.2, 43), (3.6, 0.9, 3.6), 0.6) , np.minimum(
        rbox(p, (7, -22.2, 44.5), (4.2, 0.9, 1.3), 0.6), sphere(p, (0, -21.2, 27), 3.2)))))
    return parts

def neuri(p):
    parts = []
    body = ellipsoid(p, (0, 0, 28), (26, 23.5, 26))
    for s in (-1, 1):
        body = smin(body, ellipsoid(p, (s * 11, -4, 4.5), (8.5, 9.5, 5.5)), 3)
        body = smin(body, ellipsoid(p, (s * 24.5, -1, 26), (8, 8, 9.5)), 3)
    pts = [(0, 0, 50), (1, 0, 58), (5, 0, 63.5), (10, 0, 63), (12, 0, 59.5)]
    for a, b in zip(pts, pts[1:]):
        body = smin(body, capsule(p, a, b, 4.8), 2.5)
    belly = ellipsoid(p, (0, -21.5, 17), (13, 3.5, 10))
    eye = np.minimum(ellipsoid(p, (-9, -21.6, 31), (3.4, 2.2, 4.6)), ellipsoid(p, (9, -21.6, 31), (3.4, 2.2, 4.6)))
    parts.append(("body", "#5ED6C1", sub(smin(body, belly, 1.0), eye)))
    parts.append(("belly", "#F6FFF9", belly))
    nodes = np.minimum.reduce([sphere(p, (12.5, 0, 58), 5.6),
                               sphere(p, (0, -14.5, 46.5), 2.8), sphere(p, (-6.5, -18.5, 40.5), 2.8), sphere(p, (6.5, -18.5, 40.5), 2.8)])
    links = np.minimum.reduce([capsule(p, (0, -14.8, 46.5), (-6.5, -18.8, 40.5), 0.9),
                               capsule(p, (0, -14.8, 46.5), (6.5, -18.8, 40.5), 0.9),
                               capsule(p, (-6.5, -19.2, 40.5), (6.5, -19.2, 40.5), 0.9)])
    parts.append(("nodes", "#FFD54A", np.minimum(nodes, links)))
    parts.append(("eyes", "#111111", np.maximum(eye, ellipsoid(p, (0, 0, 28), (26.4, 23.9, 26.4)) )))
    return parts

def tong(p):
    parts = []
    body = sphere(p, (0, 0, 27.5), 24)
    for s in (-1, 1):
        body = smin(body, ellipsoid(p, (s * 22.5, 1, 26), (5.5, 9, 11.5)), 2.5)
    eye = np.minimum(sphere(p, (-8.5, -21.6, 33), 3.2), sphere(p, (8.5, -21.6, 33), 3.2))
    parts.append(("body", "#FFF6E8", sub(body, eye)))
    # crest: half-disc fan in the x-z plane, solid, with three engraved signal arcs
    fan = np.maximum(cyl(p, (0, 0, 44), "y", 19, 4.6, 2.2), -(p[..., 2] - 45))
    fan = smin(fan, capsule(p, (-9, 0, 47), (9, 0, 47), 4.4), 2)
    grooves = np.minimum.reduce([np.maximum(torus_xz(p, (0, -5.2, 45), R, 1.1), -(p[..., 2] - 46)) for R in (6, 11, 15.5)])
    crest = sub(fan, grooves)
    feet = np.minimum(ellipsoid(p, (-9, -6, 3.5), (7, 9.5, 4)), ellipsoid(p, (9, -6, 3.5), (7, 9.5, 4)))
    beak = ellipsoid(p, (0, -24.2, 29), (3.6, 4, 3))
    parts.append(("crest+beak+feet", "#FF7A45", np.minimum.reduce([crest, feet, beak])))
    badge = np.minimum(cyl(p, (2, -22.5, 19.5), "y", 6.2, 2.2, 1.2), sphere(p, (6.8, -23, 14.8), 2.2))
    parts.append(("badge", "#2F5BEA", badge))
    parts.append(("eyes", "#111111", np.maximum(eye, sphere(p, (0, 0, 27.5), 24.4))))
    return parts

CHARS = {"zhi": (zhi, (-38, 38), (-30, 30), (-1, 76)),
         "neuri": (neuri, (-38, 38), (-30, 30), (-1, 72)),
         "tong": (tong, (-36, 36), (-32, 32), (-1, 68))}

def build(name):
    fn, xr, yr, zr = CHARS[name]
    xs, ys, zs = [np.arange(a, b, RES) for a, b in (xr, yr, zr)]
    P = np.stack(np.meshgrid(xs, ys, zs, indexing="ij"), -1)
    parts = fn(P)
    d = parts[0][2]
    for _, _, s in parts[1:]:
        d = np.minimum(d, s)
    d = np.maximum(d, -P[..., 2])                       # flat base at z = 0
    v, f, _, _ = measure.marching_cubes(d, 0.0, spacing=(RES, RES, RES))
    v += np.array([xr[0], yr[0], zr[0]])
    mesh = trimesh.Trimesh(v, f, process=True)
    mesh.merge_vertices(); mesh.update_faces(mesh.nondegenerate_faces()); mesh.remove_unreferenced_vertices()
    mesh = max(mesh.split(only_watertight=False), key=lambda c: len(c.faces))  # drop sub-voxel slivers
    if not mesh.is_watertight: trimesh.repair.fill_holes(mesh)
    if mesh.volume < 0: mesh.invert()
    mesh.fix_normals()
    mesh.export(os.path.join(OUT, f"{name}.stl"))
    print(name, "watertight:", mesh.is_watertight, "faces:", len(mesh.faces),
          "size mm:", np.round(mesh.extents, 1), "volume cm3:", round(mesh.volume / 1000, 1))

    # preview: colour each face by the nearest part
    try:
        pm = mesh.simplify_quadric_decimation(face_count=24000) if len(mesh.faces) > 24000 else mesh
    except Exception:
        pm = mesh
    cen = pm.triangles_center
    G = cen[None, None, :, :]
    vals = np.stack([fn(G)[i][2][0, 0] for i in range(len(parts))], 0)
    idx = np.argmin(vals, 0)
    cols = np.array([matplotlib.colors.to_rgb(parts[i][1]) for i in idx])
    light = np.clip(pm.face_normals @ np.array([-.3, -.7, .65]) * .45 + .62, .25, 1)[:, None]
    fig = plt.figure(figsize=(16, 4.6), dpi=110)
    for i, (el, az, t) in enumerate([(8, -90, "正面"), (8, 0, "侧面"), (8, 90, "背面"), (22, -55, "3/4")]):
        ax = fig.add_subplot(1, 4, i + 1, projection="3d")
        e, a = np.radians(el), np.radians(az)
        vdir = np.array([np.cos(e) * np.cos(a), np.cos(e) * np.sin(a), np.sin(e)])
        vis = pm.face_normals @ vdir > 0                      # back-face culling
        order = np.argsort(cen[vis] @ vdir)                   # painter's order, far to near
        ax.add_collection3d(Poly3DCollection(pm.triangles[vis][order], facecolors=np.clip(cols * light, 0, 1)[vis][order], linewidths=0))
        m = 40
        ax.set_xlim(-m, m); ax.set_ylim(-m, m); ax.set_zlim(-2, 2 * m - 2)
        ax.set_box_aspect((1, 1, 1)); ax.view_init(el, az); ax.axis("off")
    plt.subplots_adjust(0, 0, 1, 1, 0, 0)
    plt.savefig(os.path.join(OUT, f"{name}_preview.png"), facecolor="white")
    plt.close(fig)

if __name__ == "__main__":
    import sys
    for n in (sys.argv[1:] or CHARS):
        build(n)
