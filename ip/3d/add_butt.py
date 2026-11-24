"""
给 zhi_v2.stl 加一个“小翘臀”：网格 → 体素占据 → 距离变换得到近似 SDF，
与腰后下方两个小椭球做平滑并集（smooth-min），再 Marching Cubes 重建。
运行：python add_butt.py   输出 zhi_v3.stl / zhi_v3_preview.png（预览复用 postprocess_gen 的画法）
"""
import numpy as np, trimesh, os
from scipy import ndimage
from skimage import measure
OUT = os.path.dirname(os.path.abspath(__file__))
P = 0.25  # mm voxel
m = trimesh.load(os.path.join(OUT, "zhi_v2.stl"))
pad = 6.0
lo = m.bounds[0] - pad; hi = m.bounds[1] + pad
vox = m.voxelized(P).fill()
occ = np.zeros(np.ceil((hi - lo) / P).astype(int) + 1, bool)
idx = np.round((vox.points - lo) / P).astype(int)
occ[idx[:, 0], idx[:, 1], idx[:, 2]] = True
occ = ndimage.binary_closing(occ, iterations=1)
sdf = (ndimage.distance_transform_edt(~occ) - ndimage.distance_transform_edt(occ)) * P
sdf = ndimage.gaussian_filter(sdf, sigma=1.6)  # remove voxel terracing from the distance transform
g = np.stack(np.meshgrid(*[lo[i] + np.arange(occ.shape[i]) * P for i in range(3)], indexing="ij"), -1)

def ellipsoid(p, c, r):
    q = (p - np.array(c)) / np.array(r)
    k0 = np.linalg.norm(q, axis=-1); k1 = np.linalg.norm(q / np.array(r), axis=-1)
    return k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)
def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)

# back is +Y; two cheeks just above the feet, slightly apart, fused into the body
cheeks = smin(ellipsoid(g, (-5.0, 17.0, 18.5), (9.0, 8.0, 8.5)),
              ellipsoid(g, ( 5.0, 17.0, 18.5), (9.0, 8.0, 8.5)), 1.5)
d = smin(sdf, cheeks, 7.0)
d[..., :int(round((0 - lo[2]) / P))] = 1.0   # keep the flat base at z=0
v, f, n, _ = measure.marching_cubes(d, 0.0, spacing=(P, P, P))
r = trimesh.Trimesh(v + lo, f, process=True)
r = max(r.split(only_watertight=False), key=lambda p: len(p.faces))
trimesh.smoothing.filter_taubin(r, lamb=0.5, nu=-0.53, iterations=12)
r = r.simplify_quadric_decimation(face_count=300000)
r = r.slice_plane(plane_origin=[0, 0, 0.05], plane_normal=[0, 0, 1], cap=True)
r.apply_translation([0, 0, -r.bounds[0][2]])
trimesh.repair.fix_normals(r)
if r.volume < 0: r.invert()
r.export(os.path.join(OUT, "zhi_v3.stl"))
print(f"zhi_v3: extents {np.round(r.extents,1)} mm, volume {r.volume/1000:.1f} cm3, faces {len(r.faces)}, watertight {r.is_watertight}")
