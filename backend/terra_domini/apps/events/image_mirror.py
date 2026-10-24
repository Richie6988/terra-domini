"""
Token pictures mirrored on our server (2026-10-24): a picture deleted or renamed on Wikimedia must not vanish from the
game. manage.py mirror_images copies every https image_url to MEDIA_ROOT/poi_img/<sha1 of the url>.<ext>; the master
DB and the ledger keep the original url (licence and credit trace), and import_hexod_db serves the local copy when it
exists. Files are named by the url, so a new picture chosen by the POI agent is simply a new file.
"""
import hashlib
from pathlib import Path

from django.conf import settings

SUBDIR = 'poi_img'
EXTS = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif'}


def mirror_dir() -> Path:
    return Path(settings.MEDIA_ROOT) / SUBDIR


def stem(url: str) -> str:
    return hashlib.sha1(url.encode('utf-8')).hexdigest()[:20]


def local_file(url: str):
    """the mirrored file of a url, or None"""
    d = mirror_dir()
    for ext in EXTS.values():
        f = d / (stem(url) + ext)
        if f.exists():
            return f
    return None


def served_prefix() -> str:
    return f"{settings.MEDIA_URL.rstrip('/')}/{SUBDIR}/"


def served_url(url: str) -> str:
    """the url the game shows: our copy when we have it, else the original"""
    if not url or not url.startswith('https://'):
        return url or ''
    f = local_file(url)
    return served_prefix() + f.name if f else url
