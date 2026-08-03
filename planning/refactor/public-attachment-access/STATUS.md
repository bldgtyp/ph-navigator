---
DATE: 2026-08-03
TIME: 09:10 EDT
STATUS: Researched and scoped — ready for implementation handoff, no code written
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

**Research complete and measured. No code written.**

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

Reproduced from Ed's screenshots against production `2524 - Linde Home`. Not yet
reproduced locally against the `AGENT-BROWSER` fixture — worth doing as the
first step of Phase 01 so there is a red test before the fix.

## Next step

**[Phase 00](./phases/phase-00-production-inventory.md) — production inventory.**
Read-only. Must complete before any code lands, because Phase 01 switches on
write validation for references that have never been validated.

## Blockers / decisions needed from Ed

- **Ship order vs the certifier link.** Phases 01 + 02 are the contained backend
  half and are what make the PDFs open. 04 and 05 improve every failure mode but
  are not required for the link to work. If the link needs to go out sooner, 01 +
  02 is the minimum viable set.
- **PDF-only allowlist** for the new registry entry — mirrors the frontend, but
  confirm against Phase 00 that no stored PDF-report asset is a non-PDF before
  locking it in.
- **Remediation for any Phase 00 violations** — re-upload, detach, or relax the
  registry entry, per case.

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
