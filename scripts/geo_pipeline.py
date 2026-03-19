"""
Geo Pipeline — converts OpenStreetMap data into H3 hex territories.
Runs as a one-time bootstrap script per region, then incrementally.

Pipeline:
  1. Download OSM data via Overpass API
  2. Generate H3 hex grid at resolution 10 for the region
  3. Classify each hex by territory type (OSM land-use + elevation)
  4. Compute terrain modifiers (elevation → attack/defense)
  5. Mark Control Towers (ports, mountain passes, city centers)
  6. Upsert into Django Territory model

Usage:
  python scripts/geo_pipeline.py --bbox "41.0,2.0,43.5,4.5"  # Catalonia
  python scripts/geo_pipeline.py --country FR --resolution 10
  python scripts/geo_pipeline.py --h3-region 831fb4fffffffff   # H3 res-3 region
"""
import os
import sys
import json
import math
import logging
import argparse
import time
from typing import Generator

import django

# Setup Django before importing models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'terra_domini.settings.base')
django.setup()

import h3
import requests
from shapely.geometry import shape, Point, Polygon
from shapely.ops import unary_union

logger = logging.getLogger('terra_domini.geo_pipeline')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')


# ─── OSM land-use → territory type mapping ────────────────────────────────────

OSM_LANDUSE_MAP = {
    # Urban
    'residential': 'urban', 'commercial': 'urban', 'retail': 'urban',
    'civic': 'urban', 'institutional': 'urban', 'mixed': 'urban',
    # Industrial
    'industrial': 'industrial', 'port': 'coastal', 'railway': 'industrial',
    'quarry': 'industrial', 'landfill': 'industrial',
    # Rural / Agricultural
    'farmland': 'rural', 'farmyard': 'rural', 'meadow': 'rural',
    'allotments': 'rural', 'orchard': 'rural', 'vineyard': 'rural',
    'grass': 'rural',
    # Forest / Nature
    'forest': 'forest', 'wood': 'forest', 'nature_reserve': 'forest',
    'conservation': 'forest', 'scrub': 'forest',
    # Water
    'basin': 'water', 'reservoir': 'water', 'salt_pond': 'water',
}

OSM_NATURAL_MAP = {
    'wood': 'forest', 'scrub': 'forest', 'grassland': 'rural',
    'heath': 'forest', 'wetland': 'rural', 'beach': 'coastal',
    'coastline': 'coastal', 'water': 'water', 'bay': 'water',
    'peak': 'mountain', 'cliff': 'mountain', 'ridge': 'mountain',
}

# Elevation thresholds
MOUNTAIN_THRESHOLD_M = 800
HILL_THRESHOLD_M = 300

# Territory production base rates by type
BASE_PRODUCTION = {
    'urban':      {'energy': 20, 'food': 5,  'credits': 30, 'culture': 15, 'materials': 8,  'intel': 5},
    'rural':      {'energy': 5,  'food': 40, 'credits': 5,  'culture': 5,  'materials': 15, 'intel': 2},
    'industrial': {'energy': 30, 'food': 2,  'credits': 20, 'culture': 2,  'materials': 40, 'intel': 5},
    'coastal':    {'energy': 10, 'food': 25, 'credits': 25, 'culture': 10, 'materials': 10, 'intel': 15},
    'landmark':   {'energy': 10, 'food': 5,  'credits': 50, 'culture': 60, 'materials': 5,  'intel': 8},
    'mountain':   {'energy': 15, 'food': 5,  'credits': 8,  'culture': 8,  'materials': 30, 'intel': 20},
    'forest':     {'energy': 5,  'food': 20, 'credits': 5,  'culture': 15, 'materials': 25, 'intel': 10},
    'water':      {'energy': 0,  'food': 0,  'credits': 0,  'culture': 0,  'materials': 0,  'intel': 0},
}

TERRAIN_COMBAT = {
    'urban':      {'attack': 0.8, 'defense': 1.3, 'movement': 1.0},
    'rural':      {'attack': 1.0, 'defense': 1.0, 'movement': 1.0},
    'industrial': {'attack': 0.9, 'defense': 1.1, 'movement': 1.0},
    'coastal':    {'attack': 1.1, 'defense': 0.9, 'movement': 1.2},
    'landmark':   {'attack': 0.7, 'defense': 1.5, 'movement': 0.9},
    'mountain':   {'attack': 0.6, 'defense': 1.8, 'movement': 2.0},
    'forest':     {'attack': 0.8, 'defense': 1.4, 'movement': 1.5},
    'water':      {'attack': 1.0, 'defense': 1.0, 'movement': 1.0},
}


class GeoPipeline:

    OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
    ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup'

    def __init__(self, resolution: int = 10, batch_size: int = 500):
        self.resolution = resolution
        self.batch_size = batch_size

    def run_for_bbox(self, south: float, west: float, north: float, east: float) -> dict:
        """Process all H3 hexes in a bounding box."""
        logger.info(f"Pipeline start: bbox ({south},{west}) → ({north},{east}) res={self.resolution}")

        # 1. Generate H3 hexes covering bbox
        hex_ids = self._bbox_to_h3(south, west, north, east)
        logger.info(f"Generated {len(hex_ids)} H3 cells")

        # 2. Download OSM data for region
        osm_data = self._fetch_osm_landuse(south, west, north, east)
        landmark_data = self._fetch_osm_landmarks(south, west, north, east)

        # 3. Build spatial index of OSM polygons
        landuse_features = self._parse_osm_features(osm_data)
        landmark_features = self._parse_osm_features(landmark_data)

        # 4. Process each hex
        processed = 0
        errors = 0

        for batch in self._batched(hex_ids, self.batch_size):
            try:
                self._process_hex_batch(batch, landuse_features, landmark_features)
                processed += len(batch)
                logger.info(f"Progress: {processed}/{len(hex_ids)} hexes processed")
            except Exception as e:
                logger.error(f"Batch error: {e}", exc_info=True)
                errors += len(batch)

            # Respect rate limits
            time.sleep(0.1)

        return {'processed': processed, 'errors': errors, 'total': len(hex_ids)}

    def _bbox_to_h3(self, south: float, west: float, north: float, east: float) -> list[str]:
        """Get all H3 cells covering a bounding box."""
        # Sample points across bbox and collect H3 cells
        cells = set()
        lat_step = 0.001  # ~111m
        lon_step = 0.001

        lat = south
        while lat <= north:
            lon = west
            while lon <= east:
                cell = h3.geo_to_h3(lat, lon, self.resolution)
                cells.add(cell)
                lon += lon_step
            lat += lat_step

        return list(cells)

    def _fetch_osm_landuse(self, s: float, w: float, n: float, e: float) -> dict:
        """Fetch land-use polygons from Overpass API."""
        query = f"""
        [out:json][timeout:120];
        (
          way["landuse"]({s},{w},{n},{e});
          relation["landuse"]({s},{w},{n},{e});
          way["natural"]({s},{w},{n},{e});
          relation["natural"]({s},{w},{n},{e});
          way["leisure"]({s},{w},{n},{e});
        );
        out body geom;
        """
        return self._overpass_query(query)

    def _fetch_osm_landmarks(self, s: float, w: float, n: float, e: float) -> dict:
        """Fetch POIs, landmarks, ports, airports."""
        query = f"""
        [out:json][timeout:60];
        (
          node["tourism"="attraction"]({s},{w},{n},{e});
          node["historic"]({s},{w},{n},{e});
          node["amenity"="place_of_worship"]({s},{w},{n},{e});
          node["aeroway"="aerodrome"]({s},{w},{n},{e});
          node["port"]({s},{w},{n},{e});
          node["place"~"city|town"]({s},{w},{n},{e});
          way["building"="cathedral"]({s},{w},{n},{e});
          way["historic"="castle"]({s},{w},{n},{e});
        );
        out body geom;
        """
        return self._overpass_query(query)

    def _overpass_query(self, query: str) -> dict:
        """Execute Overpass API query with retry."""
        for attempt in range(3):
            try:
                resp = requests.post(
                    self.OVERPASS_URL,
                    data={'data': query},
                    timeout=150,
                )
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                if attempt < 2:
                    wait = 10 * (attempt + 1)
                    logger.warning(f"Overpass attempt {attempt+1} failed: {e}. Retrying in {wait}s")
                    time.sleep(wait)
                else:
                    logger.error(f"Overpass API failed after 3 attempts: {e}")
                    return {'elements': []}

    def _parse_osm_features(self, osm_data: dict) -> list[dict]:
        """Parse Overpass JSON into list of {geometry, tags} dicts."""
        features = []
        for el in osm_data.get('elements', []):
            tags = el.get('tags', {})
            geom = None

            if el['type'] == 'node' and 'lat' in el and 'lon' in el:
                geom = Point(el['lon'], el['lat'])
            elif el['type'] == 'way' and 'geometry' in el:
                coords = [(g['lon'], g['lat']) for g in el['geometry']]
                if len(coords) >= 3:
                    try:
                        geom = Polygon(coords)
                    except Exception:
                        pass
            # Relations (complex multipolygons) skipped for simplicity

            if geom and geom.is_valid:
                features.append({'geom': geom, 'tags': tags})

        return features

    def _classify_hex(self, h3_idx: str, landuse_features: list, landmark_features: list) -> dict:
        """Determine territory type and properties for a single H3 hex."""
        # Get hex center
        center_lat, center_lon = h3.h3_to_geo(h3_idx)
        center_point = Point(center_lon, center_lat)

        # Get hex boundary as Shapely polygon
        boundary = h3.h3_to_geo_boundary(h3_idx)  # (lat, lon) pairs
        hex_poly = Polygon([(lon, lat) for lat, lon in boundary])

        # ── OSM classification ───────────────────────────────────────────────
        territory_type = 'rural'  # Default
        matched_area = 0.0

        for feature in landuse_features:
            try:
                if not feature['geom'].intersects(hex_poly):
                    continue
                intersection_area = feature['geom'].intersection(hex_poly).area
                if intersection_area > matched_area:
                    tags = feature['tags']
                    landuse = tags.get('landuse', '')
                    natural = tags.get('natural', '')
                    mapped = OSM_LANDUSE_MAP.get(landuse) or OSM_NATURAL_MAP.get(natural)
                    if mapped:
                        territory_type = mapped
                        matched_area = intersection_area
            except Exception:
                continue

        # ── Landmark detection ───────────────────────────────────────────────
        is_landmark = False
        landmark_name = ''
        landmark_bonus: dict = {}

        for feature in landmark_features:
            try:
                if not feature['geom'].intersects(hex_poly.buffer(0.001)):
                    continue
                tags = feature['tags']
                name = tags.get('name', '')
                if name:
                    is_landmark = True
                    landmark_name = name
                    territory_type = 'landmark'
                    # Famous landmarks get production bonus
                    if tags.get('tourism') == 'attraction' or tags.get('historic'):
                        landmark_bonus = {'credits': 3.0, 'culture': 5.0}
                    elif tags.get('aeroway') == 'aerodrome':
                        landmark_bonus = {'intel': 3.0, 'materials': 2.0}
                    break
            except Exception:
                continue

        # ── Control Tower detection ──────────────────────────────────────────
        is_control_tower = False
        tower_type = ''

        # Airports → Arsenal tower
        if any(f['tags'].get('aeroway') == 'aerodrome' and f['geom'].intersects(hex_poly)
               for f in landmark_features):
            is_control_tower = True
            tower_type = 'arsenal'

        # Ports → Radar tower (coastal chokepoint)
        elif territory_type == 'coastal' and any(
            'port' in f['tags'] and f['geom'].intersects(hex_poly.buffer(0.005))
            for f in landmark_features
        ):
            is_control_tower = True
            tower_type = 'radar'

        # City centers → Market tower
        elif any(f['tags'].get('place') in ('city', 'town') and f['geom'].intersects(hex_poly.buffer(0.01))
                 for f in landmark_features):
            is_control_tower = True
            tower_type = 'market'

        # ── Terrain combat modifiers ─────────────────────────────────────────
        terrain = TERRAIN_COMBAT.get(territory_type, TERRAIN_COMBAT['rural'])
        prod = BASE_PRODUCTION.get(territory_type, BASE_PRODUCTION['rural'])

        return {
            'h3_index': h3_idx,
            'h3_resolution': self.resolution,
            'territory_type': territory_type,
            'is_landmark': is_landmark,
            'landmark_name': landmark_name,
            'landmark_bonus': landmark_bonus,
            'is_control_tower': is_control_tower,
            'control_tower_type': tower_type,
            'terrain_attack_modifier': terrain['attack'],
            'terrain_defense_modifier': terrain['defense'],
            'terrain_movement_cost': terrain['movement'],
            'resource_energy': prod['energy'],
            'resource_food': prod['food'],
            'resource_credits': prod['credits'],
            'resource_culture': prod['culture'],
            'resource_materials': prod['materials'],
            'resource_intel': prod['intel'],
            # Geo coords for PostGIS
            'center_lat': center_lat,
            'center_lon': center_lon,
        }

    def _process_hex_batch(self, hex_ids: list, landuse_features: list, landmark_features: list) -> None:
        """Classify and upsert a batch of hexes to DB."""
        from terra_domini.apps.territories.models import Territory
        from django.contrib.gis.geos import Point as GEOSPoint, Polygon as GEOSPolygon
        from django.db import connection

        territories_data = []
        for h3_idx in hex_ids:
            data = self._classify_hex(h3_idx, landuse_features, landmark_features)
            territories_data.append(data)

        # Bulk upsert using update_or_create
        for data in territories_data:
            # Build PostGIS geometries
            center_lat = data.pop('center_lat')
            center_lon = data.pop('center_lon')

            # H3 boundary → PostGIS polygon
            boundary = h3.h3_to_geo_boundary(data['h3_index'])
            ring_coords = [(lon, lat) for lat, lon in boundary]
            ring_coords.append(ring_coords[0])  # close ring

            try:
                geom = GEOSPolygon(ring_coords, srid=4326)
                center = GEOSPoint(center_lon, center_lat, srid=4326)
            except Exception as e:
                logger.warning(f"PostGIS geom error for {data['h3_index']}: {e}")
                geom = None
                center = None

            Territory.objects.update_or_create(
                h3_index=data['h3_index'],
                defaults={
                    **data,
                    'geom': geom,
                    'center': center,
                    'stockpile_capacity': 1000.0,
                }
            )

    @staticmethod
    def _batched(lst: list, n: int) -> Generator:
        for i in range(0, len(lst), n):
            yield lst[i:i + n]


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Terra Domini Geo Pipeline')
    parser.add_argument('--bbox', help='south,west,north,east (e.g. 48.7,2.1,49.0,2.6)')
    parser.add_argument('--resolution', type=int, default=10)
    parser.add_argument('--batch-size', type=int, default=500)
    parser.add_argument('--region', help='Named region preset', choices=['paris', 'london', 'tokyo', 'nyc', 'test'])
    args = parser.parse_args()

    REGION_PRESETS = {
        'paris':  (48.70, 2.10, 49.00, 2.60),
        'london': (51.35, -0.55, 51.70, 0.20),
        'tokyo':  (35.50, 139.55, 35.85, 139.95),
        'nyc':    (40.55, -74.10, 40.90, -73.70),
        'test':   (48.82, 2.28, 48.88, 2.36),  # Central Paris only
    }

    if args.region:
        bbox = REGION_PRESETS[args.region]
        logger.info(f"Using region preset: {args.region} → bbox {bbox}")
    elif args.bbox:
        parts = [float(x) for x in args.bbox.split(',')]
        if len(parts) != 4:
            parser.error('--bbox requires 4 values: south,west,north,east')
        bbox = tuple(parts)
    else:
        parser.error('Provide --bbox or --region')

    pipeline = GeoPipeline(resolution=args.resolution, batch_size=args.batch_size)
    result = pipeline.run_for_bbox(*bbox)

    logger.info(
        f"Pipeline complete. Processed: {result['processed']}, "
        f"Errors: {result['errors']}, Total: {result['total']}"
    )


if __name__ == '__main__':
    main()
