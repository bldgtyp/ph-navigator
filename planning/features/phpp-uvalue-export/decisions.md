---
DATE: 2026-06-23
TIME: 17:19 EDT
STATUS: Q1–Q4 + Q-D/E/F/G locked by the implementation; Q-A/B/C await the Phase 4 PHPP paste
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

## Resolved by the Phase 1–3 implementation (2026-06-24)

These were "open" defaults that the build locked in. They are now reflected in
code and tests; only the **paste-sensitive** cells (Q-A, Q-B, Q-C) still await a
real PHPP copy/paste in Phase 4.

- **Q-D — Assembly no.** Left **blank** (PHPP assigns its own). The right-side
  `Assembly no.` cell is empty.
- **Q-E — incomplete assemblies.** Implemented as a **per-assembly error CSV**
  (reason `incomplete_materials`) listed in the confirm/cancel modal — the
  deliberate divergence from HBJSON's all-or-nothing 422.
- **Q-F — cross-layer split alignment.** Sections are inferred from **equal
  width-fraction profiles**; split layers with differing profiles →
  `too_many_pathways` (`_resolve_section_profile` + `FRACTION_TOLERANCE=1e-6`).
- **Q-G — sections cap.** `PHPP_MAX_SECTIONS = 3` (worksheet max).

## Open — lock against a real PHPP paste (Phase 4)

These do not block code, but each is a place where the output could be wrong
until validated by pasting an exported CSV into a live PHPP **U-Values** sheet.

**Q-A — exact cell columns.** The 7-column grid in `PRD.md` §4 is inferred from
the screenshots. The precise columns for the percentages row and the right-side
labels (Assembly no. / Total thickness / U-value) need a real
copy/paste-into-PHPP check. *Default:* the grid as drawn; finalize in Phase 4.

**Q-B — IP annotation scope.** Append ` [ <in> in ]` to **every** material row
in IP mode? The screenshot shows it only on the concrete row — possibly typed
into that material's stored name, not auto-generated. *Default:* auto-append to
every row in IP; none in SI. Confirm.

**Q-C — percentage precision.** Section percentages feed PHPP's U-value, so
rounding matters. *Implemented default:* `100%` for single section; otherwise 1
decimal (e.g. `15.3%`). Confirm whole-number vs 1-decimal against PHPP.

## Settled by code/precedent (not asked)

- **Build in the backend**, stream the zip like HBJSON — see `research.md` §7.
- **Saved version, not draft** — same as HBJSON; warn if a draft exists.
- **Read-only access can export** (`ProjectViewAccess`).
- **No new deps** — stdlib `csv` + `zipfile`.
- **No Rsi/Rse** — emit `0.00`; matches screenshots and PHN's construction-only
  thermal model.
