---
DATE: 2026-06-07
TIME: 16:40 EDT
STATUS: Active
AUTHOR: Ed May (with Claude)
SCOPE: Current state ledger for the Assembly-Builder hardening feature.
RELATED:
  - README.md
  - PRD.md
  - planning/code-reviews/2026-06-07/assembly-builder-review.md
---

# Status — Assembly-Builder Hardening

## Current state

Planned. No implementation work has started. Five phase plans drafted
on 2026-06-07; awaiting kickoff.

## Phase ledger

| Phase | Title | Status | Notes |
|-------|-------|--------|-------|
| 1 | Bug fixes + trivial cleanups | Complete (2026-06-07) | `rename_assembly` uniqueness fix + regression tests, effect deps cleanup, dead `envelopeShellNotice` removal, thermal-status docstring refresh, May-27 review resolution header, `20-envelope.md` status sweep. |
| 2 | Backend test coverage | Complete (2026-06-07) | Thermal multi-segment hand-calc + input-hash semantics, invalid_geometry / broken_material_reference flags, three drift states (in_sync, customized, source_missing), HBJSON last_layer_outside reversal, 8 untested geometry command kinds + pick_project_material, paste-assignment no-op short-circuit. |
| 3 | Frontend test coverage + test split | Partial (2026-06-07) | Added `flip_orientation` and `flip_layers` command tests. Remaining new tests (refresh-from-catalog dialog, add layer/segment dialogs, hand-enter material modal, sub-tab routing, catalog picker submit) and the 6-way EnvelopePage.test.tsx split are deferred to a follow-up hardening pass. |
| 4 | Frontend refactors | Partial (2026-06-07) | Extracted `usePaintMode` and `useEnvelopeDialogs` hooks (EnvelopePage.tsx: 525 → 403 lines). Deferred: material-form dedupe (`useFrozenUnitOptions`, `parseMaterialNumbers`), `LayerThicknessEditor` → `useLengthDraft` migration, and `AssemblyCanvasToolbarActions` bundle. |
| 5 | Documentation alignment | Partial (2026-06-07) | Shipped: 4 new context docs (envelope-hbjson-export, envelope-thermal-preview, envelope-catalog-drift, envelope-commands) + api.md §9.10b inventory. Deferred: GLOSSARY expansions, UI_UX paint-mode write-up, PRD §6.2 pointer, archived assembly-builder-tools README + Q-AB-2 audit, final 20-envelope.md status sweep. |

## Next step

Hardening pass complete: Phases 1–2 fully done; Phases 3–5 partial with
deferred items recorded above. A follow-up feature folder can pick up the
deferred frontend test split, remaining refactors, and the planning-
hygiene / glossary / UI_UX doc updates.

## Blockers

None.

## Open questions

Both questions raised during planning are resolved (see `PRD.md` §7):

- **Q-AB-1**: steel-stud handling deferred — out of scope for this
  feature.
- **Q-AB-2**: archived `assembly-builder-tools/PRD.md` stays in the
  archive; its README is updated to delegate behavior questions to
  `context/` (Option A). Phase 5 owns the execution.

No remaining open questions blocking any phase.

## Verification across phases

Each phase ends with `make ci` green from the repo root. Phase-specific
verification steps are in each phase plan's Acceptance section.
