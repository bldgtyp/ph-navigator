---
DATE: 2026-07-01
TIME: 16:20 EDT
STATUS: Complete and verified.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff for Phase 5 — full cross-lens
  verification, the segment-order open question, and repo closeout.
RELATED:
  - ../PRD.md §13 (open questions), §14 (acceptance criteria — this
    phase walks every one), §15 (testing considerations)
  - ../PLAN.md
  - repo-root CLAUDE.md "Closeout gate" section
---

# Phase 5 — Full verification & closeout

## 1. Goal

Confirm the whole feature (Phases 1-3, plus Phase 4 if it shipped)
holds together across both lenses and every pipe-tree role, resolve
the one open product-correctness question left in the PRD, and run
this repo's standard closeout gate. This phase is not optional even if
Phase 4 was cut — dimension lines are additive polish; this phase is
the feature's actual acceptance gate.

## 2. Required reading (in order)

1. `../PRD.md` in full, one more time, end to end — by this phase
   enough has been built that it's worth re-reading against the
   as-built code rather than trusting memory of Phases 1-4.
2. `../STATUS.md` and each phase file's own "implementation status"
   notes (added as Phases 1-4 complete) — this phase does not
   re-derive what was built, it verifies it.
3. Repo-root `CLAUDE.md` "Closeout gate" section — the `simplify` /
   `docs-pass` skills, `make format`, `make ci` sequence this phase
   runs.

## 3. Work breakdown

### 3.1 Resolve PRD §13 open question 1 — segment order

Verify, against both the canonical fixture and Hillandale, whether
`Object.entries(element.segments)` insertion order corresponds to the
physical order a technician would walk the run (start to end). Two
acceptable outcomes, either is fine — just don't ship the `#` column
(PRD §5) without knowing which is true:

- **If order is meaningful**: no code change needed; add a code
  comment at the point the frontend loader builds `segmentIds`
  (`ElementSummary.segmentIds`, Phase 2 §3.2) recording how this was
  verified, so a future reader doesn't have to re-derive it.
- **If order is not meaningful**: either (a) sort segments by spatial
  chaining at extraction time (each segment's start point matches the
  previous segment's end point, within tolerance) — a backend change,
  small follow-up to Phase 1's schema work — or (b) drop the "walk the
  run in order" framing from the UI copy (keep the `#` column as a
  stable-but-arbitrary row identifier, remove language implying
  physical sequence). Record whichever path was taken in STATUS.md and
  in the PRD (fold the resolution back into §13, moving it from "open
  question" to a settled note per this repo's docs-pass convention).

### 3.2 Full acceptance-criteria walkthrough

Walk PRD §14 criteria 1-13 (or 1-12 if Phase 4 was cut, skipping 12)
one at a time against the running app, and record a pass/fail line for
each in STATUS.md — do not just assert "tests are green," confirm each
criterion by name. Pay particular attention to the pipe-tree coverage
criteria (2, 11) across all four roles (trunk, branch, fixture,
recirc) and the persistence-through-camera-orbit criterion (7), since
those are the two places earlier phases' own test suites might have
only exercised one role/one interaction path each.

### 3.3 Playwright suite sweep

Run the full model-viewer Playwright suite, not just the specs touched
by individual phases:

```
cd frontend && pnpm exec playwright test \
  tests/e2e/model-viewer-files.spec.ts \
  tests/e2e/model-viewer-lenses.spec.ts \
  tests/e2e/model-viewer-themes.spec.ts \
  tests/e2e/model-viewer-measure.spec.ts \
  tests/e2e/model-viewer-site-sun.spec.ts \
  --project=chromium
```

plus whatever new specs Phases 2-4 added. Confirm no regression in the
lenses this feature didn't touch (Building, Spaces, Floor Areas, Site
& Sun) — the shared `LineObject`/store changes in Phases 2-3 touch
code paths those lenses don't use, but the store-level reset-path
changes (Phase 3 §3.1) touch code every lens's selection flows through.

### 3.4 Closeout

1. `$ simplify` on the full diff since this feature folder was
   created.
2. `$ docs-pass` — fold §3.1's resolution back into PRD.md §13; check
   whether `context/user-stories/40-model-viewer.md` needs an
   amendment note (it already has a "V2 composition amendments"
   pattern for exactly this kind of thing — see the archived MVP
   PRD's precedent); check whether `context/GLOSSARY.md`'s existing
   entries for Segment/Element-adjacent terms need a cross-reference.
3. `make format`.
4. `make ci` — must be green, not just "the parts I touched."
5. Browser walkthrough on `localhost:5173` as `codex@example.com`:
   screenshot a selected duct element (multi-segment highlight + card),
   a selected pipe fixture-leg element, a focused segment row (Phase
   3), and dimension lines if Phase 4 shipped. Save under `assets/`.
6. `graphify update .`.
7. Move `STATUS.md`'s "Current state" to `Complete` (or the accurate
   status if something was descoped) and record final verification
   evidence, following the same ledger style as the archived MVP
   feature's `STATUS.md`.

## 4. Out of scope

New feature work. If the walkthrough surfaces a real gap against the
PRD, fix it within this phase's scope if small; if it's a genuine
scope question, stop and flag it rather than quietly expanding scope
this late.

## 5. Verification gate

Everything in §3.2-3.4 above **is** the verification gate for this
phase — there is no further phase after it.

## 6. Exit criteria

All PRD §14 acceptance criteria recorded pass/fail in STATUS.md (fail
only if formally descoped with a reason). `make ci` green. Closeout
skills run. STATUS.md reflects final state. Feature folder ready to
archive per `planning/.instructions.md`'s "Archiving Complete
Features" section once merged.

## 7. Completion record

Completed 2026-07-01.

Implemented / resolved:

- PRD §13 segment-order question resolved by script against canonical
  and Hillandale fixtures: source dict order is stable display order
  only, not reliable physical start-to-end path order.
- `lineElements.ts` comments record that invariant at both duct and
  pipe `segmentIds` construction sites.
- PRD/STATUS/README/PLAN updated to final complete state.
- Context docs-pass amended `context/user-stories/40-model-viewer.md`
  and `context/GLOSSARY.md` for the shipped MEP element behavior.
- Screenshot walkthrough saved under `assets/`.

Verification passed:

- Full model-viewer Chromium Playwright sweep:
  `model-viewer-files`, `model-viewer-lenses`,
  `model-viewer-themes`, `model-viewer-measure`, and
  `model-viewer-site-sun` — 6 passed.
- Local simplify review completed; no code changes required beyond the
  segment-order invariant comment already added for Phase 5.
- Docs-pass completed with the context amendments listed above.
- `make format`
- `make ci`: backend 1250 passed / 7 skipped / 1 warning; frontend
  219 test files passed / 2007 tests passed; production build
  completed.
- `graphify update .`
