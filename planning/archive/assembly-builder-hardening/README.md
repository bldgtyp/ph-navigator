---
DATE: 2026-06-07
TIME: 16:30 EDT
STATUS: Active
AUTHOR: Ed May (with Claude)
SCOPE: Hardening pass on the Assembly-Builder before the next product
       phase: one real bug fix, targeted test coverage gaps, frontend
       refactors that reduce risk-of-change, and the doc anchors for
       shipped behavior that has no canonical write-up yet.
RELATED:
  - planning/code-reviews/2026-06-07/assembly-builder-review.md
  - planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md
  - planning/archive/assembly-builder-tools/README.md
  - planning/archive/assembly-builder-foundation/README.md
  - context/user-stories/20-envelope.md
  - context/technical-requirements/hbjson-export.md
  - context/technical-requirements/api.md
---

# Assembly-Builder Hardening

## Why this feature folder exists

The Assembly-Builder is structurally complete and shipped (see the
2026-06-06 archived `assembly-builder-tools/` ledger). The 2026-06-07
comprehensive review found the architecture sound, but surfaced:

- **one real correctness bug** (`rename_assembly` skips the uniqueness
  check that `create_assembly` and `duplicate_assembly` enforce);
- a handful of trivial cleanups and stale docstrings;
- **meaningful test gaps** — most notably that the thermal multi-segment
  math path (the entire reason both ASHRAE methods exist) has no
  fixture, and 9 command kinds have no direct test;
- **frontend refactor opportunities** that get harder the more state we
  pile on `EnvelopePage.tsx` and the two material-form components;
- **significant documentation drift** — the opaque-construction HBJSON
  export ships fully tested but with no doc anchor, the May-27 review
  reads as live but is fully resolved, and `api.md` never inventories
  the envelope endpoints.

This folder collects the response: five focused phases that close those
gaps without changing product behavior (Phases 1, 4, 5) or while
expanding only the test surface (Phases 2, 3). No new UI features.

## Read order

1. `PRD.md` — scope contract: what is in / out of this hardening pass.
2. `STATUS.md` — current state and next step.
3. `phases/phase-01-bug-fixes-and-cleanups.md` — quick wins, ~half day.
4. `phases/phase-02-backend-test-coverage.md` — thermal math fixtures,
   command-kind coverage, drift state coverage, HBJSON ordering.
5. `phases/phase-03-frontend-test-coverage.md` — refresh-from-catalog
   dialog, untested flows, plus the `EnvelopePage.test.tsx` 6-way split.
6. `phases/phase-04-frontend-refactors.md` — `usePaintMode`,
   `useEnvelopeDialogs`, material-form dedupe, `LayerThicknessEditor`
   migration, toolbar action bundle.
7. `phases/phase-05-documentation-alignment.md` — opaque-construction
   HBJSON contract, thermal preview contract, drift report contract,
   envelope command catalog, api.md additions, status sweeps.

## Phase map

| Phase | Title | Risk | Effort | Depends on |
|-------|-------|------|--------|------------|
| 1 | Bug fixes + trivial cleanups | Low | 0.5 day | – |
| 2 | Backend test coverage | Low | 1–2 days | Phase 1 (one shared regression test surface) |
| 3 | Frontend test coverage + EnvelopePage test split | Low | 1–2 days | Phase 1 (catalog picker effect fix) |
| 4 | Frontend refactors | Medium | 1–2 days | Phases 1, 3 (tests in place before refactor) |
| 5 | Documentation alignment | Low | 1 day | All — docs describe the verified, refactored state |

Phases 2 and 3 are independent of each other and can run in parallel
sessions. Phase 4 is the only phase that changes behavior-adjacent code;
it intentionally runs after the test coverage phases so refactors land
under a regression net.

## Out of scope

The following surfaced during the 2026-06-07 review but are **explicitly
deferred** to a later feature folder (see `PRD.md` §4):

- Re-organizing `models.py` (445 lines) — reviewed and judged to be the
  right shape for a flat command-model surface.
- Moving `drift.py` / `thermal.py` / `hbjson_export.py` into a
  `read/` subdirectory — current flat layout is consistent with the
  rest of the feature.
- Anything steel-stud related (Q-ENV-4 / Q-AB-1) — deferred per
  2026-06-07 decision. This hardening pass does not verify, document,
  or modify steel-stud behavior. Any work on it lives in its own
  future feature folder.
- Adding a `kind → render` lookup map in `EnvelopeEditorDialogs.tsx` —
  reviewed and judged near-but-not-yet at the threshold where the map
  pays off.

## Out of scope (V2-wide patterns)

Some review findings point to patterns that span beyond envelope (e.g.,
`materials_by_id` indexing duplicated across several modules). Those
belong in a cross-cutting cleanup, not here.

## Definitions and shared terms

See `context/GLOSSARY.md` for `Assembly`, `Layer`, `Segment`,
`Project Material`, `Catalog Origin`, `Refresh from catalog`, `Drift`,
`Paint mode`, etc.
