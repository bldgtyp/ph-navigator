---
DATE: 2026-05-12
TIME: 17:00 EDT
STATUS: Review of TB-03 (Status Tab Lifecycle) uncommitted changes.
AUTHOR: Claude (code-review)
SCOPE: Code review of the uncommitted working-tree changes against
       the TB-03 scope as outlined in
       planning/ROADMAP.html. Not a completeness
       audit against the final app or US-Status full surface.
RELATED: planning/ROADMAP.html (TB-03 row),
         context/PRD.md §4, §4.1, §6.1, §11.1, §13,
         context/CODING_STANDARDS.md,
         context/technical-requirements/data-model.md (project_status_items),
         context/user-stories/00-foundation-shell.md (US-Status §836-1145).
---

# TB-03 Code Review — Status Tab Lifecycle

## Files Reviewed

Backend (new):
- `backend/alembic/versions/20260512_0004_project_status_items.py`
- `backend/features/project_status/__init__.py`
- `backend/features/project_status/constants.py`
- `backend/features/project_status/models.py`
- `backend/features/project_status/routes.py`
- `backend/features/project_status/service.py`
- `backend/features/project_status/repository.py`
- `backend/tests/test_project_status.py`

Backend (modified):
- `backend/main.py` — wires `project_status_router`.
- `backend/tests/test_projects.py` — minor truncate update (not re-reviewed beyond consistency check).

Frontend (new):
- `frontend/src/StatusTab.tsx`

Frontend (modified):
- `frontend/src/App.tsx` — Status tab routing/content swap; `ProjectShell` now mounts `<StatusTab>`.
- `frontend/src/api.ts` — adds `StatusItem*` types and `fetchStatusItems` / `applyDefaultStatusTemplate` / `createStatusItem` / `updateStatusItem` / `deleteStatusItem`.
- `frontend/src/App.css` — adds `.status-*` styles and modal/button additions.
- `frontend/src/App.test.tsx` — adds public-viewer status read + apply-template tests.
- `frontend/tests/e2e/health.spec.ts` — extends the project happy-path with template/cycle/edit/reorder/delete + public read-only checks.

Roadmap doc: `planning/ROADMAP.html` (TB-03 marked Complete; ledger entry added).

## TB-03 Scope Coverage

| TB-03 Includes (roadmap) | Status | Notes |
|---|---|---|
| `project_status_items` relational table | ✓ | Migration 0004, columns and partial index match data-model.md §6.1 sketch. |
| Apply default template | ✓ | `POST /apply-default-template`; 4 cert-agnostic items in `constants.py`; one-shot guard returns 409 `status_template_not_empty`. |
| Add / edit / reorder / delete item workflow (v1) | ✓ | Routes + service exist; reorder is explicit up/down + `Alt+↑/↓` keyboard, not drag (intentional per lesson log). |
| Current-step visual | ✓ | First `todo` highlighted via `.status-item.current` left-border accent + larger title. |
| Read-only public display | ✓ | View dependency allows unauthenticated reads; UI hides edit affordances when `access_mode === "viewer"`. |
| State enum and completion-date rules tests | ✓ | `test_state_done_autopopulates_completion_date_and_preserves_it`, `test_create_done_item_gets_completion_date_and_can_be_backdated`. |
| Default-template tests | ✓ | `test_default_template_applies_once_to_empty_status_list`. |
| Reorder / delete tests | ✓ | `test_reorder_and_soft_delete_status_item`. |
| API tests for non-trivial transitions | ✓ | Public-write 401 (`test_public_viewer_can_read_but_not_mutate_status_items`). |
| Browser-check happy path | ✓ | Playwright spec covers template apply, state cycle, completion-date edit, reorder, delete, public read-only. |

Scope is essentially landed for TB-03. Items below are flagged because they affect architecture, security, or PRD/context alignment going forward — not because TB-03 is incomplete on its own terms.

---

## High-Priority Findings

### H1. Frontend has drifted from CODING_STANDARDS.md feature-first layout
**Where:** `frontend/src/StatusTab.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`.

`context/CODING_STANDARDS.md` (Frontend §"Required Frontend Shape") prescribes:
- `frontend/src/app/App.tsx` (providers/router only), `features/<feature>/{api,hooks,types,routes,components}`.
- TanStack Query for **all** server state; `useEffect` only for true side effects.
- Per-feature `api.ts` / `hooks.ts` / `types.ts`; no flat top-level catch-all.

TB-03 instead added:
- `frontend/src/StatusTab.tsx` at the project root (not under `features/project_status/`).
- A 543-line component file that mixes the route container, three sub-components (`StatusEmptyState`, `StatusItemRow`, `StatusItemModal`), helpers (`nextStatusState`, `stateSymbol`, `sortStatusItems`, `replaceStatusItem`, `orderIndexForMove`, `renderDescription`, `formatStatusDate`), and inline data hooks. Soft limit per CS is 200 lines, hard 500.
- `useEffect` + manual `fetch` + an `AsyncState<T>` discriminated union — the exact "manual `useEffect` fetch blocks" CS explicitly bans in §"Server State, UI State, And Effects".
- A growing flat `frontend/src/api.ts` (now ~250 lines, all features) instead of per-feature endpoint modules.

This is the same divergence the **TB-02 lesson log** already flagged ("introduce the TanStack Query provider / `useQuery` path … or explicitly keep the TB-02 manual `useEffect` loading as a short-lived tracer"). TB-03 did not address it and made the divergence worse by adding a second large feature on the same pattern. The TB-03 lesson-log entry also does not flag this carryover.

**Recommendation:** before TB-04, do a small structural slice that (a) introduces `QueryClientProvider` + a `query-client.ts`, (b) moves `App.tsx` to `app/App.tsx`, (c) splits `api.ts` per feature, and (d) extracts `StatusTab` into `features/project_status/{api,hooks,types,routes,components}` so it can serve as the reference shape. Otherwise every subsequent slice deepens the rewrite cost.

### H2. PATCH with whitespace-only title silently nulls a NOT NULL column
**Where:** `backend/features/project_status/models.py` (`StatusItemUpdateRequest.strip_required_title`) + `backend/features/project_status/repository.py:update_status_item`.

`StatusItemUpdateRequest.title: str | None = Field(default=None, min_length=1, max_length=200)` plus a `mode="before"` validator that maps empty/whitespace strings to `None`. A PATCH body of `{"title": "   "}` therefore:
1. Passes validation with `title=None` (because the validator coerces before `min_length` runs, and `None` doesn't trip `min_length`).
2. Lands in `payload.model_fields_set`, so `title_is_set = TRUE` in the repository params.
3. Executes `SET title = NULL` against a `title TEXT NOT NULL` column → psycopg `NotNullViolation` → unhandled 500.

I verified this with `uv run python` against the actual model: `StatusItemUpdateRequest.model_validate({'title': '   '})` produces `fields_set={'title'}, title=None, dump exclude_unset={'title': None}`.

**Recommendation:** for `StatusItemUpdateRequest`, either (a) raise in the validator when the stripped string is empty so the client gets a 422, or (b) drop the "strip-to-None" coercion for required-when-set fields. Same shape would apply to other future PATCH models. Add a test for `PATCH {"title": ""}` returning 422.

(The corresponding behavior in `StatusItemCreateRequest` is also questionable but harmless — `title=None` would fail `min_length=1` on the public-facing field type `str`, so create returns 422.)

### H3. Description rendering diverges from US-Status criterion 11 (Markdown via sanitized renderer)
**Where:** `frontend/src/StatusTab.tsx:renderDescription`.

US-Status criterion 11 specifies Markdown rendered via a sanitized renderer (e.g. `react-markdown` with allow-list) supporting paragraphs, line breaks, bold, italic, inline code, and external hyperlinks. The current implementation is a hand-rolled regex that only handles `[text](https?://url)` link syntax and treats everything else as literal text. Bold, italic, code, paragraphs, and line breaks all render as literal Markdown source.

This is a **scope cut**, not a security hole — React escapes the literal text, and the link regex only admits `https?://…` (no `javascript:` / `data:` schemes). Two small notes regardless:
- The anchor uses `rel="noreferrer"` only. Modern browsers treat `noreferrer` as implying `noopener`, but the explicit `rel="noopener noreferrer"` is the standard recommendation and survives older targets.
- If/when `react-markdown` lands, drive the allow-list off a real schema; do not extend the hand-rolled regex.

**Recommendation:** call this out in the TB-03 lesson-log entry as a deliberate v1 scope cut (matching the lesson-log discipline used for drag-and-drop), or land `react-markdown` in a TB-03.x follow-up before the description field accumulates user content that the rendering choice would later compromise.

---

## Medium-Priority Findings

### M1. Schema-doc / migration / user-story mismatch on `created_by` / `updated_by` nullability
**Where:** Migration `20260512_0004_project_status_items.py` vs. `context/user-stories/00-foundation-shell.md:898-916`.

US-Status sketches `created_by UUID NOT NULL REFERENCES users(id)` and `updated_by UUID NOT NULL REFERENCES users(id)`. `data-model.md` §6.1 sketches both as nullable. The migration matches `data-model.md` (nullable + `ON DELETE SET NULL`).

The migration is correct given the chosen FK behavior (you can't `SET NULL` into a `NOT NULL` column on user delete), and `data-model.md` is the authoritative implementation contract per the PRD. But the user-story SQL needs to be updated so future readers don't re-litigate.

**Recommendation:** edit US-Status §"Schema (PRD §6.1 amendment)" to match the implementation, or add an explicit "amendment" note like the ones already used in that section.

### M2. No `user_action_log` entries for status mutations
**Where:** `backend/features/project_status/service.py`.

`data-model.md` §`user_action_log` says "Project/version/catalog actions will extend this table or its `details` JSONB as those slices land," and TB-02 wires `auth_repository.log_action(..., action="project_create", ...)` for project creation. TB-03's create/update/delete/apply-template paths do not log anything.

US-Status itself does not require this in v1, and the roadmap doesn't either, so I would not classify this as a bug. But the PRD risk section explicitly relies on `user_action_log` as the v1 "did John make this change?" channel (Risk: "No log surface in v1"). Adding `status_item_create / update / delete / apply_default_template` actions now is cheap — and TB-04+ will need a consistent pattern anyway.

**Recommendation:** add at minimum one `status_item_apply_default_template` action and one `status_item_delete` action. The first is one-shot per project; the second is irreversible from UI. The other two can wait until the audit shape is decided.

### M3. Status mutations have no concurrency control
**Where:** `backend/features/project_status/service.py` + `repository.py`.

Status items are direct write (no draft buffer), which is fine and matches US-Status criterion 5 ("All state changes flush a single `PATCH` to the backend (no draft buffer — relational table, direct write)"). But two browser tabs / two editors / MCP + browser can issue concurrent PATCH/DELETE without any ETag or `If-Match` discipline. Last write wins silently, including for `order_index` reorders against a list a second editor has reorganized.

PRD §8.5 commits to ETag protection for drafts/versions/table replacement; PRD §4 explicitly assumes "two-user team, sequential editing only" so this is acceptable for v1. TB-06 ("Same-Editor Tabs And Stale Draft Boundaries") is the right home for the broader concurrency story.

**Recommendation:** no code change in TB-03. Capture as a deliberate TB-06 follow-up so it doesn't fall through the cracks when document-side ETags land.

### M4. Duplicated `formatDate` / date formatter logic between `App.tsx` and `StatusTab.tsx`
**Where:** `frontend/src/App.tsx:633-641` (`formatDate` + `PROJECT_DATE_FORMATTER`) and `frontend/src/StatusTab.tsx:34-38, 534-542` (`PROJECT_DATE_FORMATTER` + `formatStatusDate`).

Both implement the same "parse `YYYY-MM-DD` as a local calendar date, then format" pattern that the TB-03 lesson log explicitly identifies as load-bearing (the V1 UTC-parse bug). Two copies = one will drift first.

**Recommendation:** when the feature-first split lands (H1), put this in `shared/lib/dates.ts`. In the meantime, hoist a single helper to the top of `App.tsx` and import it from `StatusTab.tsx`.

### M5. `StatusTab.tsx` file size is at/over the CODING_STANDARDS hard limit
**Where:** `frontend/src/StatusTab.tsx` (543 lines).

CS soft limit 200, hard limit 500 without a written exception. Natural split lines: `StatusItemRow` → its own file, `StatusItemModal` → its own file, helpers (`nextStatusState`, `stateSymbol`, `sortStatusItems`, `replaceStatusItem`, `orderIndexForMove`, `renderDescription`, `formatStatusDate`) → `frontend/src/features/project_status/lib.ts` or similar.

This naturally falls out of H1; not worth a separate restructure if H1 happens soon.

### M6. Existing test coverage misses the helpers that are most likely to regress
**Where:** `frontend/src/App.test.tsx`.

The unit tests cover routing, sign-in, project creation, public viewer, and "apply default template" — all good, all driven through the UI. They do **not** cover:
- `orderIndexForMove` (fractional-indexing math: bottom edge, top edge, single-item).
- `formatStatusDate` for the exact `YYYY-MM-DD` local-calendar path the lesson log flagged as a real bug last cycle.
- `nextStatusState` (the `todo → done → na → todo` cycle).

These are pure functions and the cheapest possible regression tests. The E2E test covers them end-to-end, but a viewer-only refactor that broke `orderIndexForMove` would not be caught by current Vitest scope.

**Recommendation:** add one `StatusTab.lib.test.ts` with ~6 assertions covering the three helpers. Or wait until H1 extracts them, then test.

---

## Low-Priority / Notes

### L1. "Current step" wording in US-Status is internally ambiguous
The Architectural-decisions paragraph in US-Status says "the first non-`done` item in `order_index` order gets a highlight," which would include `na`. Criterion 4 narrows this to "the first `todo` item." The code implements criterion 4 (`items.find((item) => item.state === "todo")`). Code matches the stricter / acceptance-criterion wording; the doc inconsistency is upstream of TB-03.

### L2. `optional_current_user` swallows session lookup errors
`backend/features/projects/access.py:34-39` catches all `HTTPException`s and returns `None`. That's correct for the "anonymous viewer can read" path, but it also masks 401s for an *expired* session that the user might want surfaced (e.g. so the frontend can prompt re-auth instead of silently dropping to viewer). The TB-03 lesson log already calls out the missing session-expiry/device-collision modal as the next auth follow-up; flag this for that work, not for TB-03 itself.

### L3. `apply_default_template` inserts items one-by-one
Four sequential `INSERT … RETURNING` round-trips in a transaction. Fine at four items, but `repository.insert_status_item` is the only insert primitive — a single multi-row insert would also be a one-liner. Worth doing if/when a bulk path lands for other tables.

### L4. `next_order_index` floor + 1.0 is correct but worth a comment
The `coalesce(max(order_index), 0) + 1` SQL gives 1.0 for an empty list and `max + 1.0` otherwise. That works with the soft-delete predicate because the index already excludes `deleted_at IS NOT NULL`. Document the invariant in the repo function so a later refactor doesn't drop the partial-index assumption.

### L5. State-cycle button label uses the *next* state ("Set X to Done"), not the current state
`status-state-button`'s `aria-label="Set ${item.title} to ${nextState}"` is correct for the cycle UX, but screen readers will hear "Set CAD files received to Done" on a button that currently displays the `todo` glyph. This is fine, just confirm the wording is intentional (it is supported by the E2E selector `Set CAD files received to Done`).

### L6. `noopener` not explicit on link rendering
Minor; see H3 closing note. `rel="noreferrer"` already implies it in modern browsers but explicit is defensible.

### L7. `useEffect` cleanup in `StatusTab` aborts in-flight fetches, but mutations don't
The list fetch is properly cancelled on unmount via `AbortController`. The mutation promises (`createStatusItem`, `updateStatusItem`, `deleteStatusItem`, `applyDefaultStatusTemplate`) keep running after unmount and call `setItemsState` on an unmounted component. React just warns; no functional bug. TanStack Query (H1) would handle this automatically.

---

## Items Out Of Scope For TB-03 (Confirmed)

These are intentional and called out so the next reviewer doesn't re-flag them:

- **Drag-and-drop reorder.** Explicit up/down + `Alt+↑/↓` shipped instead, per US-Status criterion 10 "Keyboard fallback" and the TB-03 lesson log.
- **shadcn `Dialog` confirm on delete.** `window.confirm()` used; shadcn integration not yet introduced project-wide.
- **In-place session-expiry / device-collision modal.** Called out as a follow-up before "production-ready editable workflows" by TB-01 and TB-03 lesson logs.
- **MCP token surface for status endpoints.** Endpoints are designed MCP-callable per US-Status criterion 15, but MCP land is TB-04b.
- **Cross-tab / cross-editor coordination.** Owned by TB-06.

---

## Summary

TB-03 lands its declared scope cleanly: the relational `project_status_items` table, the cert-agnostic default template, edit/reorder/delete with editor-vs-viewer separation, and the read-only public view all work and are tested at the right granularity (backend pytest + frontend Vitest + Playwright happy path). Backend code follows the feature-package layout described in CS, repository code stays raw-SQL-parameterized, and the access seam is reused without ad-hoc auth checks in routes.

The most important issues are (1) the frontend's continued drift from the prescribed feature-first / TanStack-Query layout — already flagged in TB-02's lesson log and now compounded by a 543-line `StatusTab.tsx` — and (2) the latent NULL-title 500 in `StatusItemUpdateRequest`. Both are cheap to fix and worth doing before TB-04 builds another editable surface on top of the same patterns. Description Markdown is a deliberate-looking scope cut that should be acknowledged in the lesson log to avoid downstream surprise.

No security or performance defects that would block proceeding to TB-04.

## Disposition (2026-05-12)

| Finding | Disposition | Reason |
|---|---|---|
| H2 blank PATCH title | Fix now | Runtime 500 risk against `title NOT NULL`; add 422 regression coverage. |
| M1 schema-doc mismatch | Fix now | Cheap source-of-truth cleanup; migration/data-model nullability is intentional for `ON DELETE SET NULL`. |
| H3 Markdown renderer | Document now, defer code | MVP shipped safe external-link rendering only; richer allow-listed Markdown can wait until descriptions need it. |
| H1, M4, M5, M6 frontend structure/test drift | TB-03.5 | Worth correcting before TB-04 document editing, but too broad to reopen TB-03 as a defect fix. |
| M2 status audit log | Defer | Useful once TB-04/TB-05 defines the edit/version audit vocabulary. |
| M3 concurrency control | TB-06 | Direct-write status is acceptable for MVP sequential editing; ETag discipline belongs with draft/version work. |
| L1-L7 | Defer/opportunistic | Notes and polish items; none block TB-03 correctness. |
