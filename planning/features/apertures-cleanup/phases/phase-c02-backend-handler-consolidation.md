---
DATE: 2026-06-07
TIME: (compiled)
STATUS: Active — queued behind Phase C-01 (Window→Aperture rename)
AUTHOR: Claude
SCOPE: Consolidate duplicated helpers across the eight
       `aperture_commands` handler modules and the document-layer
       `apertures/` factories. Eliminate the silent
       `_refresh_origin` semantic divergence between
       create/add-row/pick (resets `local_overrides`) and
       split/duplicate (preserves `local_overrides`). Align the
       outlier `_audit` signature in `refresh.py`. Harden the
       `model_copy()` shallow-vs-deep inconsistency between
       `_build_seeded_element` and the split handler.
RELATED:
  - planning/code-reviews/2026-06-07/aperture-builder-review.md
    (sections "Backend §1–§8")
  - planning/features/apertures-cleanup/PRD.md
  - context/CODING_STANDARDS.md
  - planning/archive/apertures/STATUS.md
---

# Phase C-02 — Backend handler consolidation

## P0. Why this phase

The 13-phase Apertures build-out duplicated five small helper
functions across every command handler module because each phase
shipped one handler at a time and there was no obvious shared seam.
After all 13 phases landed, those duplicates are now load-bearing:

- `_find_entry` × 5, `_find_element` × 3, `_replace_aperture` × 4,
  `_replace_element` × 4, `_audit` × 6 — byte-for-byte identical
  except where they have already drifted.
- `_audit` in `handlers/refresh.py` is missing the `kind`
  positional parameter that every other handler uses. The reader
  diffing two handler files cannot see the divergence.
- `_refresh_origin` exists in three places (`apertures/factories.py`,
  `handlers/dimensions.py`, `handlers/merge_split.py`). Two reset
  `local_overrides`; the merge/split copy intentionally preserves
  it. The function has the same name and signature everywhere, so
  a future developer either unifies them (and silently breaks
  split) or copies the wrong variant into a new handler.
- `_bookshelf_copy_frame` / `_bookshelf_copy_glazing` are
  duplicated across `apertures/factories.py` and
  `handlers/dimensions.py`.
- `_build_seeded_element` calls `model_copy()` without `deep=True`
  while the split handler defensively uses `deep=True`. Safe today
  (all `FrameRef` fields are immutable), latent the moment
  `FrameRef` grows a mutable field.

Phase C-02 is the mechanical fix: extract the shared helpers,
name the two `_refresh_origin` variants distinctly, and align the
outlier signatures. No public command shape changes; no audit
payload changes; no behavior change.

This is the largest payoff in the cleanup backlog because every
future handler edit currently pays a 6× tax.

## P1. Acceptance — Phase C-02 done when

1. New module `backend/features/project_document/aperture_commands/handlers/_shared.py`
   exports:
   - `find_entry(document: ProjectDocumentV1, aperture_id: str) -> ApertureTypeEntry`
   - `find_element(entry: ApertureTypeEntry, element_id: str) -> ApertureElement`
   - `replace_aperture(document: ProjectDocumentV1, entry: ApertureTypeEntry) -> ProjectDocumentV1`
   - `replace_element(entry: ApertureTypeEntry, element: ApertureElement) -> ApertureTypeEntry`
   - `build_audit(kind: str, actor_user_id: str, **payload) -> ApertureCommandAudit`
2. New module `backend/features/project_document/apertures/_ref_helpers.py`
   exports:
   - `reset_origin(origin: CatalogOrigin) -> CatalogOrigin` — resets
     `local_overrides: []` and bumps `catalog_schema_version`. Used
     by create / add-row / pick paths.
   - `advance_origin(origin: CatalogOrigin) -> CatalogOrigin` —
     preserves `local_overrides` and bumps `catalog_schema_version`.
     Used by split / duplicate paths.
   - `bookshelf_copy_frame(frame: FrameRef) -> FrameRef` — deep
     copy + reset origin.
   - `bookshelf_copy_glazing(glazing: GlazingRef | None) -> GlazingRef | None` —
     deep copy + reset origin (None passes through).
3. All eight `aperture_commands/handlers/*.py` modules import the
   five helpers from `_shared.py`. Local copies deleted. Net handler
   LOC drops by ~250 lines.
4. `apertures/factories.py` and `handlers/dimensions.py` import the
   ref helpers from `_ref_helpers.py`. Local `_bookshelf_copy_*`
   copies deleted.
5. `handlers/refresh.py:_audit` signature aligned with the rest
   (`build_audit(kind, actor_user_id, **payload)`).
6. `handlers/merge_split.py` uses `advance_origin` (preserves
   `local_overrides`) at line 222. `handlers/dimensions.py` and
   `apertures/factories.py` use `reset_origin`. Both new helpers
   carry a one-paragraph docstring naming the invariant they
   enforce and which command paths use them.
7. `_build_seeded_element` in `handlers/dimensions.py` passes
   `deep=True` to `model_copy()`. The split handler stays at
   `deep=True`.
8. `MergeElements.element_ids` in
   `aperture_commands/models.py` gains `max_length=400` matching
   the existing grid-size ceiling.
9. `handlers/sidebar.py` `api_error(404, ...)` /
   `api_error(422, ...)` replaced with
   `status.HTTP_404_NOT_FOUND` / `status.HTTP_422_UNPROCESSABLE_ENTITY`.
10. Dead `_ = document_etag` line and the matching import in
    `aperture_commands/service.py` removed.
11. `make ci` is green. Existing handler tests pass without changes
    to assertions.
12. New unit tests added for the gaps surfaced during review
    (P5 below).

## P2. Files touched

### New files

- `backend/features/project_document/aperture_commands/handlers/_shared.py` (~70 lines)
- `backend/features/project_document/apertures/_ref_helpers.py` (~80 lines)

### Modified — handler modules (delete local copies, import shared)

- `handlers/__init__.py` — no change needed; private helpers
  remain private to the package.
- `handlers/dimensions.py` (420 → ~340 lines)
- `handlers/merge_split.py` (281 → ~230 lines)
- `handlers/picks.py` (171 → ~140 lines)
- `handlers/refresh.py` (183 → ~150 lines, plus signature fix)
- `handlers/element.py` (123 → ~95 lines)
- `handlers/paste.py` (123 → ~95 lines)
- `handlers/sidebar.py` (172 → ~135 lines; also status code fix)
- `handlers/manufacturer_filters.py` (105 → ~85 lines)

### Modified — document layer

- `apertures/factories.py` (delete `_bookshelf_copy_*` and
  `_refresh_origin`; import from `_ref_helpers`)
- `apertures/__init__.py` (re-export `_ref_helpers` symbols if any
  external consumers exist — verify with grep first)

### Modified — other

- `aperture_commands/service.py` (delete dead `_ = document_etag`
  + matching import)
- `aperture_commands/models.py` (add `max_length=400` to
  `MergeElements.element_ids`)

### New tests

- `backend/tests/aperture_commands/test_shared_helpers.py` —
  direct tests for the five extracted helpers
- `backend/tests/aperture_commands/test_ref_helpers.py` —
  `reset_origin` vs `advance_origin` invariant tests; bookshelf
  copy depth tests

## P3. Implementation steps

Each step is a self-contained commit. Verify `make ci` between
steps.

### Step 1 — Extract `apertures/_ref_helpers.py`

1. Create `apertures/_ref_helpers.py`.
2. Move `_refresh_origin` from `apertures/factories.py` into
   `_ref_helpers.py` as `reset_origin`. Copy the merge/split
   variant from `handlers/merge_split.py:222` into the same module
   as `advance_origin`. Move `_bookshelf_copy_frame` /
   `_bookshelf_copy_glazing` in as `bookshelf_copy_frame` /
   `bookshelf_copy_glazing`.
3. Add docstrings naming the invariant each enforces:
   - `reset_origin`: "the new ref starts fresh against the
     catalog; any prior `local_overrides` are discarded because
     the consumer is creating a new ref slot".
   - `advance_origin`: "the new ref is a structural sibling of an
     existing ref (split, duplicate). Any `local_overrides` on
     the source persist because the user's prior overrides should
     survive the structural change".
4. Update `apertures/factories.py` to import the helpers; delete
   the local copies.
5. Update `handlers/dimensions.py` to import `reset_origin` and
   the bookshelf copies; delete its local copies.
6. Update `handlers/merge_split.py` to import `advance_origin`;
   delete its local `_refresh_origin`.
7. Run `make ci`.

### Step 2 — Extract `handlers/_shared.py`

1. Create `handlers/_shared.py`.
2. Copy `_find_entry`, `_find_element`, `_replace_aperture`,
   `_replace_element` from `handlers/dimensions.py` into
   `_shared.py` (rename without the leading underscore — they are
   internal to the handler package, not module-private).
3. Copy `_audit` into `_shared.py` as `build_audit`.
   Standardise on the majority signature
   `(kind: str, actor_user_id: str, **payload) -> ApertureCommandAudit`.
4. Add module docstring naming the contract: every command handler
   uses these five entry points; no handler may diverge.
5. Update each of the eight handler modules to import from
   `_shared`. Delete local copies. Tests untouched.
6. Run `make ci`.

### Step 3 — Align `refresh.py:_audit`

1. Replace the divergent signature with a call to
   `build_audit("refreshRefFromCatalog", actor_user_id, ...)`.
2. Run the existing refresh handler tests to confirm payload shape
   is unchanged.

### Step 4 — Fix `_build_seeded_element` shallow copy

1. In `handlers/dimensions.py:_build_seeded_element`, pass
   `deep=True` to each `model_copy()` call.
2. Add a brief comment: `# deep=True keeps each seeded element
   independent — see split handler for the same defensive stance`.

### Step 5 — Tighten `MergeElements.element_ids`

1. `aperture_commands/models.py:127`:
   `element_ids: list[str] = Field(min_length=2, max_length=400)`
2. Update the docstring to name the practical grid-size ceiling.

### Step 6 — Sidebar status code style fix

1. `handlers/sidebar.py:64, 138`: replace literal integers with
   `status.HTTP_404_NOT_FOUND` / `status.HTTP_422_UNPROCESSABLE_ENTITY`.
2. Add `from starlette import status` (match the import style in
   other handlers — verify with grep).

### Step 7 — Remove dead `_ = document_etag`

1. `aperture_commands/service.py:102` and the matching import.

### Step 8 — Backfill the test gaps (review §1)

1. `test_shared_helpers.py`:
   - `find_entry` raises `ApertureNotFound` for unknown id, returns
     the entry for a known id.
   - `find_element` raises for unknown id, returns for known.
   - `replace_aperture` is immutable on the input document.
   - `replace_element` is immutable on the input entry.
   - `build_audit` produces the expected `ApertureCommandAudit`
     shape for every `kind` value in `models.AUDIT_KIND_BY_COMMAND`.
2. `test_ref_helpers.py`:
   - `reset_origin` produces `local_overrides == []` and bumps
     the schema version.
   - `advance_origin` preserves `local_overrides` from the source
     and bumps the schema version.
   - `bookshelf_copy_frame` produces a deep-equal copy with reset
     origin; mutating the copy does not affect the source.
   - `bookshelf_copy_glazing(None)` returns `None`.
3. Backfill the gaps surfaced in the review:
   - `test_aperture_commands_picks.py::test_pick_glazing_hand_enter_rejected`
   - `test_aperture_commands_refresh.py::test_refresh_glazing_target`
   - `test_aperture_commands_dimensions.py::test_add_row_at_out_of_range_index`
   - `test_aperture_commands_sidebar.py::test_duplicate_preserves_catalog_origin`
   - `test_aperture_commands_paste.py::test_paste_glazing_none_clears_target`

## P4. Verification

- `make ci` green after each step.
- `wc -l backend/features/project_document/aperture_commands/handlers/*.py`
  shows the expected reduction.
- `grep -rn "_find_entry\|_find_element\|_replace_aperture\|_replace_element"
  backend/features/project_document/aperture_commands/` returns
  only the new `_shared.py` defs.
- `grep -rn "_refresh_origin\|_bookshelf_copy" backend/features/project_document/`
  returns only the new `_ref_helpers.py` defs.
- Run the existing audit-log integration test (whichever asserts
  the `ApertureCommandAudit` shape end-to-end) to confirm the
  signature change in `refresh.py` did not alter the persisted
  audit payload.

## P5. Risks

- **R-C02-1 — Hidden divergence in a "duplicated" helper.** Before
  deleting any local copy, diff it against the version being moved
  to `_shared.py`. The review flagged `refresh.py:_audit` as the
  one known divergence; verify no others. **Mitigation:** Step 2.1
  diffs each handler's local copy against the canonical version
  before deletion. Any other drift (e.g., a TODO comment, a
  different default) is documented in the PR description.
- **R-C02-2 — `model_copy(deep=True)` breaks a test that relied
  on aliasing.** Today `FrameRef` is all-immutable so deep-copy
  produces a structurally identical result. **Mitigation:** Step 4
  runs the full `dimensions.py` test file before commit.
- **R-C02-3 — `advance_origin` rename misses a caller.** The
  merge/split copy of `_refresh_origin` is the only known
  preserve-overrides site. **Mitigation:** Step 1 greps for
  `_refresh_origin` across the entire backend before deletion.
- **R-C02-4 — Audit payload shape drift.** Standardising
  `refresh.py:_audit` on the majority signature must not change
  the persisted audit JSON. **Mitigation:** Run the audit-log
  integration test before and after Step 3; diff the produced
  `ApertureCommandAudit` row in a fixture-style test.

## P6. Out of scope

- The `Window*` → `Aperture*` rename (backlog A.1–A.6) — Phase
  C-01 ships that.
- Drift correctness / N+1 / `_LiveCatalogReader` consolidation —
  Phase C-03 ships those.
- Frontend changes — Phase C-04.
- Coverage gaps that are already in the cleanup backlog (E.1
  Playwright, E.2 V1 fixture parity, E.3 banner/refs view smoke
  tests).
