---
DATE: 2026-07-01
TIME: -
STATUS: PRD accepted; phased plan authored. No implementation
  started.
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the MEP element-selection feature.
RELATED: README.md, PRD.md, PLAN.md, phases/
---

# Model Viewer — MEP Element Selection & Length Reporting — Status

## Current state

`Ready for implementation handoff.` PRD authored 2026-07-01 from a
full read of the current Ventilation/Hot Water lens implementation
(`frontend/src/features/model_viewer/`), the backend `model_viewer`
schemas/extraction, and the upstream `honeybee_phhvac` source
(`ducting.py`, `hot_water_piping.py`, `hot_water_system.py`). Ed
reviewed and accepted the PRD same-day, including a refinement to the
row/segment interaction model (PRD §6 — hover in 3D syncs to the
table row transiently; clicking a table row sets a sticky 3D focus)
that was worked through in conversation and folded back into the PRD.

Five implementation phases authored in `phases/`, each a self-
contained subagent handoff (required reading, work breakdown with
file:line references, verification gate, exit criteria) mirroring the
archived MVP model-viewer feature's phase-doc format:

1. `phase-01-backend-total-length.md` — backend `length` fields.
2. `phase-02-element-selection-highlight.md` — element-level
   selection/highlight/camera + base inspector card.
3. `phase-03-row-segment-focus-linking.md` — the row↔3D focus
   behavior + four-tier highlight color model.
4. `phase-04-dimension-lines.md` — optional/cuttable dimension-line
   overlays.
5. `phase-05-verification-closeout.md` — full cross-lens
   verification + repo closeout (runs regardless of Phase 4).

No code changes made yet.

**Known-good finding baked into Phase 1:** pipe element total length
is already computed by `honeybee_phhvac` and already present in the
extraction dict — `extraction.py` already calls
`to_dict(_include_properties=True)` for hot water, and the flag was
verified (by reading `hot_water_system.py`, `hot_water_piping.py`'s
Branch/Trunk `to_dict` methods) to propagate through every tree depth
(trunk/branch/fixture/recirc). It's dropped today only because
`PhHvacPipeElementSchema` doesn't declare a `length` field. Duct
element length has no upstream serialization at all; Phase 1
recommends computing it locally in PHN via a Pydantic `@computed_field`
rather than blocking on an upstream `honeybee_ph` release.

## Next step

Hand off `phases/phase-01-backend-total-length.md` to an implementation
agent (or start it directly). Phase 1 is fully independent of the
others and has no open blockers.

Before or during Phase 5, resolve PRD §13 open question 1 (is segment
dict insertion order physically meaningful?) — flagged in
`phase-05-verification-closeout.md` §3.1, not blocking earlier phases
but must be settled before the `#` column ships to production.

## Blockers

None.

## Note on an in-session file-loss incident (2026-07-01)

Partway through authoring `PLAN.md`/`phases/`, this folder's four
top-level files (`README.md`, `PRD.md`, `STATUS.md`, `PLAN.md`) were
found deleted from disk mid-session — only `phases/` (already written)
survived. No git history, no Dropbox conflicted-copy file, nothing
renamed; `git status` showed the whole folder as a single untracked
entry both before and after. Cause not determined — flagged to Ed as
consistent with this repo's known concurrent-editing pattern
(see agent memory `feedback_concurrent_committer`), but the selective
nature (four files gone, one subfolder untouched) doesn't cleanly
match a `git clean`-style explanation either. All four files were
recreated verbatim from conversation context with no content loss.
If this happens again, it's worth investigating with `fs_usage` or
Dropbox's own event history rather than assuming it won't recur.
