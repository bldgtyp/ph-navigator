---
DATE: 2026-08-03
TIME: 09:32 EDT
STATUS: Active — Phase 00 complete; Phase 01 next
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

**Phase 00 production inventory complete. No code written yet.**

Two independent backend defects and two UI defects, all confirmed by executing
code in `backend/.venv`, not by reading:

1. **Row walker cannot read five tables.** `iter_rows_for_raw_tables` reads
   `thermal_bridges` and the four heat-pump sub-tables with a bare-list reader
   though they are `{field_defs, rows}` envelopes. **10 of 30 registered
   attachment fields are unreachable.** Affects anonymous visibility, the orphan
   sweeper, write validation, bulk download, and attach/detach.
2. **`thermal_bridges.pdf_report_asset_ids` is not registered at all** — the
   column Ed originally reported. Independent of (1); both fixes are required.
3. Download controls navigate to the API origin, so any non-2xx becomes the page.
4. `AttachmentCell` has no unavailable state, so an unresolvable asset renders as
   a plausible empty file.

Reachability matrix and method: [research.md](./research.md).

Reproduced from Ed's screenshots against production `2524 - Linde Home`. Phase
00 found no stored-data violations, so Phase 01 can safely activate validation
for the previously unreachable tables. The browser symptom is not yet
reproduced against the local `AGENT-BROWSER` fixture.

## Next step

**[Phase 01](./phases/phase-01-row-walker.md) — fix the row walker.** Add the red
regression coverage, make every branch tolerate list and `{field_defs, rows}`
shapes, and prove the anonymous gate remains closed to unreferenced assets.

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

## Hazards

- **Do not run `backend/scripts/sweep_orphaned_assets.py` with `dry_run=False`**
  against any project holding Thermal Bridges or Heat Pump attachments until
  Phase 01 ships. Those assets are live GC candidates: the sweeper would copy the
  R2 object to the orphan prefix and delete the original. No scheduler runs it —
  the risk is manual only, and Phase 00 confirms nothing has been swept already.
- **Phase 01 activates write validation** on two whole tables' worth of
  previously unvalidated references. A bad stored id becomes a 422 rejecting the
  entire table save. This is what Phase 00 is for.
- **The Phase 02 FieldDef refactor must be byte-identical** — the built-in seed
  is fingerprinted. If the fingerprint moves, stop.
- **Guard tests must be falsified** (Phase 03). An unfalsified guard is not a
  guard — the existing registry test passed throughout this entire bug.

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
