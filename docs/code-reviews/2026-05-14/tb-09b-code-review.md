# TB-09b Code Review

Date: 2026-05-14
Reviewer: Codex
Scope: Current uncommitted files implementing TB-09.b, reviewed against `docs/plans/01_IMPLEMENTATION-ROADMAP.md`, `context/user-stories/10-windows.md`, `context/technical-requirements/data-model.md`, and the existing Windows/table-slice implementation. This review treats TB-09.c Review all, Playwright e2e, staging acceptance, and final-app Windows functionality as out of scope.

## Findings

### P2 - Failed refresh writes close the dialog and lose the review state

`frontend/src/features/windows/routes/WindowsTab.tsx:148-158` closes the active refresh dialog after `await commitWindowTypes(nextList)`. However, `commitWindowTypes` catches all mutation errors and does not rethrow (`frontend/src/features/windows/routes/WindowsTab.tsx:105-117`):

```tsx
const commitWindowTypes = async (nextList: WindowTypeEntry[]) => {
  if (!canEdit) return;
  setActionError(null);
  try {
    await replaceMutation.mutateAsync({
      current: slice,
      payload: { window_types: nextList },
    });
    void invalidateRefresh();
  } catch (error) {
    setActionError(errorMessage(error, "Could not update window types."));
  }
};

const applyRefresh = async (nextRef: FrameRef | GlazingRef) => {
  if (!activeRefresh) return;
  const nextList = applyRefToWindowTypes(...);
  await commitWindowTypes(nextList);
  setActiveRefresh(null);
};
```

That means stale ETag, version-locked, validation, or network failures still return normally to `applyRefresh`, which closes the modal and discards the user's Keep mine / Update from catalog choices. The roadmap explicitly calls out this failure mode: "On stale ETag or version lock, surface the existing inline conflict messaging from P1-11 instead of swallowing" (`docs/plans/01_IMPLEMENTATION-ROADMAP.md:576`). An inline page alert may appear, but the dialog closing makes the failed refresh look too much like a completed action and forces the user to reopen/rebuild the selection after a recoverable conflict.

Recommended disposition: have `commitWindowTypes` return `true | false` or rethrow after setting `actionError`, and only `setActiveRefresh(null)` on success. If possible, specialize stale draft/version-locked copy in the same pass so the TB-09.b dialog behaves consistently with the P1-11 conflict path rather than generic "Could not update window types."

### P2 - Refresh apply intentionally preserves `local_overrides`, but stable context still requires recomputing it

`frontend/src/features/windows/refresh/lib.ts:36-42` updates `catalog_origin.catalog_version_id` and `synced_at`, but preserves `local_overrides` verbatim:

```ts
next.catalog_origin = {
  ...ref.catalog_origin,
  catalog_version_id: currentCatalogVersionId,
  catalog_schema_version: catalogSchemaVersion(ref.catalog_origin),
  synced_at: syncedAt,
  local_overrides: [...ref.catalog_origin.local_overrides],
};
```

This matches the current TB-09.b roadmap row, which says "leave `local_overrides` unchanged" (`docs/plans/01_IMPLEMENTATION-ROADMAP.md:576`). It diverges from both stable context docs:

- `context/technical-requirements/data-model.md:745-750`: saving refresh "recomputes `local_overrides` as the fields whose chosen project value still differs from the current catalog value."
- `context/user-stories/10-windows.md:1669-1673`: Save updates the catalog origin and recomputes `local_overrides`.

This is not necessarily wrong for the narrowed TB-09.b MVP, especially because this slice only has an override tracer for `u_value_w_m2k`, not a full field-level editor. But it is a real PRD/context divergence. The practical edge case is a user choosing "Update from catalog" for a field that is currently listed in `local_overrides`: the value can become equal to the catalog value while the UI still reports the field as overridden. If "preserve verbatim" is the intended TB-09.b compromise, record that explicitly in `context/user-stories/10-windows.md` or `context/technical-requirements/data-model.md` as MVP behavior with recomputation deferred.

### P3 - Read-only drift visibility differs from US-WIN-11

The TB-09.b route hides refresh affordances in non-editable contexts by disabling the refresh query with `canEdit` (`frontend/src/features/windows/routes/WindowsTab.tsx:49-53`) and rendering buttons only under `canEdit` (`frontend/src/features/windows/routes/WindowsTab.tsx:435-452`). That matches the roadmap row's "hide in Viewer / locked / read-safe contexts" language (`docs/plans/01_IMPLEMENTATION-ROADMAP.md:576`).

However, US-WIN-11 says locked versions and Viewers should still show drift badges while keeping the refresh dialog unavailable (`context/user-stories/10-windows.md:1683-1684`). The current implementation will not show drift state at all for read-only users because it does not fetch the report.

Recommended disposition: no code change is required if TB-09.b intentionally follows the narrowed roadmap. But the roadmap and stable user story should be reconciled before TB-09.c, because Review all and drift badges need one answer for "visible but disabled" vs "hidden entirely" in locked/viewer contexts.

## Scope Check

Against the narrowed TB-09.b implementation scope, the change is close:

- Adds `frontend/src/features/windows/refresh/` with API, hook, types, default-selection helper, merge helper, dialog, and focused lib tests.
- Fetches the TB-09.a `window-types` refresh report for editable Windows tabs.
- Renders per-slot refresh actions for `drifted` and `source_deactivated` slots.
- Defaults changed, non-overridden fields to Update from catalog and overridden/equal fields to Keep mine.
- Applies selected catalog fields through the existing whole-table replace-slice mutation with the existing ETag headers.
- Updates `catalog_origin.catalog_version_id` and `synced_at`, and preserves `local_overrides`.
- Renders `source_deactivated` slots through the same dialog with Update and Apply disabled.

Items correctly not counted as incomplete for TB-09.b:

- Project-wide Review all modal/report.
- Bulk Update all.
- Playwright e2e or staging Render proof.
- Full field-level "Edit a third value" refresh editor.
- Drift visibility/reporting outside the Windows tab's selected slot UI.
- Materials, Envelope, or Project-level refresh.

## Architecture / Security / Performance Notes

No blocking security issue found. Writes still go through the existing table-slice mutation and backend draft route, so client-side edit hiding is not the security boundary.

The refresh query is keyed under the project-document table key and invalidated after Windows writes. That shape is appropriate for this slice. One small performance note: `refreshSlots.filter((slot) => slot.window_type_id === windowType.id)` runs inside every element render (`frontend/src/features/windows/routes/WindowsTab.tsx:298`). With the current 1x1 MVP this is trivial; if Windows grows into many elements/slots, pre-group by window type/element once with `useMemo`.

The helper/test split is good. The main missing test coverage is integration behavior around failure paths and query invalidation. The roadmap asks for hook tests covering query-key shape and apply invalidation (`docs/plans/01_IMPLEMENTATION-ROADMAP.md:577`), but this change currently only adds `lib.test.ts`.

## Verification

I ran the targeted refresh-lib tests:

```bash
cd frontend && npm test -- --run src/features/windows/refresh/lib.test.ts
```

Result: 3 passed.

I first invoked the test with a repo-root path from inside `frontend/`, which Vitest correctly reported as "No test files found"; the corrected relative path above passed. I did not rerun the full frontend suite, build, lint, or browser check during this review.
