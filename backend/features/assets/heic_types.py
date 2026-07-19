"""HEIC/HEIF upload constants shared by registry and conversion code."""

from __future__ import annotations

HEIC_CONTENT_TYPES = frozenset({"image/heic", "image/heif"})
HEIC_FILE_EXTENSIONS = frozenset({".heic", ".heif"})
HEIC_FTYP_BRANDS = frozenset({b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1"})
