---
DATE: 2026-07-19
TIME: 14:35 EDT
STATUS: Planned
AUTHOR: Codex with Ed May
SCOPE: Implement schema v8 and canonical backend status semantics.
RELATED:
  - ../PRD.md
  - ../research.md
  - ../../../archive/dated/2026-06-27/beta-schema-evolution/schema-bump-checklist.md
---

# Phase 02 — Schema v8 and canonical backend

## Goal

Make `needed` the strict current backend value while preserving every old body
through the standing forward-upgrade lane.

## Ordered implementation steps

1. Add `_upgrade_v7_to_v8(raw)` and `UPGRADE_STEPS[7]`.
2. Traverse only:
   - `tables.project_materials`;
   - `tables.project_glazings`;
   - `tables.project_frames`.
3. For each mapping row, replace only
   `specification_status == "missing"` with `"needed"`; preserve all other
   values and stamp schema 8.
4. Bump `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` and the model literal to 8.
5. Change backend `SpecificationStatus`, row defaults, material/aperture
   factories, import-planning fallback, and project seed values to `needed`.
6. Remove built-in status translation tables in `documentation_summary.py` and
   `status_summary.py`; use typed pass-through while retaining custom option-id
   mapping and `unknown` fallback behavior.
7. Convert the Release-A request normalizer to the canonical direction:
   cached-client `missing` → internal `needed`. Keep it at the named boundary,
   not in persisted Pydantic row models.
8. Add permanent external adapters:
   - HBJSON/Honeybee import case-normalizes `MISSING`/`missing` and accepts
     `needed`, returning internal `needed`;
   - hand-built native `envelope/hbjson_export.py` material-ref export maps
     internal `needed` to external `MISSING`;
   - rich Honeybee/GH construction export maps internal `needed` to external
     `MISSING` before assigning `honeybee_ref.ref_status`;
   - current native API/MCP/GH aperture outputs use `needed`.
9. Add a frozen v7 input corpus containing all three target lists, mixed
   statuses, and at least one legacy `missing` in each.
10. Commit expected v8 snapshots. Never modify frozen input to hide drift.
11. Update prior expected snapshots through the full chain, schema fingerprint,
    and fixture-version registry.
12. Extend audit diagnostics (or add a read-only companion) to report per-path
    before/after counts and exact changed paths.

## Required automated cases

- all three lists rewrite `missing` → `needed`;
- complete/question/na remain unchanged in the canonical v7 corpus;
- an anomalous/transitional raw v7 dict already carrying `needed` is preserved
  in a focused upgrader unit test, not admitted as a valid frozen v7 fixture;
- absent/empty lists remain valid;
- second upgrade/serialization is byte-identical;
- exact diff is limited to schema version + permitted values;
- stale draft rewrite updates schema/ETag through existing behavior;
- Save/Save As writes v8;
- raw download still returns the original stored semantic v7 JSON value;
- Documentation/Status summaries pass through `needed`;
- `opt_status_needed` mapping remains unchanged;
- legacy Honeybee import, native HBJSON material-ref export/round-trip, and rich
  export all work.

## Verification

Run schema migration, guard, drift, audit CLI, summaries, command/import/export,
GH API, MCP, save/versioning, and seed tests. Run fixture strict audit and a
local/staging DB strict audit. Phase 02 is not merge-eligible until combined
with Phase 03 and full `make ci` is green.

## Exit gate

- v8 migration is exact, idempotent, and validated.
- Current backend domain contains no `missing` branch outside named legacy or
  external adapters.
- External Honeybee export does not raise on internal Needed.
- No production DB or body was written.

## Stop conditions

- Migration needs to infer state beyond exact value replacement.
- Exact diff touches any non-target path.
- Rich Honeybee round-trip cannot preserve semantics.
- A saved historical row must be mutated for typed reads to work.
