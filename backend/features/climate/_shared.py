"""Small helpers shared across the Climate feature's transport layers."""

from __future__ import annotations


def parse_lat_long(near: str) -> tuple[float, float]:
    """Parse a ``"lat,long"`` string into a coordinate pair.

    Raises ``ValueError`` on anything that is not two comma-separated
    numbers. Callers (HTTP route, MCP tool) catch it and translate into
    their own error protocol — the parsing itself lives here so the two
    transports cannot drift.
    """
    parts = near.split(",")
    if len(parts) != 2:
        raise ValueError("expected 'lat,long'")
    return (float(parts[0]), float(parts[1]))
