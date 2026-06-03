"""Shared project-material field contracts for envelope workflows."""

from __future__ import annotations

from features.envelope.models import ProjectMaterialDriftFieldKey

PROJECT_MATERIAL_CATALOG_FIELDS: tuple[ProjectMaterialDriftFieldKey, ...] = (
    "color",
    "category",
    "conductivity_w_mk",
    "density_kg_m3",
    "emissivity",
    "name",
    "notes",
    "specific_heat_j_kgk",
)

PROJECT_MATERIAL_OVERRIDE_FIELDS: frozenset[ProjectMaterialDriftFieldKey] = frozenset(PROJECT_MATERIAL_CATALOG_FIELDS)
