"""
H3 compatibility shim.
Supports both h3 v3 (h3_to_geo) and h3 v4+ (cell_to_latlng) API.
Import this instead of h3 directly.
"""
import h3 as _h3

# Detect API version
_v4 = hasattr(_h3, 'cell_to_latlng')


def h3_to_geo(h3_index):
    """Return (lat, lon) for h3 cell."""
    if _v4:
        return _h3.cell_to_latlng(h3_index)
    return _h3.h3_to_geo(h3_index)


def h3_to_geo_boundary(h3_index):
    """Return list of (lat, lon) tuples for cell boundary."""
    if _v4:
        return _h3.cell_to_boundary(h3_index)
    return _h3.h3_to_geo_boundary(h3_index)


def h3_is_valid(h3_index):
    """Check if h3 index is valid."""
    if _v4:
        return _h3.is_valid_cell(h3_index)
    return _h3.h3_is_valid(h3_index)


def h3_distance(h3_a, h3_b):
    """Grid distance between two cells."""
    if _v4:
        return _h3.grid_distance(h3_a, h3_b)
    return _h3.h3_distance(h3_a, h3_b)


def h3_line(h3_from, h3_to):
    """Grid path between two cells."""
    if _v4:
        return _h3.grid_path_cells(h3_from, h3_to)
    return _h3.h3_line(h3_from, h3_to)


def geo_to_h3(lat, lon, resolution):
    """Convert lat/lon to h3 index."""
    if _v4:
        return _h3.latlng_to_cell(lat, lon, resolution)
    return _h3.geo_to_h3(lat, lon, resolution)


def k_ring(h3_index, k=1):
    """Get ring of cells around h3_index."""
    if _v4:
        return _h3.grid_disk(h3_index, k)
    return _h3.k_ring(h3_index, k)


def h3_get_resolution(h3_index):
    """Get resolution of cell."""
    if _v4:
        return _h3.get_resolution(h3_index)
    return _h3.h3_get_resolution(h3_index)
