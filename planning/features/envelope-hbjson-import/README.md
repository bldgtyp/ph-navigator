---
DATE: 2026-06-23
TIME: 17:17 EDT
STATUS: Research / design — outline only (no implementation yet)
AUTHOR: Ed (via Claude)
SCOPE: Add "Upload HBJSON" to ENVELOPE → Assemblies, the inverse of the existing
  "Download HBJSON". Parse a PH-Navigator-native construction library file, match
  its materials against the project + global catalog (creating new project
  materials as needed), and write the assemblies into the active version's draft
  through the existing envelope-command pipeline — with a preview the user
  confirms before anything is written.
RELATED:
  - context/PRD.md, context/DATA_STORAGE.md, context/TECH_STACK.md
  - backend/features/envelope/hbjson_export.py (the pipeline we reverse)
  - backend/features/envelope/commands/materials.py (pick/match/create materials)
  - backend/features/envelope/ops.py (replace_assemblies / replace_project_materials)
  - backend/features/project_document/envelope_models.py (Assembly / ProjectMaterial / CatalogOrigin)
  - backend/features/catalogs/materials/ (catalog lookup + existing JSON import preview precedent)
  - frontend/src/features/envelope/routes/EnvelopePage.tsx (the "…" Assembly-actions menu)
  - planning/archive/materials-catalog-import-export/ (preview/plan UX precedent)
  - V1 precedent: ../ph-navigator/backend/features/assembly/routes/assembly.py
    (`add_assemblies_from_hbjson_constructions_route`)
---

# Envelope HBJSON Import — Feature Folder

## Scope

Mirror the existing **Download constructions HBJSON** action with an **Upload
constructions HBJSON** action in the same Envelope → Assemblies "…" menu. The
upload re-creates assemblies (and the project materials they reference) inside
the current version's **draft**, then the user Saves a Version as normal.

v1 accepts **two input shapes** (confirmed scope — decisions.md D1):

- **A. PHN-native** — the `PHNavigatorOpaqueConstructionLibrary` (schema 11)
  that PHN already produces. It only *mimics* the Honeybee shape; it is not
  produced by, and does not require, the honeybee libraries to read. Import is a
  direct **reverse of `hbjson_export.py`** — `json.loads` into our Pydantic
  models. Carries our native ids (`pmat_*`/`lyr_*`/`seg_*`) + `catalog_origin`.
- **B. Raw Honeybee-PH** — `OpaqueConstruction`(s) exported straight from
  Grasshopper/Rhino (a single object, a name-keyed group, or a full HB model).
  No `ph_nav`/`catalog_origin`. Parsed with the **honeybee-ph** library
  (already a backend dep) and decomposed layer→segment like V1; materials match
  by name/properties against the catalog, else created project-only.

Real workflows this unlocks:

1. **Round-trip** (A) — re-import a file exported from *this* project. Materials
   carry their original `pmat_*` ids → exact reuse.
2. **Cross-project copy** (A) — import a file from *another* project. `pmat_*`
   ids are foreign, but `catalog_origin.catalog_record_id` (`rec*`) is global →
   match/re-pick from the shared catalog, create the rest.
3. **Bring-in from Grasshopper** (B) — pull constructions modeled in
   honeybee-ph directly into a PHN project.

## Read order

1. `PRD.md` — the research synthesis: file format, what the export loses, the
   material-matching ladder, the preview→confirm flow, and the proposed
   backend/frontend seams.
2. `decisions.md` — the design calls that need Ed's sign-off before phasing.
3. `STATUS.md` — current state and next step.

## Out of scope (for v1)

- **Auto-adding imported materials to the GLOBAL `catalog_materials` table.**
  Default is to create them as project-only materials. "Promote to catalog" is
  a separate, later action (decisions.md D4).
- Apertures / windows (this file only contains opaque constructions).
- Install-time data (`segment.use_site_notes`, `segment.photo_asset_ids`) — not
  in the export and not design intent; left blank on import.
