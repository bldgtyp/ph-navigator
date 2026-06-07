---
DATE: 2026-06-07
TIME: 16:45 EDT
STATUS: Complete (2026-06-07) — Phase 1 implementation plan for the
        Assembly-Builder hardening pass. All six items shipped:
        rename_assembly uniqueness fix + regression tests, catalog-
        picker effect deps cleanup, dead envelopeShellNotice removal,
        AssemblyThermalStatus docstring refresh, May-27 review
        resolution header, 20-envelope.md status sweep.
AUTHOR: Ed May (with Claude)
SCOPE: One real bug fix and a handful of trivial cleanups identified by
       the 2026-06-07 review. Half-day slice. No behavior change beyond
       the rename-uniqueness fix.
RELATED:
  - ../PRD.md §3.1, §3.2
  - planning/code-reviews/2026-06-07/assembly-builder-review.md §1.2, §3.2
  - backend/features/envelope/commands/assemblies.py
  - backend/features/envelope/ops.py
  - frontend/src/features/envelope/routes/EnvelopePage.tsx
  - frontend/src/features/envelope/routes/page-helpers.ts
  - context/user-stories/20-envelope.md
---

# Phase 1 — Bug Fixes + Trivial Cleanups

## P0. Why this slice

Six items, all small, none depending on each other. They are the
quickest possible safety improvement to the Assembly-Builder before any
larger refactor:

1. **Real correctness bug**: `rename_assembly` does not enforce the
   name-uniqueness invariant that `create_assembly` and
   `duplicate_assembly` already enforce. An end user can rename
   "WALL-A" to "WALL-B" with no error even when "WALL-B" already
   exists. Single-line fix + one regression test.
2. **Effect dependency bug**: the catalog-picker close-on-non-segment
   effect in `EnvelopePage.tsx` lists `[catalogPickerOpen, dialog]` but
   only needs `[dialog]`. Functionally correct today, but causes a
   no-op setState on every catalog picker toggle. Trivial.
3. **Dead code**: `envelopeShellNotice` is exported in `page-helpers.ts`
   and called from nowhere. Verified by grep.
4. **Stale docstring**: `AssemblyThermalStatus` says "Placeholder until
   Phase 5 adds calculations." Phase 5 shipped.
5. **Misleading prior review artifact**: the
   `2026-05-27/assembly-builder-foundation-review.md` reads as live but
   every H1/H2 finding has been resolved. A header note prevents future
   readers from chasing fixed work.
6. **User-story status sweep**: `context/user-stories/20-envelope.md`
   still marks shipped sub-stories as "Draft."

This phase ships nothing visible to a user. It removes ambiguity for
the next reader of the codebase.

## P1. Acceptance — Phase 1 done when

- [ ] `rename_assembly` rejects duplicate names with HTTP 409 carrying
      the same error code that `create_assembly` emits, including for
      whitespace-only or case-only collisions, and including against
      its own current name (no-op renames still succeed).
- [ ] A new pytest covers the rename collision and the rename no-op
      case, and exists in `backend/tests/envelope/test_envelope_commands_geometry.py`
      or a similarly-located file.
- [ ] `EnvelopePage.tsx`'s catalog-picker-close effect has dependency
      array `[dialog]` only.
- [ ] `envelopeShellNotice` and `envelope-shell-notice` are removed
      from `page-helpers.ts`; no test references them.
- [ ] `AssemblyThermalStatus` docstring is rewritten to describe
      current behavior, not a now-shipped placeholder.
- [ ] `planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md`
      has a brief resolution header at the top noting that the H1/H2
      items were closed by `assembly-builder-tools/` Phases 9–11, with
      a date.
- [ ] `context/user-stories/20-envelope.md` sub-story statuses are
      reviewed; shipped stories are no longer marked "Draft."
- [ ] `make ci` is green.

## P2. Implementation steps

### P2.1 `rename_assembly` uniqueness fix

File: `backend/features/envelope/commands/assemblies.py:45-50`.

Current:

```python
def rename_assembly(body, command):
    return ops.update_assembly(
        body,
        command.assembly_id,
        lambda assembly: assembly.model_copy(update={"name": command.name}),
    )
```

Change to: trim the name, look up the existing assembly, and call
`ops.ensure_unique_assembly_name` with the current assembly excluded
from the collision set. The exclusion is necessary because renaming an
assembly to its own name (a real UI case — Enter on an unchanged
header) must remain a no-op rather than 409.

Check `ops.ensure_unique_assembly_name`'s current signature. If it does
not already accept an "exclude this id" argument, add one rather than
re-implementing the case-fold + trim collision check inline. Reuse
beats duplication; one helper for three commands.

If `ops.ensure_unique_assembly_name` is currently used only by
`create_assembly` and `duplicate_assembly`, the additional optional
`exclude_id: str | None = None` parameter is backward-compatible.

### P2.2 `rename_assembly` regression test

File: `backend/tests/envelope/test_envelope_commands_geometry.py`
(or wherever the existing assembly create/duplicate tests live —
follow the conventions of the file that already tests the related
commands).

Add two test functions:

- `test_rename_assembly_rejects_duplicate_name` — POST a
  `rename_assembly` whose target name collides (exact, case-fold,
  surrounding whitespace) with another assembly. Assert HTTP 409 and
  the canonical error code.
- `test_rename_assembly_to_own_name_is_noop` — rename an assembly to
  its current name. Assert HTTP 200 and no `draft_etag` change
  (matches the existing no-op short-circuit behavior).

Use the existing test fixtures and helpers in that file. Do not invent
a new fixture pattern.

### P2.3 Effect dependency fix

File: `frontend/src/features/envelope/routes/EnvelopePage.tsx`,
around line 143-145.

Current:

```ts
useEffect(() => {
  if (catalogPickerOpen && dialog?.kind !== "segment") setCatalogPickerOpen(false);
}, [catalogPickerOpen, dialog]);
```

Change deps to `[dialog]`. The `catalogPickerOpen` guard inside the
effect already prevents the no-op `setCatalogPickerOpen(false)` call
when the picker is closed.

### P2.4 Delete `envelopeShellNotice`

File: `frontend/src/features/envelope/routes/page-helpers.ts:25-37`.

Confirmed by `grep -rn "envelopeShellNotice"` to have only the
definition site, no callers. Delete the function. If any CSS class
`envelope-shell-notice` is left behind in `envelope.css` without
callers, remove that too.

### P2.5 Update `AssemblyThermalStatus` docstring

File: `backend/features/envelope/models.py:29` (line approx).

Replace the "Placeholder until Phase 5 adds calculations" sentence with
a docstring that describes the actual semantics:
"Completeness flags derived from `thermal.thermal_issues` —
`is_complete` is true when no issues are reported; `warnings`
enumerates user-actionable problems (missing materials, zero geometry,
broken material refs)."

Keep the rest of the model's docstring intact.

### P2.6 May-27 review resolution header

File: `planning/code-reviews/2026-05-27/assembly-builder-foundation-review.md`.

At the top of the file (immediately after any existing front matter or
title), add a short block:

```markdown
> **2026-06-07 update:** The H1/H2 findings in this review — the
> 1,061-line `service.py`, the `isinstance` dispatch, and the proposed
> commands-file split — were closed by `assembly-builder-tools/`
> Phases 9–11 (archived under `planning/archive/`). This document is
> preserved as the rationale for that work, not as a current action
> list. For the 2026-06-07 review's findings, see
> `planning/code-reviews/2026-06-07/assembly-builder-review.md`.
```

Do not edit the body of the May-27 review.

### P2.7 `20-envelope.md` status sweep

File: `context/user-stories/20-envelope.md`.

Read lines 482-497 (or wherever the sub-story status table now lives).
Compare each sub-story (US-ENV-1 through US-ENV-N) against the shipped
commands in `commands/registry.py`, the shipped routes in
`features/envelope/routes.py`, and the test coverage in
`frontend/src/features/envelope/__tests__/EnvelopePage.test.tsx`.

Update the status column. Use the project status vocabulary from
`planning/.instructions.md`:

- "Draft" → "Merged to main" or "Complete" where shipped and verified.
- Leave anything that is genuinely still draft (e.g., a sub-story whose
  acceptance criteria contain unshipped behavior) alone, but add a
  one-line note describing what remains.

This step is small but easy to over-scope. If a sub-story's status is
ambiguous, mark it for follow-up in `STATUS.md`'s open questions rather
than rewriting it here.

## P3. Verification

- Backend: `cd backend && uv run pytest tests/envelope/test_envelope_commands_geometry.py -x`
- Frontend: no test changes expected; existing `EnvelopePage.test.tsx`
  suite must still pass (`cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`).
- Repo: `make format && make ci` from the repo root, green.

## P4. Risks

- **`ensure_unique_assembly_name` API change**: if the helper is also
  used by code paths outside the three command files, threading an
  `exclude_id` parameter through might touch unexpected sites. Read
  before changing — if the helper is widely used, prefer a local
  helper inside `commands/assemblies.py` that wraps it.
- **Status sweep over-reach**: the temptation to rewrite acceptance
  criteria during the status sweep is real. Resist; this phase only
  flips statuses. Behavior changes belong in their own user-story
  edits.

## P5. Out of scope (defer to later phases)

- Renaming `ops.not_found` to `raise_not_found` (cosmetic, defer).
- Wrapping `_load_command_context`'s 4-tuple return in a dataclass
  (cosmetic, defer).
- Any `commands.assemblies.py` change beyond `rename_assembly`.
- Any test in `tests/envelope/` beyond the rename regression pair.
