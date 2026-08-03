---
DATE: 2026-08-03
TIME: 11:22 EDT
STATUS: Complete locally — Phases 00-06 green; production deploy pending Ed
AUTHOR: Claude with Ed May
SCOPE: Current state, next step, blockers, and verification gates for public
  attachment access.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./research.md
  - ./phases/
---

# Status — Public attachment access

## Current state

**Phases 00-06 are complete and green locally. The row walker reaches all 31
registered attachment fields, including
`thermal_bridges.pdf_report_asset_ids`; structural guards prevent either defect
from shipping silently again; and the cross-subsystem contract is documented.**

Two independent backend defects and two UI defects, all confirmed by executing
code in `backend/.venv`, not by reading:

1. **Row walker defect — fixed in Phase 01.** Every direct table branch now uses
   the list/envelope-tolerant reader. All **30 of 30 registered fields are
   reachable**, restoring anonymous visibility, sweeper protection, validation,
   bulk download, and attach/detach for Thermal Bridges and Heat Pumps.
2. **Missing `thermal_bridges.pdf_report_asset_ids` registration — fixed in
   Phase 02.** The PDF-only field is now covered by public reads, write
   validation, attach/detach, bulk download, and orphan protection.
3. **Raw download navigation — fixed in Phase 04.** User actions preflight the
   signed URL, keep failures in the app, and isolate the storage navigation.
4. **False-normal unresolved attachments — fixed in Phase 05.** Pending URL
   resolution, settled missing assets, and resolved assets now render as three
   explicit states across editor and viewer surfaces.
5. **Cross-subsystem attachment reachability — documented in Phase 06.** The
   anonymous saved-version gate, list/envelope row-shape invariant, PDF Report
   page behavior, and deferred walker-unification scope now have durable homes.

Reachability matrix and method: [research.md](./research.md).

Reproduced from Ed's screenshots against production `2524 - Linde Home`. Phase
00 found no stored-data violations. Phases 01-06 and every local closeout gate
are green. Production behavior remains unchanged until Ed deploys the completed
packet.

## Next step

Run the `implement-loop` final archive cleanup. After handoff, Ed may deploy via
the **Deploy Production** GitHub Actions workflow and verify the Linde public
viewer; no agent deployment is authorized.

## Blockers / decisions needed from Ed

None. Phase 00 found zero violations. The Phase 02 PDF-only allowlist matches
all stored `pdf_report_asset_ids` references, and the planned counts exceed
every stored cell count.

## Phase 00 findings

Read-only production inventory completed 2026-08-03 against the active saved
version of all four projects returned by `phn.list_projects`:

| Project | Active version | References in the five scoped tables |
| --- | --- | ---: |
| `2613 - Ayers Home` | `985208f3-3aa2-4e8d-8a12-f2a15491ef7c` | 0 |
| `2524 - Linde Home` | `36cec711-bc53-497c-a999-99754d89e22b` | 7 |
| `2242 - Arverne D` | `46625e9d-6c4c-4bef-9ccc-f2b2d2017a3c` | 0 |
| `1299 - JM Test Project` | `d8bb0f86-0bc8-4c0e-94ee-c1f9cd73c3c3` | 0 |

Counts by table and column:

| Table | Field | References |
| --- | --- | ---: |
| `thermal_bridges` | `pdf_report_asset_ids` | 5 |
| `heat_pump_outdoor_equip` | `datasheet_asset_ids` | 1 |
| `heat_pump_indoor_equip` | `datasheet_asset_ids` | 1 |
| all other scoped table/field pairs | — | 0 |

Every stored reference is on `2524 - Linde Home`:

| Table | Row id | Field | Asset id | Bytes |
| --- | --- | --- | --- | ---: |
| `thermal_bridges` | `tb_757a0d25a6d240b484c1cbd144550333` | `pdf_report_asset_ids` | `asset_20260709170202490275` | 515335 |
| `thermal_bridges` | `tb_832b12b2968643a99843016aa51bb997` | `pdf_report_asset_ids` | `asset_20260709170222459071` | 400647 |
| `thermal_bridges` | `tb_3384cce701ae481e81aadc1d988df7f3` | `pdf_report_asset_ids` | `asset_20260709170237662276` | 314093 |
| `thermal_bridges` | `tb_f1d01438d25343b18f13f3954034206e` | `pdf_report_asset_ids` | `asset_20260709170257160661` | 411815 |
| `thermal_bridges` | `tb_fa3bf90685b8457f8bb2591909781385` | `pdf_report_asset_ids` | `asset_20260709170309042567` | 454657 |
| `heat_pump_outdoor_equip` | `hpoe_01KZ1FHFGA224G5N58FKWKE737` | `datasheet_asset_ids` | `asset_20260802152841180739` | 1326375 |
| `heat_pump_indoor_equip` | `hpie_01KZ1FHFGA5R3W12A7N4FNS2H8` | `datasheet_asset_ids` | `asset_20260802152841180739` | 1326375 |

**Zero violations.** Every referenced asset exists in the same project, has
`upload_status="uploaded"`, `asset_kind="datasheet"`,
`content_type="application/pdf"`, `deleted_at=null`, and size below 25 MB.
Every cell contains one id, below the planned limit of five. The shared
heat-pump datasheet is intentionally referenced by two rows.

**Orphan-sweep check: clean.** None of the referenced assets has
`metadata.orphaned_status="moved"`; all returned `orphaned_status=null`.
Therefore Phase 02 can keep the PDF-only allowlist, and no production
remediation is required before Phase 01.

## Phase 01 verification

- Red proof: the envelope-walker regression failed for `thermal_bridges` and
  all four heat-pump keys before the fix (`5 failed, 2 passed`).
- Fixed proof: direct walker suite `7 passed`; research probe `30/30 registered
  fields reachable`.
- Workflow bundle `60 passed`: anonymous list/item/URL/download, unchanged
  404/403 gate, write validation, attach/detach, orphan sweeper, and bulk ZIP.
- `make ci` green: backend `1790 passed, 7 skipped`; frontend `2374 passed`;
  formatting, lint, boundaries, types, and production build all green.
- Mounted route: local Thermal Bridges grid loaded after fixture draft recovery
  with zero console errors. The fixture has no attachment rows, so the
  file-bearing browser acceptance check remains for Phase 02.

## Phase 02 verification

- Red proof: the registry assertion failed before implementation because
  `get_attachment_field("thermal_bridges", "pdf_report_asset_ids")` returned
  `None`.
- Focused backend bundle: `55 passed`, covering registry policy, anonymous
  list/URL/download, attach/detach, PDF-only write validation, orphan protection,
  bulk ZIP inclusion, and seed identity.
- Seed identity: serialized `TableFieldDef` unchanged and Thermal Bridges schema
  fingerprint remains
  `073fd4d1300f69585b714e731f451530d8cff3d326e0cc7cd057b616d2967475`.
- Reachability probe: `31/31 registered fields reachable`.
- Signed-out local browser fixture: real thumbnail rendered; modal iframe and
  `_blank` “Open in new tab” shared the signed PDF URL; Download returned
  `200 application/pdf` and 646 bytes. The fixture was saved locally only;
  production remained read-only.
- `simplify`: three parallel reviews completed; duplicate field constants and
  multi-field test-row construction were consolidated. No correctness or
  efficiency findings remained.
- `make ci` green: backend `1795 passed, 7 skipped`; frontend tests and
  production build plus all formatting, lint, type, and boundary checks passed.

## Phase 03 verification

- Guard A derives every `_asset_ids` column from the registered Pydantic table
  models plus the three irregular envelope models and asserts a matching
  `ATTACHMENT_FIELDS` entry.
- Guard B derives fixture paths from `TableContract.table_path`, injects all 31
  unique references into the real empty-document shapes, and asserts both
  nonzero walked rows and field-level references. It traverses 16 table fixtures,
  independent of the row-walker's branch map.
- Shape pin: all 16 attachment table keys pass as both bare lists and
  `{field_defs, rows}` envelopes, including nested assembly segments.
- Negative gate remains pinned: an unreferenced anonymous asset is still 404,
  and `/url` is still 403 `asset_not_referenced`.
- Guard A falsification, with the PDF Report registry entry temporarily removed:
  `thermal_bridges.pdf_report_asset_ids is a document attachment column with no
  ATTACHMENT_FIELDS entry — anonymous viewers cannot see it and the orphan
  sweeper will treat its assets as garbage.`
- Guard B falsification, with `_dict_rows` temporarily restored for Thermal
  Bridges: `thermal_bridges.pdf_report_asset_ids is registered but its real
  table shape yields zero rows — anonymous viewers cannot see its assets and the
  orphan sweeper will treat them as garbage.`
- Both defects were restored; focused bundle `55 passed`. Three parallel
  `simplify` reviews completed, and all test reuse/efficiency findings were
  incorporated.
- `make ci` green: backend `1829 passed, 7 skipped`; frontend tests and build,
  formatting, lint, types, and repository boundary checks passed.

## Phase 04 verification

- All four download surfaces use one fetch-first helper and one shared hook;
  failed/no-result bulk jobs no longer disappear silently.
- Exact client copy is covered for `asset_not_referenced`, `asset_not_found`,
  `asset_upload_incomplete`, `project_deleted`, and `not_authenticated`, with a
  request-id-bearing fallback for unknown codes.
- Asset `/download` errors negotiate to HTML for browser requests at the global
  exception seam, so dependency failures are covered; JSON clients retain the
  structured envelope and successful requests retain `307` redirects.
- Focused suites: backend `21 passed`; frontend `10 passed`, including the
  modal's in-flight file-navigation race and failed bulk-job branch.
- Signed-out local browser: stale detached PDF produced the mapped in-app alert
  without leaving Thermal Bridges; the fixture was restored to the identical
  saved version ETag. A pasted unreferenced URL rendered HTML, and a successful
  restored download left the app mounted.
- Three parallel `simplify` reviews and rechecks completed with no remaining
  findings.
- Full `make ci` green: backend `1830 passed, 7 skipped`; frontend `2384
  passed`; formatting, lint, types, boundaries, contract checks, and production
  build passed.

## Phase 05 verification

- Pending URL resolution, settled missing assets, and resolved assets now have
  distinct rendering. The unavailable modal contains no raw asset id and no
  impossible Download/Open actions.
- External URL maps require an explicit pending status at the type boundary;
  all shared producers pass it. The Documentation viewer now reuses the shared
  read-only `AttachmentCell` rather than bypassing the state contract.
- Focused frontend bundle `29 passed`: the four planned availability cases,
  shared-map loading regression, asset error mapping, and DataTable adapter.
- Signed-out local browser: a temporarily soft-deleted Thermal Bridges PDF
  showed the unavailable tile/message; the exact row was immediately restored
  and verified. The restored PDF retained its tile, iframe, Download, and Open
  actions.
- Three parallel `simplify` reviews and final rechecks completed with no
  remaining findings. `graphify update .` completed.
- Full `make ci` green: backend `1830 passed, 7 skipped`; frontend `2389
  passed`; formatting, lint, types, boundaries, contract checks, and production
  build passed.

## Phase 06 verification

- Durable sources now state the active-saved-version anonymous gate, the
  list/envelope row-shape invariant, the registry/row-traversal coupling, and
  PDF Report's PDF-only public-viewer behavior.
- D-01 records the production-backed PDF-only decision. The deferred
  `attachment-reference-walker-unification` refactor scopes contract-derived
  mappings, irregular adapters, and mutation lookup consolidation without
  widening access.
- Three parallel `simplify` reviews and rechecks completed with no remaining
  findings. The `docs-pass` required no additional ADR or lesson-log entry.
- `make format` completed without code changes.
- Full `make ci` green: backend `1830 passed, 7 skipped`; frontend `2389
  passed`; formatting, lint, types, boundaries, contract checks, and production
  build passed.
- No deployment or production write occurred; production deployment remains
  Ed's explicit action.

## Hazards

- **Do not run `backend/scripts/sweep_orphaned_assets.py` with `dry_run=False`**
  against any project holding Thermal Bridges or Heat Pump attachments until
  the completed fix is deployed. The local code now protects them, but
  production still runs the old resolver. No scheduler runs it, and Phase 00
  confirms nothing has been swept already.
- **Write validation is now active locally** on the previously unreachable
  tables. Phase 00 proved all production references satisfy that contract.
- **The Phase 02 FieldDef refactor must be byte-identical** — the built-in seed
  is fingerprinted. If the fingerprint moves, stop.
- **Guard falsification is recorded in Phase 03.** Preserve the consequence-rich
  assertions; the old registry-presence test passed throughout this entire bug.

## Verification gates (packet level)

Backend bundle:

1. `make ci` green.
2. The [research.md §6](./research.md) probe reports **31/31 fields reachable**
   after Phases 01 + 02.
3. Guard A fails when the Phase 02 registry entry is removed; Guard B fails when
   `_dict_rows` is restored for `thermal_bridges`. Both demonstrated, with the
   failure messages recorded in the PR.
4. Anonymous `GET /assets`, `/assets/{id}`, `/assets/{id}/url`, and
   `/assets/{id}/download` all succeed for an asset referenced only from
   `thermal_bridges.pdf_report_asset_ids`, and again from a heat-pump table.
5. **Gate un-widened:** an asset referenced by nothing is still 404 for anonymous
   `GET /assets/{id}` and 403 `asset_not_referenced` for `/url`.
6. An asset referenced only from a Thermal Bridges or heat-pump column is not an
   orphan-sweep candidate.
7. `POST /assets/{id}/attach` and `/detach` succeed for `thermal_bridges` and
   heat-pump table keys; bulk download over those tables produces a zip.
8. Signed-in behavior on the same tabs is unchanged.

Frontend:

9. Signed out, per `context/USING_A_WEB_BROWSER.md`: Thermal Bridges shows real
   PDF thumbnails; the modal renders the PDF in its iframe and offers "Open in
   new tab"; Download saves the file.
10. Signed out, negative path: a forced failure shows an in-app message and does
    not navigate away.
11. An unresolvable attachment renders as unavailable, while a normal
    non-previewable file still renders the ordinary `FILE` glyph with working
    actions.

## Log

- **2026-08-03 08:40 EDT** — Ed reported three symptoms from a production
  read-only view of `2524 - Linde Home` while preparing a PHI certifier link.
  Initially root-caused to the missing `pdf_report_asset_ids` registry entry.
- **2026-08-03 09:10 EDT** — Ed observed the problem looked broader than one
  table. Probed all 30 registered fields: 10 unreachable due to the envelope-shape
  defect in the row walker, spanning five subsystems including a latent data-loss
  path. Packet rewritten with seven phases. No code changes.
- **2026-08-03 09:32 EDT** — Phase 00 completed read-only across all four
  production projects and 20 scoped table reads. Seven references found; zero
  validation violations and zero orphan-moved markers. Phase 01 unblocked.
- **2026-08-03 09:50 EDT** — Phase 01 completed. Red envelope tests reproduced
  all five misses; the fix reached 30/30 fields and all workflow regressions.
  Full `make ci` green. Phase 02 next.
- **2026-08-03 10:03 EDT** — Phase 02 completed locally. PDF Report became the
  31st registered field without moving the Thermal Bridges schema fingerprint;
  focused backend and signed-out file-bearing browser checks passed. Phase 03
  next; deployment remains Ed's call.
- **2026-08-03 10:17 EDT** — Phase 03 completed locally. Both schema-derived
  guards were deliberately falsified with the original defects, emitted the
  intended consequence-rich failures, and returned to `55 passed` after clean
  restores. Phase 04 next.
- **2026-08-03 10:40 EDT** — Phase 04 completed. Focused tests, signed-out
  failure/success browser acceptance, three-way simplify review, docs-pass, and
  full `make ci` passed. Phase 05 next.
- **2026-08-03 11:03 EDT** — Phase 05 completed implementation, focused tests,
  signed-out unavailable/restored-PDF browser acceptance, three-way simplify
  rechecks, Graphify, docs-pass, and full `make ci`. Phase 06 next.
- **2026-08-03 11:22 EDT** — Phase 06 completed durable documentation, D-01,
  the walker-unification follow-up stub, three-way simplify rechecks,
  docs-pass, `make format`, and full `make ci`. All local phases are complete;
  deployment remains Ed's call.
