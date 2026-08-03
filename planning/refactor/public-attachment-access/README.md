---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Researched and scoped — ready for implementation handoff
AUTHOR: Claude with Ed May
SCOPE: Repair the attachment-reference resolver so every attachment column in
  the project document is reachable, restoring anonymous viewing, orphan-sweep
  protection, write validation, bulk download, and attach/detach for the
  Thermal Bridges and Heat Pump tables — and stop the UI from ever surfacing a
  raw API error body.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./research.md
  - ./phases/
  - ../../../context/DATA_STORAGE.md
  - ../../archive/dated/2026-06-27/access-capability-model/PRD.md
---

# Public attachment access

Planning packet for the attachment-reference defect found while preparing a
read-only PHI-certifier link to `2524 - Linde Home`.

## What was reported

A signed-out viewer on the Thermal Bridges tab sees, for every row's **PDF
Report** cell: a generic `FILE` tile instead of a thumbnail; a preview modal
titled with the raw asset id over an empty pane reading `FILE / File`; and a raw
JSON error page on **Download** —
`{"error_code":"asset_not_referenced", …}`.

## What it actually is

Not a security policy and not one bad column. **Two independent backend
defects, plus two UI defects.**

The dominant one is a row-walker bug: `iter_rows_for_raw_tables` reads
`thermal_bridges` and the four heat-pump sub-tables with a bare-list reader,
but those tables are `{field_defs, rows}` envelopes. It walks **zero rows** for
them, so nothing in those tables is ever recognized as an attachment reference.
**10 of the 30 registered attachment fields are unreachable** — measured, not
inferred (see [research.md](./research.md)).

That single function is the definition of "is this asset part of the project"
for five different subsystems, so the damage is not limited to anonymous
viewing:

| Subsystem | Consequence for Thermal Bridges + Heat Pumps |
| --- | --- |
| Anonymous asset visibility | attachments hidden / 403 — **the reported bug** |
| Orphaned-asset sweeper | attachments are GC candidates — **latent data loss** |
| Write-time reference validation | asset ids never validated |
| Bulk download | fails with "No matching assets" (signed-in too) |
| `POST /assets/{id}/attach` and `/detach` | 404 `document_row_not_found` (signed-in, incl. MCP `bulk_attach`) |

The second backend defect is a genuine registry omission:
`thermal_bridges.pdf_report_asset_ids` is a real document column that was never
added to `ATTACHMENT_FIELDS` at all. Fixing the row walker alone would leave
that column broken; fixing the registry alone would leave it broken too. Both
are required, and Ed's original report needed both.

The raw error string is separate and pre-existing: download controls are plain
`<a href>` navigations to the API origin, so *any* non-2xx becomes the page.

## Read order

1. **[PRD.md](./PRD.md)** — the four defects, the intended behavior, blast
   radius, and non-goals.
2. **[research.md](./research.md)** — the evidence: the reachability matrix,
   the probe script that produced it, and how the regression happened.
3. **[PLAN.md](./PLAN.md)** — phase map and sequencing rationale.
4. **[phases/](./phases/)** — per-phase implementation instructions.
5. **[STATUS.md](./STATUS.md)** — current state, next step, verification gates.

## Phase map

| Phase | Title | Kind |
| --- | --- | --- |
| [00](./phases/phase-00-production-inventory.md) | Production inventory (read-only preflight) | investigation |
| [01](./phases/phase-01-row-walker.md) | Fix the row walker | backend — **the fix** |
| [02](./phases/phase-02-register-pdf-report.md) | Register `pdf_report_asset_ids` | backend |
| [03](./phases/phase-03-reachability-guard.md) | Reachability guard tests | backend tests |
| [04](./phases/phase-04-download-error-ux.md) | Downloads never show a raw error | frontend + backend |
| [05](./phases/phase-05-unavailable-state.md) | Explicit unavailable state | frontend |
| [06](./phases/phase-06-closeout.md) | Docs, context updates, closeout | docs |

Phases 00→03 are one coherent backend bundle and should land together.
04 and 05 are independently shippable.

## Read this before touching anything

**Do not run `backend/scripts/sweep_orphaned_assets.py` with `dry_run=False`
against any project that has Thermal Bridges or Heat Pump attachments until
Phase 01 has shipped.** The sweeper would move those R2 objects to the orphan
prefix and delete the originals. There is no scheduler — the risk is manual
only. See PRD §5.
