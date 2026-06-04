---
DATE: 2026-06-03
TIME: 17:12 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Fixed feature-owned unit config for catalog/domain fields,
       starting with Material density and conductivity.
RELATED:
  - ../PRD.md
  - phase-01-contract-and-registry.md
  - phase-02-field-config-ui.md
  - phase-03-grid-behavior.md
  - frontend/src/lib/units/material.ts
  - backend/features/project_document/tables/
---

# Phase 04 - Fixed Catalog Fields

## Objective

Apply fixed unit config to domain/catalog fields whose canonical SI unit
is part of the PH-Navigator contract.

## Policy

Material density and conductivity are built-in catalog/domain fields:

- density canonical SI: `density_kg_m3`;
- conductivity canonical SI: `conductivity_w_mk`.

These fields should render through the same Number with Units display
pipeline, but their unit config is fixed and not user-editable.

## Work

- Identify the current Material table/catalog implementation point.
- If Material table field defs already exist, seed density and
  conductivity with `config.units.mode = "fixed"`.
- If Material table is not implemented yet, add this requirement to its
  feature plan and add registry tests now.
- Ensure fixed fields show unit labels in headers and converted bare
  values in IP mode.
- Ensure field config modal displays fixed unit config read-only.
- Ensure backend rejects user mutations that attempt to change fixed
  unit config.
- Ensure plain built-in dimensionless fields remain plain Number.

## Material MVP Units

- Density: `kg_m3 <> lb_ft3`.
- Conductivity: `w_m_k <> btu_h_ft_f`.

Do not add `R/in` in MVP. It is a useful material display later, but it
is reciprocal/derived and should be a named display helper, not the
generic conductivity unit pair.

## Tests

- Material density and conductivity header labels update with global
  unit preference.
- Their cell values convert for display without changing stored values.
- Their unit controls are disabled in the field config modal.
- Mutation attempts to edit fixed unit config fail.
- User-created Number fields on the same table can still add editable
  unit config.

## Handoff Criteria

- Catalog/domain fixed-unit fields and user-created editable-unit fields
  can coexist in the same table.
- Fixed fields preserve canonical SI model meaning.
