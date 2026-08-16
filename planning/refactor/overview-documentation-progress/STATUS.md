---
DATE: 2026-08-16
TIME: 09:40
STATUS: Implemented on branch
AUTHOR: Claude (with Ed May)
SCOPE: UI/UX refactor of the Overview tab's Documentation-progress pane
RELATED:
  - context/ui/pages/overview-tab.md
  - context/DESIGN_SYSTEM.md
  - frontend/src/features/project_status/components/DocumentationProgress.tsx
  - frontend/src/features/project_document/StatusVocabulary.tsx
---

# Overview → Documentation progress refactor

Branch: `feature/overview-documentation-progress-refactor`

## Why

The pane was a second, worse implementation of a component the Documentation
page already had. Same data (section/group rollups across three evidence
axes), different look: full-width 786x6px bars instead of the designed 3-up
meter grid, no complete/zero states, dead grey deep links, and every text node
that lacked an explicit size falling through to the 16px document default.

## Division of labour (Ed, 2026-08-16)

**Overview is high-level, at-a-glance. Documentation is the drill-down** —
every data field, every record. Overview's job is to show where the work is
and hand you off; it never edits. Where the two surfaces show the same thing,
they use the same component.

## Items

| # | Item | Status |
| --- | --- | --- |
| 1 | Extract the axis meter as one shared component (`StatusAxisRollup`), consumed by both surfaces; `linkFor` is the only difference | Done |
| 2 | Heading parity with Roadmap (`.status-pane-heading`); surface the project-level rollup the payload already returned; "Open section" text link → hover-revealed `ExternalLink` icon after the title | Done |
| 3 | Kill every font fall-through; container type floor; add an expanded-section state to the rendered sweep | Done |
| 4 | Honest affordances + interaction states (title toggles vs. links; hover/focus everywhere); `aria-controls` on the disclosure | Done |
| 5 | Tame the expanded group list — single-line rows matching Documentation's group header (Equipment: ~1200px → ~530px) | Done |
| 6 | `evidenceAttentionLabel` carries the denominator; indicator styled as a plain `--highlight-text` label (tried as an amber chip first — too loud with one on every card, Ed 2026-08-16) | Done |
| 7 | States: heading renders in every state; `.status-empty` panels incl. a new no-sections case; untracked axis no longer reads as complete | Done |
| 8 | Attention indicator: removed from group rows; right-aligned in the pane and card headings; hidden at 100% (Ed, 2026-08-16) | Done |
| 9 | Section-header open icon opens the section's own tab, derived from the section key against `PROJECT_TABS`, falling back to Documentation. Meters still open Documentation with `?needs=` — the header is "go to the thing", the meter is "go to the evidence" (Ed, 2026-08-16) | Done |
| 10 | Group rows get one destination, not four: title becomes a label, meters render unlinked, and the hover-revealed icon is the single way out. All three axis links resolved to the same group anchor (Ed, 2026-08-16) | Done |
| 11 | Status legend removed from the pane — it defines a Needed/Question/Complete/N-A vocabulary this pane never renders (Ed, 2026-08-16) | Done |

All eleven items are implemented on the branch. Merge is Ed's call.

## Decisions worth keeping

- **`features/project_document/` owns the shared status vocabulary.** It
  already held `specification-status.ts` and `StatusVocabulary.tsx`, and both
  `features/documentation` and `features/project_status` import from it, so the
  meter lives there without inverting any dependency. `StatusAxisCounts` moved
  there too; `features/documentation/types.ts` aliases it.
- **`linkFor` is the whole seam** between the two surfaces. Documentation
  renders the meter in place; Overview passes `linkFor` and gets deep links. Any
  further divergence should be resisted.
- **Two gestures, two destinations** (item 9) is the pane's organising rule.
- **The rendered sweep is the real font check.** `check:typography` proves
  source values come from tokens and still passed while four elements rendered
  at the 16px document default. Only `make typography-eval` caught it, and only
  after adding a state that expands a section — the collapsed `project-overview`
  state never rendered the group rows.

## Deferred follow-ups (raised by the `/simplify` pass, deliberately not done)

1. **Promote a shared open-owner link.** The hover-revealed `ExternalLink`
   pattern now exists three times: `documentation-record-open-owner`, the
   ReportTable row action, and `documentation-progress-open` — and they already
   differ (transition token, and only the newest has the `(hover: none)` touch
   fallback). It wants one `shared/ui` component plus a `DESIGN_SYSTEM.md`
   inventory entry, which is its own change across three features.
2. **Let the backend own the section path.** `sectionDestination()` derives a
   route from the section key on the frontend. The backend already resolves
   `table_path` from a template for individual records and already emits the
   hyphenated `section_anchor`, so a `section_path` field would put the route on
   the same side of the wire as every other documentation route and turn the
   fallback into a backend decision. Frontend-side derivation is safe today —
   it goes through `projectTabPath` and falls back rather than 404ing.
3. **Retire the amber mixes in `envelope.css` / `climate-workspace.css`.** They
   use amber at different, stronger percentages for filled surfaces rather than
   the panel trio, so they are a separate recipe rather than a fourth copy —
   but they should still be resolved into tokens.
4. **`DocumentationAxisCounts` alias.** Kept deliberately: the alias preserves
   the backend Pydantic model's name at the wire boundary while the shared
   type carries the vocabulary-module name.

## Open debt

### typography-eval ceiling (owed, not caused here)

`make typography-eval` fails on `main` today: measured directly at `f7779ff5`,
the sweep returns **30 site-wide variants against a ceiling of 29**. The
ratchet went stale before this branch started.

This branch finishes **variant-neutral**: also 30, with one *additional* swept
state, and the `button` role budget down 18 → 17.

Getting there took two corrections, both caught by the rendered sweep and worth
remembering:

- The section title and the meter label/count each minted a new variant
  (`--fs-md`/bold, `--fs-2xs`/bold). Folding each into a variant that already
  existed improved the design rather than compromising it — the section title
  now shares `.status-title-button`'s exact type, and the meter shares the
  attention line's.
- The attention chip minted a third (`--fs-2xs`/semibold) by overriding
  `.chip--sm`'s weight from a feature sheet. Deleting the override — rather
  than adding anything — both fixed the count and restored the rule that
  feature CSS never restyles a shared primitive's typography.

**Run the sweep after every visual item, not once at the end.** The chip landed
in item 6 and went unmeasured until item 11, so an interim "variant-neutral"
claim in this file was true when written and stale for five items.

`variantCeiling` is temporarily held at **30** with a `$knownFailure` key in
`frontend/scripts/typography-rendered-contract.json` so the check still fails
on a 31st variant while this refactor is in flight. `font-audit-eval.mjs` now
prints that note on every run — a ceiling held open for known drift must not be
able to go quiet, which is how 29 went stale in the first place.

**Owed:** find the 30th variant, remove it, restore the ceiling to 29, delete
the `$knownFailure` key.

**Still owed, but the measurement moved (2026-08-16, Apertures U-Values work).**
The sweep now covers **25** states, not 23: `project-apertures-u-values` and
`project-apertures-u-values-edges` were added, because the Apertures sub-tabs
had no coverage at all — which is how that page's section headings kept
rendering at the browser default 18.72px/700. Adding them exposed three
variants the sweep had never seen, all belonging to the shared `ReportTable`,
and all three were consolidated away rather than admitted:

- report-table column headers were sans at `--fs-xs`/semibold/uppercase —
  identical to the DataTable's header except for the family. Now `--font-mono`,
  so the app has one spelling of "table header".
- the header unit sub-label took the DataTable's weight for the same reason.
- `.report-table__cell--primary` was the app's only 13px/semibold; body cells
  are regular weight everywhere else, DataTable included. Dropped.

Net: still exactly 30, so the ceiling holds and the owed item stands — but do
not go looking for "the 30th variant" against the old 23-state numbers. Whoever
takes this next should also add the remaining unswept report routes (Glazings,
Frames, Installs); a route no state visits has no typography contract at all.

Root cause worth fixing separately: `typography-eval` is its own GitHub
workflow, not part of `make ci`, so ratchet staleness accumulates unseen.

## Verification

- `pnpm run check:all` green
- `pnpm exec vitest run src/features/project_status src/features/documentation` green
- Browser checks via `frontend/scripts/agent-browser.mjs` against the
  `PHN V2 Starter Project` fixture (`49855ee4-…`), which unlike the
  `AGENT-BROWSER` fixture has four populated sections
- Throwaway Playwright probes (since deleted) read computed styles at rest /
  hover / focus, and followed each section-header icon to see where it really
  landed. They are not worth keeping — the durable equivalents are the
  component tests and `make typography-eval`. If you need them again, they were
  ~40 lines each: sign in, navigate, `getComputedStyle` the selectors you care
  about, print a table.
- `/simplify` (4 agents) applied; `make typography-eval` green at the held
  ceiling; full frontend suite 2447 passing
