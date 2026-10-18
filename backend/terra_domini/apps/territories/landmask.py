"""
Land or sea for any point on Earth, offline and instant (Natural Earth 1:10m land, rasterised at 0.02° by
scripts/build_landmask.py → data/landmask/land_0.02.bin.gz). The base truth of terrain_rules: a hex in the
middle of the ocean is ocean, whatever else is (un)reachable.
"""
import gzip
from functools import lru_cache
from pathlib import Path

RES = 0.02
W, H = int(360 / RES), int(180 / RES)
ROW = W // 8
MASK = Path(__file__).resolve().parents[4] / 'data' / 'landmask' / 'land_0.02.bin.gz'


@lru_cache(maxsize=1)
def _bits():
    return gzip.decompress(MASK.read_bytes()) if MASK.exists() else None


def is_land(lat: float, lon: float):
    """True / False, or None when the mask file is missing."""
    b = _bits()
    if b is None:
        return None
    x = min(W - 1, max(0, int((lon + 180) / RES)))
    y = min(H - 1, max(0, int((90 - lat) / RES)))
    return bool(b[y * ROW + x // 8] & (0x80 >> (x % 8)))


def sea_share(lat: float, lon: float, km: float = 0.6) -> float:
    """Share of sea among the hex centre and 6 points around it (coastline detection)."""
    import math
    dlat, dlon = km / 111.0, km / (111.0 * max(0.2, math.cos(math.radians(lat))))
    pts = [(lat, lon)] + [(lat + dlat * math.sin(a), lon + dlon * math.cos(a)) for a in (0, 1.047, 2.094, 3.142, 4.189, 5.236)]
    vals = [is_land(a, b) for a, b in pts]
    if None in vals:
        return 0.0
    return sum(1 for v in vals if not v) / len(vals)
