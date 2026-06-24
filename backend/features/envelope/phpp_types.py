"""Shared literals for the PHPP U-Value export.

A dependency-free leaf so both the pure logic (``phpp_export``) and the API
contract (``models.PhppPreflightItem``) can name these types without the
``models`` → ``phpp_export`` → ``thermal`` → ``models`` import cycle.
"""

from __future__ import annotations

from typing import Literal

UnitSystem = Literal["IP", "SI"]
ExportReason = Literal["too_many_layers", "too_many_pathways", "incomplete_materials"]
