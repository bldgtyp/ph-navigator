---
DATE: 2026-08-03
TIME: 11:24 EDT
STATUS: Complete — accepted behavior implemented and verified locally
AUTHOR: Claude with Ed May
SCOPE: Behavior contract for attachment reference resolution, anonymous asset
  access, and error surfacing on asset download.
RELATED:
  - ./README.md
  - ./research.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD — Public attachment access

## 1. Why this matters now

Sending a PHI certifier a read-only project link is a core workflow. A certifier
who cannot open the thermal-bridge PSI reports cannot review the model, and the
one failure they *can* act on presents as a raw JSON blob in the browser
address bar — which reads as a broken app, not a permissions boundary.

Two of the four defects below also carry consequences well past the certifier
link: a data-loss exposure, and broken write validation on two whole tables.

## 2. The existing design is correct — keep it

Anonymous attachment access is implemented on purpose, and the rule is a good
one:

> A signed-out viewer may see and fetch an asset **only if that asset is
> referenced by an attachment column of the project's saved active document.**

Rationale, and why it should stay: R2 objects are private and reachable only
through short-lived signed URLs minted by the API. Asset ids are enumerable
strings scoped to a project. Without a reference gate, an anonymous holder of a
project link could walk the whole project bucket — including uploads that were
attached and later removed, failed/pending uploads, and files uploaded into the
wrong project. Gating on "is it on the page you were given" makes the public
surface exactly the document, which is what a shared link promises.

Implementation, all in `backend/features/assets/service.py`:

| Surface | Anonymous behavior | Line |
| --- | --- | --- |
| `list_assets` | filters to referenced ids | 310–313 |
| `get_asset` | 404 `asset_not_found` if unreferenced | 280–282 |
| `bulk_urls` | silently drops unreferenced ids | 354–357 |
| `get_asset_urls` | 403 `asset_not_referenced` | 343–346 |

All four resolve "referenced" through `_references_for_access` →
`list_asset_references(body)` → `iter_rows_for_raw_tables(...)`. Location and
weather assets get a separate allowance via `location_asset_ids_for_project`.
Anonymous callers arrive as a read-only `ViewerPrincipal`
(`backend/features/projects/access.py`) — also deliberate.

**None of that is the bug. The policy is not changing.** What is broken is the
resolver the policy depends on.

## 3. Defect 1 — the row walker cannot see five tables *(primary)*

`iter_rows_for_raw_tables` (`backend/features/assets/registry.py:281-305`) reads
`thermal_bridges` and the four heat-pump sub-tables with `_dict_rows`, a
bare-list reader. Those five tables are `{field_defs, rows}` envelopes. The
walker returns **zero rows** for each, so no row in them can ever produce an
attachment reference.

Measured: **10 of 30 registered attachment fields are unreachable** —
`thermal_bridges.{datasheet,photo}_asset_ids` and
`heat_pump_{outdoor,indoor}_{equip,units}.{datasheet,photo}_asset_ids`. Full
matrix and method in [research.md §1–2](./research.md).

Because that one function defines "is this asset part of the project" for five
subsystems, the damage is not confined to anonymous viewing:

1. **Anonymous visibility** — the reported bug. Attachments on those tables are
   invisible and unfetchable to signed-out viewers.
2. **Orphaned-asset sweeper** (`orphan_sweeper.py:92`) — every such asset
   classifies as `unreferenced_upload`, and a non-dry-run sweep copies the R2
   object to the orphan prefix and **deletes the original**. See §5.
3. **Write-time reference validation** (`reference_validation.py:26`) —
   references on those tables are never checked for existence, cross-project
   ownership, upload completion, per-cell count, or MIME fit. See §6.
4. **Bulk download** (`downloads.py:93`) — raises `ValueError("No matching
   assets.")`, so the job fails for **signed-in** users too.
5. **`POST /assets/{id}/attach` and `/detach`** — `find_row`
   (`downloads.py:186`, called from `service.py:531`) uses the same walker and
   returns 404 `document_row_not_found`. Verified directly. The browser is
   unaffected because the UI writes attachments through the table draft `PUT`,
   but MCP `bulk_attach` / `bulk_detach` go through the broken path.

Fixed in [phase-01](./phases/phase-01-row-walker.md).

## 4. Defect 2 — one column was never registered at all

`pdf_report_asset_ids` is a real attachment column on Thermal Bridges:

- persisted on the row model — `backend/features/project_document/rows.py:415`
- seeded as a built-in FieldDef —
  `backend/features/project_document/tables/thermal_bridges.py:79-83`
- rendered as an attachment column —
  `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx:151-162`,
  config `assetKind: "datasheet"`, PDF-only, `maxCount: 5`, `maxFileSizeMb: 25`

…but it is **absent from `ATTACHMENT_FIELDS`**
(`backend/features/assets/registry.py:58-145`), which hand-lists the envelope
columns then machine-generates one `datasheet_asset_ids` and one
`photo_asset_ids` entry per documentation table. `pdf_report_asset_ids` is in
neither branch.

It slipped because it was hand-rolled with the generic `built_in_field_def(...)`
rather than through the shared `_attachment_fields.py` helpers, which are the
informal seam pairing a document column with a registry entry — and nothing
enforces that pairing.

**Defects 1 and 2 are independent and both are required.** Fixing the walker
leaves PDF Report unregistered; registering PDF Report leaves it inside a table
the walker cannot read. Ed's original report needs both.

Fixed in [phase-02](./phases/phase-02-register-pdf-report.md).

## 5. Consequence — latent data loss (act on this now)

`AssetOrphanSweepWorkflow._referenced_asset_ids_for_project`
(`orphan_sweeper.py:84-93`) resolves references through the same broken walker.
Every Thermal Bridges and Heat Pump attachment therefore classifies as
`unreferenced_upload` (`_gc_reason`, line 117) and is a live GC candidate.

Mitigating facts: the sweeper has no scheduler — it is reachable only through
`backend/scripts/sweep_orphaned_assets.py`, and it defaults to `dry_run=True`.
Nothing should have been lost, and Phase 00 confirms that.

**Until Phase 01 ships, do not run that script in non-dry-run mode against a
project with Thermal Bridges or Heat Pump attachments.**

## 6. Consequence — turning validation back on is the migration risk

Once Phase 01 lands, `validate_document_asset_references` starts enforcing
existence, same-project ownership, `upload_status == "uploaded"`, per-cell
`max_count`, and `asset_matches_field` on Thermal Bridges and Heat Pump
references that have never been validated. Any stored id that fails will reject
**the whole table save** with 422.

That is the entire reason [phase-00](./phases/phase-00-production-inventory.md)
exists and must run first. It is read-only.

## 7. Defect 3 — any asset error can become a raw error page

Independent of 1 and 2, and it survives them. Every download affordance is a
hard navigation to `api.ph-nav.com`:

- `frontend/src/features/assets/components/AttachmentCell.tsx:294`
- `frontend/src/features/assets/components/AttachmentRowsTable.tsx:115`
  (`window.location.href`)
- `frontend/src/features/projects/components/ProjectLocationSummary.tsx:77`
- `frontend/src/features/climate/components/ClimateSourceDetailPage.tsx:535`

Any non-2xx — 403, 404, `410 project_deleted`, `409 asset_upload_incomplete`, an
expired session — throws the user out of the app onto a JSON document.

Fixed in [phase-04](./phases/phase-04-download-error-ux.md).

## 8. Defect 4 — the UI degrades silently

When `bulk-urls` omits an asset for any reason, `AttachmentCell` has no
"unavailable" state. `asset` is `undefined`, so the tile renders
`fileGlyph(undefined)` — the literal string `"FILE"` — and the modal falls
through to a `FILE / File` panel with an empty preview and no "Open in new tab"
link (`AttachmentCell.tsx:173-182,265-299,322-326`). A viewer cannot tell
whether the file is missing, still processing, or withheld. That ambiguity is
what made this read as "the app is broken."

Fixed in [phase-05](./phases/phase-05-unavailable-state.md).

## 9. Intended behavior when this is done

1. Every attachment column in the project document is reachable by the
   reference resolver — no table is silently invisible.
2. A signed-out viewer sees real thumbnails for every attachment referenced by
   the saved active document, including Thermal Bridges PDF reports, and can
   preview and download them exactly as a signed-in viewer does.
3. Assets **not** referenced by the saved active document remain invisible and
   unfetchable to anonymous callers. The gate is unchanged and must be proven
   unchanged by test.
4. Attachments on every table are protected from the orphan sweeper, validated
   on write, included in bulk download, and reachable by `attach`/`detach`.
5. No user-facing surface renders a raw API error body. A failed download
   produces an in-app message naming what happened.
6. An attachment the client cannot resolve renders an explicit unavailable
   state, never a plausible-looking empty file.
7. Adding a new attachment column, or migrating a table's row shape, fails a
   test rather than shipping as a silent public-visibility and data-retention
   hole.

## 10. Non-goals

- **Changing the reference-gate policy.** No per-project `access_mode`, no share
  links, no widening of what anonymous users may reach. Tracked separately —
  see `planning/refactor/project-ownership-enforcement/`.
- **Making non-active saved versions publicly resolvable.**
  `_references_for_access` reads `active_version_id` only, so an anonymous
  viewer of an older version would still be gated by the active document. No UI
  reaches that state today; noted so it is not mistaken for new breakage.
- **Adding a PDF Report column to the Documentation summary.**
  `documentation_summary.py` has its own datasheet/photo fields and is
  unaffected.
- **Replacing the hand-written table→rows if-chain with a registry-derived
  mapping.** The right long-term shape, but a refactor rather than a bug fix.
  Recorded as a follow-up in [phase-06](./phases/phase-06-closeout.md).
- **Any change to signed-in read behavior**, beyond bulk download and
  attach/detach starting to work where they were broken.
