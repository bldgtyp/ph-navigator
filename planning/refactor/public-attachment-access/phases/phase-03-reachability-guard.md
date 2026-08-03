---
DATE: 2026-08-03
TIME: 10:17 EDT
STATUS: Complete
AUTHOR: Claude with Ed May
SCOPE: Structural tests that make an unreachable or unregistered attachment
  column impossible to ship silently.
RELATED:
  - ../PRD.md
  - ../research.md
  - ./phase-01-row-walker.md
  - ./phase-02-register-pdf-report.md
---

# Phase 03 — Reachability guard

## Goal

Two structural tests that fail loudly on the two mistakes this packet fixes:
a document column with no registry entry, and a registered field the walker
cannot reach.

## Why this is a deliverable, not a formality

`backend/tests/test_assets_registry.py:108-135` already iterates every table key
and asserts a matching `ATTACHMENT_FIELDS` entry with the right kinds, content
types, and counts — and it passed the entire time all ten fields were
unreachable. **Registration was tested; reachability was not.** The suite
verified the map and never checked the territory.

The anonymous-access tests exercise exactly one field —
`pumps.datasheet_asset_ids` — which happens to sit on the working side of the
split (research.md §4).

Both defects are silent in production: attachments simply do not appear, and the
sweeper quietly reclassifies them as garbage. Nothing errors. That is exactly
the class of bug that needs a structural guard rather than case-by-case tests.

## Guard A — every attachment column is registered

Catches the Phase 02 class of defect.

Walk the project-document row models and collect every field whose name ends in
`_asset_ids`, along with the table it belongs to. Assert each has a matching
`ATTACHMENT_FIELDS` entry.

Derive the field list from the Pydantic models (`model_fields`), not a
hand-maintained list — a literal list would rot exactly like the thing it is
guarding. Cover `backend/features/project_document/rows.py` and
`envelope_models.py`.

Give the failure message teeth: name the offending column and state the
consequence, e.g. *"`thermal_bridges.pdf_report_asset_ids` is a document
attachment column with no ATTACHMENT_FIELDS entry — anonymous viewers cannot see
it and the orphan sweeper will treat its assets as garbage."* Whoever trips this
in two years needs to know why it matters, not just that a set differs.

## Guard B — every registered field is reachable

Catches the Phase 01 class of defect. This is the important one.

For each `AttachmentFieldConfig`: build a real document, inject one row holding
a unique asset id into that table + field **in the table's real shape**, then
assert `list_asset_references()` finds it.

The working probe is in [research.md §6](../research.md) — lift it, but fix its
weakness first.

### Independence

The probe hand-encodes a `container_for()` mapping from table key to document
container, mirroring the same if-chain it is testing. A permanent guard that
shares an assumption with the code under test can pass while both are wrong
together.

Build the fixture from the table contract registry
(`backend/features/project_document/tables/registry.py`) — the same source the
document itself is built from — or from an actual saved document produced by the
normal write path (create project → save a row with an attachment through the
table `PUT`). The second is heavier but has zero shared assumptions: if the
round-trip works through the real API, the field is genuinely reachable.

Prefer the round-trip if it can be kept to a few seconds; fall back to the
registry-derived fixture. Do **not** ship the `container_for` version — it would
have passed against the broken code if the author had also gotten the shape
wrong there.

### Assert reachability, not just presence

`rows_walked > 0` is the signal that actually failed here. Assert both that the
reference is found and that the walker saw a nonzero row count, so a future
regression that returns rows but drops the field is also caught.

## Also pin

- **The negative case.** An asset referenced by no table stays 404 for anonymous
  `GET /assets/{id}` and 403 `asset_not_referenced` for `/url`. Guards A and B
  both widen reachability; this test is what proves the gate itself did not
  widen. Keep it adjacent to the guards so the pair is read together.
- **Envelope tolerance.** A direct unit test that
  `iter_rows_for_raw_tables` returns rows for both a bare list and a
  `{field_defs, rows}` envelope, for every table key — the invariant Phase 01
  documents in a comment.

## Verification

- Both guards fail when temporarily reverted: remove the Phase 02 registry entry
  → Guard A fails; restore `_dict_rows` for `thermal_bridges` → Guard B fails.
  **Do this and record the observed failure messages in the PR** — an
  unfalsified guard is not yet a guard.
- `make ci` green with the reverts undone.

## Done when

- Guards A and B exist, pass, and have been demonstrated to fail on a
  deliberately reintroduced defect.
- The negative anonymous case is pinned alongside them.
- `make ci` green.

## Completion evidence

- Guard A scans Pydantic attachment columns from the contract row models and the
  irregular envelope rows; Guard B obtains each injected table path from the
  table contract registry and the real empty-document shape, independent of the
  walker branch map.
- Guard B groups 31 fields into 16 table fixtures. Every table key is also pinned
  independently as a bare list and a `{field_defs, rows}` envelope; nested
  assembly segments now use the same tolerant row helper at all three levels.
- Temporarily removing the Phase 02 registry entry failed Guard A with:
  `thermal_bridges.pdf_report_asset_ids is a document attachment column with no
  ATTACHMENT_FIELDS entry — anonymous viewers cannot see it and the orphan
  sweeper will treat its assets as garbage.`
- Temporarily restoring `_dict_rows` for Thermal Bridges failed Guard B with:
  `thermal_bridges.pdf_report_asset_ids is registered but its real table shape
  yields zero rows — anonymous viewers cannot see its assets and the orphan
  sweeper will treat them as garbage.`
- Both defects were restored. The combined guards, registry suite, and existing
  anonymous 404/403 negative gate pass `55` tests.
- Three parallel `simplify` reviews completed; cached fixtures, grouped table
  traversal, cached contract paths, and consolidated irregular metadata address
  every finding.
- `make ci` passes: backend `1829 passed, 7 skipped`; frontend tests and build,
  formatting, lint, types, and repository boundary checks are green.
