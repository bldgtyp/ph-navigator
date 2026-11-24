# Phase 02 — Effective resolution, commands, route-3 emission

```
DATE:    2026-08-03
TIME:    11:55
STATUS:  ✅ Complete 2026-08-04 — implemented on feature/aperture-psi-install;
         `make ci` green; as-built amendments at the end of this file
AUTHOR:  Ed + Claude
SCOPE:   Backend only. Effective-Ψ resolver, aperture commands for assignment,
         grid-mutation slot hygiene, route-3 `installs` block + frame_type
         default policy, U-value report wiring, slice payload extension.
RELATED: ../decisions.md (D-3..D-5), ../research.md §5–§6, phase-01
```

Precondition: phase 01 merged (schema v10, `edge_classification.py`,
`apit_default` seeded).

## 1. Effective-Ψ resolver

New `backend/features/project_document/apertures/install_psi.py`:

```python
def resolve_install_psi(tables) -> dict[tuple[aperture_id, element_id, side], ResolvedInstallPsi]
```

Per element side, in order (D-3/D-4):
1. classification == interior → `psi=0.0, source="mull"`, ignore any stale
   slot value.
2. slot has `apit_*` → that row's `psi_w_mk` (read via the field registry —
   it's a custom value), `source="assigned"`, carry the type id + name.
3. slot None → the `apit_default` row's value, `source="default"`.

Edge cases: referenced row missing (validation should prevent; resolve to
default + collect a warning), `psi_w_mk` unset on a referenced row (treat as
0.0 + warning). Return warnings alongside values — the U-value report and
slice can surface them later.

Unit tests: all three sources; stale interior assignment ignored; missing
ref; phius vs phi default fixtures.

## 2. Commands

`backend/features/project_document/aperture_commands/models.py` (+ dispatcher
+ handler files + TS mirror in `frontend/src/features/apertures/types.ts:225-298`
— mirror now, UI uses it in phase 05):

- `SetElementInstall { aperture_id, element_id, side: ApertureSide,
  install_type_id: str | None }` — new handler
  `handlers/installs.py`, modeled on `PickFrame`
  (`handlers/picks.py`). Validations: element exists; side is
  **perimeter** for this aperture (use `classify_element_edges`); id is
  None or an existing `apit_*` row. Setting None clears to inherit.
- `ApplyInstallToApertures { aperture_ids: list[str], install_type_id:
  str | None }` — bulk: sets every perimeter edge of every listed aperture.
- `CopyElementInstalls { source_aperture_id, target_aperture_ids }` —
  requires identical **grid signature** (same `row_heights_mm`,
  `column_widths_mm` lengths and same element spans/positions — write a
  small `grid_signature(aperture)` helper next to the classifier); copies
  slot-by-slot; rejects (400, named error) targets with different
  signatures so the UI can filter.

## 3. Grid-mutation slot hygiene

Every handler that changes the grid must keep slots sane (stale interior
values are *tolerated*, but don't leak garbage):

- `handlers/dimensions.py` (insert/delete row/col), `merge_split.py`,
  `flip.py` (mirror left/right slots exactly as it mirrors frames —
  research: `mirrorApertureForInterior` precedent), `paste.py` (copy slots
  with elements), `element.py` (element delete drops its slots naturally).
- Rule: deleting a row/col or merging drops slots of removed elements;
  new elements start all-None; flip swaps left/right. Add focused tests per
  handler (clone each handler's existing test pattern).

## 4. Route 3 (`GET /gh/aperture-types`)

`backend/features/gh_api/aperture_types_export.py` (D-5):

- Each element gains an `installs` block keyed by side:
  `{"install_type_id", "name", "psi_install_w_mk", "source"}` — the
  **resolved effective** values from §1 (interior sides emit
  `psi_install_w_mk: 0.0, source: "mull"`).
- `frame_type.psi_install_w_mk` (`:147`) now emits the **uniform
  `apit_default` value** for every frame block — never per-edge-varying,
  never null. Update the module docstring contract note (`:11-13`)
  explaining why (client dedup — research.md §4.2).
- Update `docs/` gh-api contract page if one exists for route 3 (search
  `docs/` + `context/` for the route-3 payload doc; the GH-side consumer
  doc is in the other repo).
- Tests: export snapshot with mixed assignments (assigned + default +
  interior); assert `frame_type` values uniform; assert old-client fields
  unchanged otherwise.

## 5. U-value report + slice payload

- `backend/features/aperture_u_value/service.py`: populate
  `ApertureEdgeBreakdown.psi_install_w_mk` (`models.py:66`) from the
  resolver (today it passes through the never-set frame value). The Uw
  math itself **does not change** (Ψ-install stays excluded from PHN's
  U-w — `service.py:12-14`); this is display/report data only. Update the
  XLSX report column source if it reads the same field
  (`report_xlsx.py`).
- `backend/features/project_document/tables/apertures.py`
  `AperturesSliceResponse` (`:30-43`): add
  `aperture_install_types: list[...]` rows (id, name, psi_w_mk, source,
  has_pdf) so the builder UI (phases 04–05) has everything in one fetch.
  Mirror the response type in the frontend api layer now.

## 6. Exit gate

- Resolver + command + hygiene + export tests green; `make ci` green.
- Manual spot-check via MCP (`phn-local`): `apply_aperture_command` with
  `setElementInstall`, then `get_table`/export inspection on the
  AGENT-BROWSER fixture; discard the draft afterwards.
- Closeout gate (simplify, docs-pass, format, ci) + STATUS.md ledger.

## As-built amendments (2026-08-04)

- **§1 resolver shape:** only the per-aperture
  `resolve_install_psi_for_aperture` shipped (returning
  `ApertureInstallPsiResolution` keyed `(element_id, side)`); the
  document-wide 3-tuple wrapper had no consumer and was dropped. Shared
  `install_type_psi_w_mk` / `install_type_name` accessors live in
  `tables/aperture_install_types.py`.
- **§2 `copyElementInstalls`** rejects grid mismatch with **422**
  `aperture_installs_copy_grid_mismatch` (not 400 — 422 is the aperture
  command convention); `_grid_signature` compares dimension *counts* +
  element spans/kinds, so mm dimensions may differ. The grid-signature
  helper lives (private) in `handlers/installs.py`, not next to the
  classifier.
- **§3 hygiene:** `setElementKind`→void now also clears `installs`
  (pre-existing handler would otherwise trip the v10 void validator);
  paste copies the four slots (undo snapshot gained `installs`);
  merge/split deliberately reset to all-None (position-dependent);
  dimensions handlers needed no change.
- **§5 cache identity:** `content_hash_for_aperture` now folds the
  *resolved* per-side (source, Ψ) pairs in, so install edits/reassignments
  change result identity even though U-w excludes Ψ-install. U-value CSV
  goldens + parity hashes regenerated accordingly; synthetic frames'
  never-authoritative `psi_install_w_mk=0.01` no longer echoes into
  reports (resolver emits 0.0 without a seeded install-types table).
- **Exit-gate spot-check** ran through the REST command endpoint (same
  dispatcher) because the session's `phn-local` stdio process predated the
  branch and had stale imports: `setElementInstall` on the AGENT-BROWSER
  fixture assigned `apit_default` to one edge, slice returned the summary
  payload (0.04 non-Phius default), draft discarded (`discarded: true`).
- Frontend mirrors landed with the phase: `installs` on wire + hydrated
  elements, snapshot `installs`, the three commands in the TS union, and
  `aperture_install_types` summaries on the slice (15 test fixtures
  updated).
