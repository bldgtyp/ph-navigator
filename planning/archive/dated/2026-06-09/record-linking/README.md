---
DATE: 2026-06-08
TIME: -
STATUS: Complete and archived on 2026-06-09. Phases 1, 1.b, 2, and
        the backend Phase 3 rollup/validator slice are implemented and
        manually verified for the canonical Rooms→Pumps workflow.
        Remaining non-blocking polish is recorded as deferred in
        `STATUS.md` / `phases/phase-03-rollups.md`.
AUTHOR: Ed May (with Claude)
SCOPE: Folder router for the record-linking feature
       (AirTable-style linked-record + rollup between project-document
       tables, e.g. Pumps ↔ Rooms).
RELATED: options.md — architecture options memo with three approaches
                       and a recommendation.
         context/PRD.md §6, context/technical-requirements/data-model.md §6.3,
         §6.6.3, §6.6.4
---

# Record-linking — feature folder

Investigating whether and how to add AirTable-style record linking
(plus rollup/aggregation) between project-document tables in V2 —
e.g. linking a `Pump` row to one or more `Room` rows and rolling up
totals on the inverse side.

## Read order

1. `options.md` — the architecture options memo. Three approaches
   (typed columns, new `linked_record` field type, document-level
   relations array) with pros, cons, and the Approach-2 recommendation.
2. `PRD.md` — feature PRD built on Approach 2. §11 captures the
   28 resolved questions (Q1–Q10 use-case-driven, Q11–Q28
   implementation-shape).
3. `phases/` — implementation plans, one file per phase:
   - `phase-01-link-values.md` — new `linked_record` field type,
     picker, pill renderer, source-side editing. No inverse view.
   - `phase-02-inverse-view.md` — server-computed inverse overlay,
     cross-table ETag invalidation, perf gate.
   - `phase-03-rollups.md` — `linked(...)` / `linked_from(...)`
     formula primitives with `count` / `sum` / `avg`; document-
     level formula cycle detection.
4. `STATUS.md` — live progress tracker. Read this for the current
   state of implementation and closeout work.

## Current state

- **Approach 2 committed** as the baseline (see `options.md §5`).
- **PRD complete**: Q1–Q28 all resolved 2026-06-08.
- **Phase 1 — source-side linking implemented**
  (historical CI green on 2026-06-08; current follow-ups tracked in
  `STATUS.md`):
  - Backend: `CustomFieldType.linked_record`, `RowWithCustomFields`
    mixin, `custom_links` bag on every `*Row`, `schema_version` 5,
    `_validate_rows_custom_links` on every FieldDef-capable table,
    `linked_record_wipe` changeType policy, retarget guard,
    `TableContract.link_targetable`, `erv_unit_ids` retired.
  - Frontend primitives: `LinkedRecordCell`, `LinkedRecordPicker`,
    `FieldConfigSectionLinkedRecord`, type-system widened, conversion
    matrix mirrored, fixtures + RoomsTable ERV column purged.
  - Tests: backend pytest +17, frontend vitest +19 (cell/picker/
    section); existing matrix-count test bumped 34 → 48.
- **Phase 1 — second pass landed (2026-06-08)**: FieldConfigModal
  integrates `FieldConfigSectionLinkedRecord` (target dropdown,
  Single/Multi cardinality, Q13 lock); `dispatchBundle` payload now
  emits `linkedRecordTargetPath` / `linkedRecordMaxLinks`;
  `buildNextConfigForFieldTypeChange` writes the linked-record config
  on type change and preserves the locked `target_table_path` on
  in-place edits. `useRowFocusHighlight` hook + CSS animation cover
  the `?focus=<row_id>` highlight. Backend pytest covers the
  `_apply_linked_record_wipe` changeType path through the dispatcher
  in both directions (incl. ack-required + clean paths).
- **Phase 2 — inverse view implemented**:
  backend inverse projection, Rooms/Pumps response overlays,
  `inverse_links_fingerprint`, Pumps read-only inverse columns,
  source-path pill navigation, and a deterministic perf gate are in
  place. `make format && make ci` are green.
- **Phase 3 — backend rollup/validator slice implemented**:
  Python parser / AST support, server read-overlay evaluation,
  document-level linked-ref validation, and cross-table cycle detection
  are in place and covered by focused backend tests. Frontend formula
  authoring/completion, JSON Schema regeneration, and the extended
  combined perf gate are deferred follow-ups.
- The half-implemented `RoomRow.erv_unit_ids` typed column referenced
  by the original PRD has been deleted per Q7; users will add their
  own `linked_record` fields when integration lands.
