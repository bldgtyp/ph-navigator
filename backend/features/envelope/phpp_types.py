"""Shared literals for the PHPP U-Value export.

A dependency-free leaf so both the pure logic (``phpp_export``) and the API
contract (``models.PhppPreflightItem``) can name these types without the
``models`` → ``phpp_export`` → ``thermal`` → ``models`` import cycle.
"""

from __future__ import annotations

from typing import Literal

from features.shared.units import UnitSystem as UnitSystem

ExportReason = Literal["too_many_layers", "too_many_pathways", "incomplete_materials", "no_thermal_layers"]
