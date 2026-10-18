"""
Global land/sea mask for terrain rules (owner 2026-10-18: "middle of the ocean must never say rural").
Source: Natural Earth land polygons 1:10m (public domain), via the world-atlas package (frontend/node_modules).
Output: data/landmask/land_0.02.bin.gz — packed bits, 0.02° per pixel (~2 km), 1 = land, rows north→south
(18000 px = 2250 bytes per row; ~20 MB in memory, <1 MB on disk). Run once:
  python3 scripts/build_landmask.py
"""
import gzip, json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'frontend' / 'node_modules' / 'world-atlas' / 'land-10m.json'
OUT = ROOT / 'data' / 'landmask' / 'land_0.02.bin.gz'
RES = 0.02
W, H = int(360 / RES), int(180 / RES)


def arcs_of(topo):
    sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
    out = []
    for arc in topo['arcs']:
        x = y = 0; pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring(arcs, idx):
    pts = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts


def main():
    topo = json.loads(SRC.read_text())
    arcs = arcs_of(topo)
    img = Image.new('1', (W, H), 0)
    d = ImageDraw.Draw(img)
    px = lambda p: ((p[0] + 180) / RES, (90 - p[1]) / RES)
    for geom in topo['objects']['land']['geometries']:
        polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']]
        for poly in polys:
            for k, r in enumerate(poly):
                pts = [px(p) for p in ring(arcs, r)]
                if len(pts) > 2:
                    d.polygon(pts, fill=0 if k else 1)   # first ring = land, others = holes (lakes/seas inside land)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(gzip.compress(img.tobytes(), 9))   # mode '1' → packed bits, MSB first
    print(OUT, OUT.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
