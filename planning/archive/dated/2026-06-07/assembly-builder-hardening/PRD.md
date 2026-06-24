---
DATE: 2026-06-07
TIME: 16:35 EDT
STATUS: Active
AUTHOR: Ed May (with Claude)
SCOPE: Product-and-engineering contract for the Assembly-Builder
       hardening pass. Defines what counts as "done" for each phase and
       what is intentionally not in scope.
RELATED:
  - README.md (this folder)
  - planning/code-reviews/2026-06-07/assembly-builder-review.md
---

# PRD — Assembly-Builder Hardening

## 1. Goal

Bring the shipped Assembly-Builder to a state where:

1. No known correctness bugs remain in the command path.
2. Every command kind is exercised by at least one direct test.
3. The thermal calculation engine's multi-segment path (the entire
   reason both ASHRAE methods exist) is tested against a hand-calc.
4. The five drift-report states are each tested.
5. The single largest extractable block (paint mode) is no longer
   embedded in `EnvelopePage.tsx`.
6. Material-form code is not duplicated across two components.
7. Every shipped backend contract has a doc anchor in `context/`.
8. Future readers of `planning/code-reviews/2026-05-27/` are not misled
   into chasing already-fixed issues.

Nothing in this PRD changes user-facing product behavior. Phase 4
refactors are observable to the codebase, not to the user.

## 2. Non-goals

- No new commands, dialogs, or UI affordances.
- No envelope data-model changes (no new `Assembly`, `Layer`,
  `Segment`, or `ProjectMaterial` fields).
- No backend route additions or removals (only one route handler is
  touched, and only by the `rename_assembly` fix at the command layer).
- No theming, accessibility, or i18n work beyond what existing tests
  already cover.

## 3. Behavior contract

### 3.1 `rename_assembly` uniqueness (Phase 1)

After this work, `POST /draft/envelope/commands` with `kind:
"rename_assembly"` and a `name` value that collides (after
`strip()` + case-fold) with another assembly in the same document
**must** return HTTP 409 with the same error code that
`ensure_unique_assembly_name` already emits for `create_assembly` and
`duplicate_assembly`. No silent rename.

### 3.2 Catalog-picker effect (Phase 1)

The `EnvelopePage.tsx` `useEffect` that closes the catalog picker when
the segment dialog closes must not fire as a no-op on every catalog
picker toggle. Functional behavior is unchanged; the effect's
dependency array is corrected.

### 3.3 `LayerThicknessEditor` migration (Phase 4)

After migration to `useLengthDraft`, the inline thickness editor must
preserve every observable behavior currently asserted by
`EnvelopePage.test.tsx`:

- Enter commits, Escape cancels, blur commits.
- Parse error shows inline and blocks commit.
- Unit-system mid-edit changes do not reformat the in-progress draft.

Tests are updated to call into the shared hook where appropriate but
must continue to drive the editor from the user-facing DOM, not from
hook internals.

### 3.4 `usePaintMode` extraction (Phase 4)

The paint-mode state machine must move out of `EnvelopePage.tsx` into a
hook. Observable behavior is unchanged. The existing paint tests
continue to pass without modification beyond setup wiring.

### 3.5 Material-form dedupe (Phase 4)

`ProjectMaterialEditor` and `MaterialDriftDialog` continue to render
identical forms (their existing visual contract is unchanged). Internal
implementation calls a shared `useFrozenUnitOptions` hook and a shared
`parseMaterialNumbers` helper.

## 4. Out of scope (explicit)

The following items appeared in the 2026-06-07 review but are
**intentionally deferred**:

| Deferred item | Reason | Future home |
|---|---|---|
| `models.py` split (445 lines) | Reviewed; flat command-model surface is correct | – |
| Move `drift/thermal/hbjson_export` into `read/` subdir | Current layout is consistent | – |
| Anything steel-stud (Q-ENV-4 / Q-AB-1) | Deferred per 2026-06-07; held for separate review | own feature folder |
| `EnvelopeEditorDialogs` kind→render map | Near but not over the threshold | revisit at 12+ kinds |
| `replace_assemblies` validate-document optimization | Performance not yet a problem | revisit if document size grows |
| `_load_command_context` `@dataclass` wrapper | Cosmetic; small reward, touches every command call | bundle with next service-layer change |
| `ops.not_found` → `raise_not_found` rename | Cosmetic; high blast radius for the win | bundle with next ops touch |
| Cross-cutting `materials_by_id` indexing helper | Cross-feature pattern | V2-wide cleanup |
| Tooltip rule consolidation in `envelope.css` | Cosmetic; no risk of drift | revisit during next CSS pass |

## 5. Phasing

See `README.md` for the phase map. Phases are designed to be reviewed
and merged independently. Each phase has its own plan under `phases/`
with explicit acceptance criteria.

## 6. Verification gates

Every phase must end with a green `make ci` from the repo root, per
`CLAUDE.md`'s mandatory closeout gate. Phase-specific verification
steps are listed in each phase plan's Acceptance section.

## 7. Open questions

Both questions raised in the draft of this PRD were resolved by Ed on
2026-06-07. They are preserved here for traceability.

- **Q-AB-1 (resolved → deferred):** Steel-stud handling is held for
  later review. This hardening pass does **not** verify, document, or
  modify steel-stud behavior. The Phase 2 plan no longer touches it;
  Phase 5's envelope-HBJSON-export doc describes the rest of the
  export contract and explicitly notes that steel-stud handling is
  intentionally undocumented pending a future review.
- **Q-AB-2 (resolved → Option A):** Keep
  `planning/archive/assembly-builder-tools/PRD.md` archived. Update
  its README so it stops calling itself "the product contract" and
  delegates behavior questions to
  `context/user-stories/20-envelope.md` plus the new
  technical-requirements docs Phase 5 produces. Rationale: the
  project's existing two-zone model (`context/` = live contracts,
  `planning/` = work and history) is already clear; introducing a
  `context/feature-prds/` category would mean two places to look for
  the same answer. Option A also forces any still-load-bearing
  rationale out of the archive and into context, which is the only
  way to keep `context/` complete long-term. Phase 5 adds an explicit
  audit step to surface anything in the archived PRD that needs to
  be folded forward.

These are kept in the PRD rather than the phase files so any future
agent reading top-down sees the resolved scope.
