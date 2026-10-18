"""
Precise terrain of any hex from real Earth data (owner 2026-10-18: "ocean, mountain, desert, countryside, ice…
needs to be really precise — those info are known").

- Land cover : ESA WorldCover 2021, 10 m, 11 classes (tree cover, shrubland, grassland, cropland, built-up,
               bare/sparse, snow & ice, water, wetland, mangroves, moss & lichen) — read from the public Terrascope
               WMTS (PNG tiles, legend colours → class). Licence CC BY 4.0: "© ESA WorldCover project 2021 /
               Contains modified Copernicus Sentinel data (2021)".
- Elevation  : AWS Terrain Tiles (Terrarium PNG: metres = R·256 + G + B/256 − 32768; bathymetry below sea level).

A res-8 hex (~0.9 km across) is sampled at its centre + 6 points on a 350 m ring; the majority class wins.
Mountain = high (≥ 2000 m) or rugged (relief ≥ 350 m across ~3 km). Ocean = no land cover and below sea level.
Coastal = land hex with sea among its samples. Tiles are cached on disk; when a source is unreachable the
caller falls back to the region/latitude rules (terrain_rules.py) and retries later.
"""
import io
import logging
import math
import os
import time
from collections import Counter
from functools import lru_cache
from pathlib import Path
from urllib.request import Request, urlopen

logger = logging.getLogger('terra_domini.landcover')

WC_URL = ('https://services.terrascope.be/wmts/v2?layer=WORLDCOVER_2021_MAP&style=&tilematrixset=EPSG:3857'
          '&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image%2Fpng&TileMatrix=EPSG:3857:{z}&TileCol={x}&TileRow={y}')
DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
Z_LC, Z_DEM = 13, 11            # ~19 m and ~76 m per pixel at the equator
UA = 'HEXOD-terrain/1.0 (https://hexod.paintit.click)'
CACHE = Path(os.environ.get('HEXOD_TILE_CACHE') or Path(__file__).resolve().parents[4] / 'data' / 'tile_cache')
ATTRIBUTION = '© ESA WorldCover 2021 (Copernicus Sentinel data) · AWS Terrain Tiles'

# WorldCover legend colour → class
WC_COLORS = {
    (0, 100, 0): 'tree', (255, 187, 34): 'shrub', (255, 255, 76): 'grass', (240, 150, 255): 'crop',
    (250, 0, 0): 'built', (180, 180, 180): 'bare', (240, 240, 240): 'ice', (0, 100, 200): 'water',
    (0, 150, 160): 'wetland', (0, 207, 117): 'mangrove', (250, 230, 160): 'moss',
}
# WorldCover class → game biome
CLASS_BIOME = {'tree': 'forest', 'mangrove': 'forest', 'shrub': 'grassland', 'grass': 'grassland', 'crop': 'farmland',
               'built': 'urban', 'bare': 'desert', 'ice': 'ice', 'moss': 'tundra', 'wetland': 'wetland', 'water': 'lake'}
URLS = {'wc': WC_URL, 'dem': DEM_URL}
SOURCE_DOWN = {}                # source → retry-after timestamp (circuit breaker)


def _tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    lr = math.radians(max(-85.05, min(85.05, lat)))
    y = (1 - math.log(math.tan(lr) + 1 / math.cos(lr)) / math.pi) / 2 * n
    return int(x), int(y), int((x % 1) * 256), int((y % 1) * 256)


@lru_cache(maxsize=96)
def _tile(kind, z, x, y):
    """Decoded RGBA tile (PIL image) or None. Disk cache first; one failure pauses the source 5 min."""
    from PIL import Image
    url_tpl = URLS[kind]
    f = CACHE / kind / str(z) / str(x) / f'{y}.png'
    if f.exists():
        return Image.open(f).convert('RGBA') if f.stat().st_size else None
    if SOURCE_DOWN.get(kind, 0) > time.time():
        raise ConnectionError('source paused')
    try:
        req = Request(url_tpl.format(z=z, x=x, y=y), headers={'User-Agent': UA})
        with urlopen(req, timeout=6) as r:
            data = r.read()
    except Exception as e:
        if getattr(e, 'code', None) == 404:       # no tile there (open ocean for WorldCover) — cache the miss
            f.parent.mkdir(parents=True, exist_ok=True); f.write_bytes(b'')
            return None
        SOURCE_DOWN[kind] = time.time() + 300
        logger.info(f'terrain source unreachable ({e}) — fallback rules for 5 min')
        raise ConnectionError(str(e))
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(data)
    return Image.open(io.BytesIO(data)).convert('RGBA')


def _nearest_class(rgba):
    r, g, b, a = rgba
    if a < 128:
        return None                                # no data (open sea)
    best, bd = None, 1e9
    for (cr, cg, cb), cls in WC_COLORS.items():
        d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if d < bd:
            best, bd = cls, d
    return best if bd < 3500 else None


def land_class(lat, lon):
    x, y, px, py = _tile_xy(lat, lon, Z_LC)
    t = _tile('wc', Z_LC, x, y)
    return _nearest_class(t.getpixel((px, py))) if t else None


def elevation(lat, lon):
    x, y, px, py = _tile_xy(lat, lon, Z_DEM)
    t = _tile('dem', Z_DEM, x, y)
    if not t:
        return None
    r, g, b, _ = t.getpixel((px, py))
    return r * 256 + g + b / 256 - 32768


def _ring(lat, lon, km, n=6):
    dlat = km / 111.0
    dlon = km / (111.0 * max(0.2, math.cos(math.radians(lat))))
    return [(lat + dlat * math.sin(2 * math.pi * i / n), lon + dlon * math.cos(2 * math.pi * i / n)) for i in range(n)]


@lru_cache(maxsize=50000)
def classify(lat: float, lon: float):
    """(biome, reason, detail) from real data, or None when the sources are unreachable."""
    try:
        pts = [(lat, lon)] + _ring(lat, lon, 0.35)
        classes = [land_class(a, b) for a, b in pts]
        elev = [elevation(a, b) for a, b in pts]
        wide = [elevation(a, b) for a, b in _ring(lat, lon, 1.5, 8)]
    except ConnectionError:
        return None
    e = [v for v in elev if v is not None]
    e_all = e + [v for v in wide if v is not None]
    centre_e = elev[0] if elev[0] is not None else (sum(e) / len(e) if e else 0)
    sea = [c is None and (v is not None and v <= 0) for c, v in zip(classes, elev)]
    land = [c for c in classes if c]
    detail = {'elevation_m': round(centre_e), 'relief_m': round(max(e_all) - min(e_all)) if e_all else 0,
              'cover': dict(Counter(land).most_common(3))}
    if sum(sea) >= 4 or (not land and centre_e <= 0):
        return 'ocean', 'sea (ESA WorldCover / bathymetry)', detail
    top = Counter(land).most_common(1)[0][0] if land else 'bare'
    if top == 'water' and land.count('water') >= 4:
        return 'lake', 'inland water (ESA WorldCover)', detail
    if top == 'ice':
        return 'ice', 'snow and ice (ESA WorldCover)', detail
    if top != 'built' and (centre_e >= 2000 or detail['relief_m'] >= 350 and centre_e >= 600):
        return 'mountain', f"{round(centre_e)} m, relief {detail['relief_m']} m", detail
    if any(sea):
        return 'coastal', 'shoreline (ESA WorldCover / bathymetry)', detail
    return CLASS_BIOME.get(top, 'grassland'), f'{top} (ESA WorldCover)', detail
