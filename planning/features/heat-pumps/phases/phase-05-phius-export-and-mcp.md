---
DATE: 2026-06-09
TIME: 19:15
STATUS: ⏳ PARTIAL — split into 5A/5B/5C during 5A implementation.
        **5A (Phius CSV export end-to-end) implemented locally
        2026-06-09; awaiting commit.** AC #1–5 satisfied;
        `?format=xlsx-paste` returns a 501 placeholder (OPQ-3
        remains open as stretch). **5B (MCP tools, AC #7–11) and
        5C (Playwright e2e + PRD §11 cross-doc graduation,
        AC #12–14) still pending.**
AUTHOR: Ed May (with Claude)
SCOPE: Phius Multiple HP Performance Estimator export (CSV + xlsx-
       paste stretch); MCP tools for all four HP tables + a
       dedicated `export_phius_hp_estimator` tool; pre-export
       validation; final e2e Playwright pass; feature merge.
RELATED:
  - planning/features/heat-pumps/PRD.md §6 (Phius export),
    §8 (backend contract), §11 (graduation checklist)
  - planning/features/heat-pumps/decisions.md D-HP-6
  - context/technical-requirements/llm-mcp-schema.md (MCP contract)
  - context/technical-requirements/attachments.md (precedent for
    asset-related MCP shapes)
---

# Heat Pumps — Phase 5: Phius export and MCP

## Why this slice

Phases 0–4 ship a feature that's complete for browser users.
Phase 5 ships the *exit* of the feature — the Phius calculator
export every BLDGTYP project uses for certification — and the
LLM-side parity so Claude can populate / read / export HP data
via MCP. By the end:

- A user can click "Export to Phius HP Estimator…" in the
  Equipment — Outdoor overflow menu and download a CSV that pastes
  cleanly into the calc's "Air Source Heat Pump Performance Data"
  section.
- Pre-export validation surfaces rows with missing required fields
  in a single dialog; user can proceed (with gaps) or cancel.
- The four standard MCP tools (`read_table`, `add_row`,
  `update_row`, `delete_row`) work against all four HP tables.
- A dedicated `export_phius_hp_estimator(project_id)` MCP tool
  returns the same CSV payload over the MCP transport.
- Full Playwright e2e pass covers the entire feature lifecycle.
- The §11 graduation checklist is run and merged.

## Acceptance — Phase 5 done when

### Phius CSV export

1. Overflow `⋯` menu on Equipment — Outdoor has a real
   "Export to Phius HP Estimator…" entry (replacing the Phase 1
   stub).
2. Clicking the entry opens a **pre-export validation dialog**:
   - Per-row warning list for missing required fields
     (PRD §6.4): `heating_data_type`, COPs quad or `hspf2`,
     `cooling_data_type`, `cooling_cap_kbtuh_95f`,
     EER2/SEER2 pair or `ieer`.
   - Row count summary: "12 outdoor equip rows · 3 with
     warnings".
   - "Continue with gaps" and "Cancel" buttons.
3. On "Continue", browser downloads a CSV named
   `phius-hp-estimator-{project-bt-number}-{date}.csv` with the
   column order from PRD §6.2.
4. Per-row `Qty` is derived from instance count: the count of
   outdoor units whose `outdoor_equip_id` matches each equip row's
   `id`. Rows with zero instances are included (empty `Qty`) and
   surface as a pre-export warning.
5. Cells in the export use the **column-conditional mapping** from
   PRD §6.2 — e.g. when `heating_data_type=cops`, the HSPF cell
   is empty and the four COPs cells are populated.
6. **Stretch goal:** xlsx-paste payload format via `?format=
   xlsx-paste` query param on the backend endpoint; OPQ-3 pinned
   in this phase. Implementation only if Phase 5 budget allows;
   CSV is the v1 commit.

### MCP tools

7. `read_table(project_id, table_key)` reads any of the four HP
   tables. `table_key` accepts `heat_pump_outdoor_equip`,
   `heat_pump_indoor_equip`, `heat_pump_outdoor_units`,
   `heat_pump_indoor_units`.
8. `add_row(project_id, table_key, row)` and
   `update_row(project_id, table_key, row_id, patch)` write
   through the draft buffer with the same validation as the
   browser-side mutations (Phase 0 service module).
9. `delete_row(project_id, table_key, row_id)` enforces
   referential-integrity rules from PRD §4.6, returning the same
   structured errors the REST endpoint surfaces.
10. `export_phius_hp_estimator(project_id) → text/csv` returns the
    CSV payload directly (skipping the pre-export dialog — the LLM
    just gets the bytes; warnings come back in a `warnings[]`
    field on the response shape per
    `context/technical-requirements/llm-mcp-schema.md`).
11. All five MCP tools' schemas land in
    `context/technical-requirements/llm-mcp-schema.md` §10.3
    (or the heat-pump-specific section in that file).

### End-to-end Playwright pass

12. A `frontend/tests/e2e/heat-pumps.spec.ts` test covers the full
    feature lifecycle:
    - Seed a project with rooms and ervs.
    - Create outdoor equip rows (one COPs, one HSPF2, one
      EER2/SEER2, one IEER).
    - Create indoor equip rows (one with ERV-INTEGRATED).
    - Create outdoor units pointing to outdoor equip.
    - Create indoor units pointing to outdoor units + indoor equip
      + ERV (for the integrated one) + served rooms.
    - Open the ERV row to verify the "Linked from HP indoor"
      badge.
    - Run the Phius export; verify the CSV row count and a
      handful of column values.
    - Delete the ERV; verify the cascade-null fires.
    - Lock the version; verify all four pages render read-only.

### Graduation

13. The PRD §11 cross-doc graduation checklist is run:
    - `context/PRD.md` §6.2 updated.
    - `context/technical-requirements/data-model.md` updated.
    - `context/technical-requirements/api.md` §9.X added.
    - `context/technical-requirements/llm-mcp-schema.md` updated.
    - `STATUS.md` marked Complete with evidence.
14. `make ci` and `make e2e` both pass.

## Out of scope

- AHRI directory integration / link-out (D-HP-AHRI; v1.1+).
- Backup-heat fields (D-HP-12; v1.1+).
- Shared catalog (D-HP-1; v1.1+).
- Per-room reverse view "which HPs serve this room?" (v1.1+
  candidate).
- Anything in the post-v1 follow-ups queue
  (Q-HP-FOLLOWUP-3 etc.).

## Implementation outline

### Step 1: Backend Phius export module

`backend/features/heat_pumps/phius_export.py`:

- `compute_phius_payload(project_id) → PhiusPayload`
  - Reads the four HP tables via the Phase 0 service.
  - Computes per-row `Qty` from outdoor-unit instance counts.
  - Validates per PRD §6.4; returns warnings[] alongside the
    payload.
  - Returns `(rows: list[PhiusRow], warnings: list[Warning])`.
- `serialize_csv(payload) → bytes`
  - One CSV row per outdoor equip; column order per PRD §6.2.
- `serialize_xlsx_paste(payload) → bytes`
  - Stretch goal; pin OPQ-3 in this phase.

### Step 2: Backend export endpoint

`backend/features/heat_pumps/routes.py` (existing file edit):

- `POST /api/v1/projects/{id}/equipment/heat-pumps/export-phius`
  → returns CSV + warnings[] in JSON-wrapped response, or raw
  CSV when `?format=raw-csv`.
- `?format=xlsx-paste` returns xlsx bytes (stretch).

### Step 3: Frontend export action

`frontend/src/features/equipment/heat-pumps/components/PhiusExportDialog.tsx`:

- Pre-export validation dialog: warning list, row count, action
  buttons.
- On "Continue", fetches the export endpoint with
  `?format=raw-csv`, triggers download.

`frontend/src/features/equipment/heat-pumps/lib/phius-export.ts`:

- Replaces the Phase 1 stub. Hooks the menu entry to open the
  dialog.

### Step 4: MCP tool wiring

`backend/features/mcp/tools/heat_pumps.py` (new file):

- `read_table`, `add_row`, `update_row`, `delete_row` for each
  of the four HP table keys. These wrap the Phase 0 service.
- `export_phius_hp_estimator` wraps Step 1's
  `compute_phius_payload` + `serialize_csv`.

`context/technical-requirements/llm-mcp-schema.md`:

- Add the five tool schemas with param + return types.

### Step 5: e2e Playwright

`frontend/tests/e2e/heat-pumps.spec.ts`:

- Per acceptance criterion 12.

### Step 6: Cross-doc graduation

Run the PRD §11 checklist; one PR per touched context doc, or one
omnibus graduation PR if simpler. Update the heat-pumps `STATUS.md`
with the merged-to-main evidence.

## Verification

1. `make format` clean; `make ci` and `make e2e` both pass.
2. Manual Phius export walkthrough on a real project:
   - Open `Phius_Heat Pump Performance Estimator_v25.1.1` xlsx.
   - Click PHN's export, download CSV.
   - Open CSV in Excel, copy the data range, paste into the calc's
     "Air Source Heat Pump Performance Data" section.
   - Calc accepts the paste; calculated totals are sensible.
3. MCP smoke: launch a Claude session against the local MCP
   server; ask "list all HP outdoor units in project X" and
   "export the Phius estimator data"; both return correct
   payloads.
4. PRD §11 checklist boxes ticked; cross-doc PRs merged.
5. `STATUS.md` updated to **Complete** with merge evidence.

## Risks

- **Phius calc paste fidelity.** The calculator's input area may
  have validators (data-validation lists, merged cells, hidden
  helper rows) that reject naive paste. Mitigation: prototype Step 1
  early in the phase; if naive paste breaks, the xlsx-paste
  stretch becomes required, not optional.
- **MCP write tools and concurrency.** Multiple LLM-driven writes
  through the draft buffer must respect the same ETag /
  idempotency semantics as browser writes. Mitigation: reuse the
  existing MCP write helpers from the ERVs / Materials MCP tools —
  no new concurrency primitives.
- **Graduation churn.** Folding decisions back into 5+ context
  docs is the single biggest sink in this phase. Mitigation:
  budget a focused half-day for graduation; do one doc at a
  time, with a CI run after each, so regressions surface
  immediately.
