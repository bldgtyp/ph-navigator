"""Shared project-material field contracts for envelope workflows."""

from __future__ import annotations

from features.envelope.models import ProjectMaterialDriftFieldKey

PROJECT_MATERIAL_CATALOG_FIELDS: tuple[ProjectMaterialDriftFieldKey, ...] = (
    "name",
    "category",
    "density_kg_m3",
    "specific_heat_j_kgk",
    "conductivity_w_mk",
    "emissivity",
    "color",
    "source",
    "url",
    "comments",
)

PROJECT_MATERIAL_OVERRIDE_FIELDS: frozenset[ProjectMaterialDriftFieldKey] = frozenset(PROJECT_MATERIAL_CATALOG_FIELDS)
