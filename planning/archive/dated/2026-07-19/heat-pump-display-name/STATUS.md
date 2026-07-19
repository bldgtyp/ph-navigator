---
DATE: 2026-07-18
TIME: 18:15
STATUS: Complete / archived and squash-merged to main
AUTHOR: Ed May (with Claude)
SCOPE: Execution state for heat-pump-display-name
RELATED: README.md, PRD.md, planning/archive/dated/2026-07-19/documentation-tab/STATUS.md
---

# Heat Pumps Display Name — STATUS

**State:** Complete — implemented and verified 2026-07-18 as
documentation-tab Phase 0. Archived 2026-07-19 with the Documentation tab
packet and included in the final squash merge to `main`.

## Survey answers (Stage 1)

1. **What differs from a conforming table (pumps):**
   - *Backend:* the four HP leaf seeds
     (`backend/features/project_document/tables/heat_pumps.py`) had
     **no `name` / "Display Name" FieldDef at all** — only `record_id`
     (display "Tag"). Conforming tables seed both `record_id` ("Tag") and
     `name` ("Display Name") (`tables/pumps.py:72-135`). HP rows also store
     `tag` as a **typed, required column** (`features/heat_pumps/models.py`,
     `min_length=1`) rather than in `custom_values`; that stays as-is.
   - *Frontend:* conforming tables put `identifierColumn(...)`
     (`shared/ui/data-table/columns.tsx:65` — sets `isIdentifier: true`,
     which is what pins/freezes the column) first, reading
     `custom_values.name`. The four HP column modules
     (`features/equipment/heat-pumps/*-columns.tsx`) instead started with a
     plain `tag` column, so Tag was the de-facto first column and nothing
     was marked as the identifier.
2. **status_summary fallback:** `name` → `record_id` → `tag`
   (`status_summary.py`; `_string_value` checks the typed attr then
   `custom_values`). HP rows resolved to the typed `tag` before; they now
   resolve to `name` (same string initially, via backfill). No derivation
   change needed.
3. **Existing documents:** HP rows could not carry display names (no
   FieldDef, no typed column). **Backfill decision (implemented):** document
   schema migration v4 → v5 (`migrations/upgrade.py::_upgrade_v4_to_v5`)
   merges the new `name` built-in FieldDef into all four HP leaf
   `field_defs` via `_merge_current_built_ins` and copies `tag` →
   `custom_values["name"]` once, where `name` is absent/empty. Old saved
   versions validate unchanged (forward-only upgrade lane).
4. **Downstream keyed on Tag (all intentionally unchanged):** link-chip
   labels (`heat-pumps/labels.ts`), add/rename uniqueness (`tags.ts`), sort
   order (`sorting.ts`), row modals, Phius export, linked-record ops. Tag
   remains a real required field; only identity *rendering* moved to Display
   Name. MCP `get_table` returns rows verbatim and picks up
   `custom_values.name` automatically.

## As built (Stage 2)

- Backend: `name` FieldDef seeded after `record_id` in all four HP leaves;
  `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` 4 → 5 with `_upgrade_v4_to_v5`
  (built-in merge + tag→name backfill); new `v4/` fixture corpus freezing
  the pre-v5 shape (with HP rows so the backfill is exercised);
  fingerprint guard regenerated.
- Frontend: new `heat-pumps/name-column.ts` (identifier FieldDef + pinned
  column, mirroring `status-column.ts`); wired first into all four leaf
  column modules; `payload-builders.ts` now routes built-in writes
  structurally — any fieldKey not materialized as a typed column on the row
  goes to `custom_values` (replaces the per-field `status`/`name` list);
  shared `readCustomStringValue` helper in `field-defs.ts` used by both
  status and name columns.

## Verification evidence (2026-07-18)

- `uv run pytest` backend: 1407 passed (incl. new
  `test_project_document_v4_upgrade_adds_heat_pump_display_name_and_backfills_from_tag`
  and regenerated golden corpus).
- Frontend vitest equipment suite: 254 passed (incl. new payload-builders
  display-name routing test).
- Agent browser (AGENT-BROWSER fixture, codex@example.com): Display Name
  renders as the frozen first column with Tag second on the HP leaf tables;
  a planted legacy v4 Tag-only row ("ASHP-LEGACY") came through the
  migration lane showing its backfilled Display Name in both the DataTable
  and the Status tab HP leaf. Fixture row removed afterward.

## Ordering

Unblocked documentation-tab Phase 4 (evidence page keys identity on Display
Name) and landed together with the Documentation tab squash merge.
