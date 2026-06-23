---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Resolved (Q1–Q4) + open details (Q-A…Q-F) to confirm before/while coding
AUTHOR: Ed (via Claude)
SCOPE: Design decisions for the PHPP U-Value export.
RELATED: README.md, PRD.md, research.md
---

# Decisions — PHPP U-Value Export

## Resolved (Ed, 2026-06-23)

**Q1 — Multi-segment (parallel-path) layers → PHPP sections.**
Support up to **3 heat-flow pathways** (PHPP's 3 area sections). Assemblies
needing more than 3 distinct pathways (or with incompatible split profiles)
are **not** exported as data — they get an error CSV ("too many materials /
heat-flow pathways") and a confirm/cancel modal. Never output a partial
assembly. → Implemented as the §7 mapping rule in `PRD.md`.
*Wording note:* Ed phrased it as "up to TWO splits, TWO %s." The worksheet
shows three sections / three percentages, and "more than three pathways →
error" matches three. Implementing with `PHPP_MAX_SECTIONS = 3`; see **Q-G**.

**Q2 — Layer order.** **Exterior → Interior** (top row = outermost). Matches
`_layers_outside_to_inside()` used by HBJSON export.

**Q3 — Max rows.** **8** material rows per assembly block. Implement as a named
constant `PHPP_MAX_UVALUE_ROWS = 8`. `len(layers) > 8` → error CSV + modal.

**Q4 — CSV content.** **Full worksheet block** matching the screenshots,
including the computed U-value + total thickness as a reference/sanity cell.

## Open — confirm before or during implementation

These do not block writing code, but each is a small place where the output
could be wrong. Defaults chosen so Phase 1–3 can proceed; lock them in Phase 4
against a real PHPP paste.

**Q-A — exact cell columns.** The 7-column grid in `PRD.md` §4 is inferred from
the screenshots. The precise columns for the percentages row and the right-side
labels (Assembly no. / Total thickness / U-value) need a real
copy/paste-into-PHPP check. *Default:* the grid as drawn; finalize in Phase 4.

**Q-B — IP annotation scope.** Append ` [ <in> in ]` to **every** material row
in IP mode? The screenshot shows it only on the concrete row — possibly typed
into that material's stored name, not auto-generated. *Default:* auto-append to
every row in IP; none in SI. Confirm.

**Q-C — percentage precision.** Section percentages feed PHPP's U-value, so
rounding matters. *Default:* `100%` for single section; otherwise 1 decimal
(e.g. `15.3%`). Confirm whole-number vs 1-decimal.

**Q-D — Assembly no.** Leave blank (PHPP assigns `01ud`/`04ud`)? *Default:*
blank. Alternative: sequential `01`, `02`, …

**Q-E — incomplete assemblies.** PHPP export reports per assembly (error CSV +
modal) instead of HBJSON's all-or-nothing 422. *Default:* per-assembly error
CSV with reason `incomplete_materials`. Confirm this divergence is wanted.

**Q-F — cross-layer split alignment.** PHN has no explicit "this stud spans
layers 2–4" link; we infer aligned sections from **equal width-fraction
profiles**. *Default:* infer by equal profiles; if two split layers differ →
`too_many_pathways`. Confirm, or restrict v1 to "at most one split layer"
(simpler, unambiguous).

**Q-G — 2 vs 3 sections cap.** Resolve the Q1 wording: `PHPP_MAX_SECTIONS = 3`
(worksheet max, current default) vs `2` (literal reading of "two %s").

## Settled by code/precedent (not asked)

- **Build in the backend**, stream the zip like HBJSON — see `research.md` §7.
- **Saved version, not draft** — same as HBJSON; warn if a draft exists.
- **Read-only access can export** (`ProjectViewAccess`).
- **No new deps** — stdlib `csv` + `zipfile`.
- **No Rsi/Rse** — emit `0.00`; matches screenshots and PHN's construction-only
  thermal model.
