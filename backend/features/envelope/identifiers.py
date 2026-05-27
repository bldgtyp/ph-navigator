"""Envelope identifier constants and short random ID generation."""

from __future__ import annotations

import secrets

ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
ID_PREFIX_ASSEMBLY = "asm"
ID_PREFIX_LAYER = "lyr"
ID_PREFIX_SEGMENT = "seg"
ID_PREFIX_PROJECT_MATERIAL = "pmat"


def new_id(prefix: str) -> str:
    """Generate compact document IDs; 36^12 gives high entropy without UUID-length JSON-Patch paths."""
    return f"{prefix}_{''.join(secrets.choice(ID_ALPHABET) for _ in range(12))}"
