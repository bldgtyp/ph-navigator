# TB-09c Code Review

Review date: 2026-05-14
Scope reviewed: current uncommitted files implementing TB-09c, against `docs/plans/01_IMPLEMENTATION-ROADMAP.md` TB-09.c and the relevant `context/` docs. This review intentionally does not judge missing final-app Window Type features outside the TB-09c slice.

## Findings

### P2 - Staging e2e still verifies the saved slice through the frontend origin

- File: `frontend/tests/e2e/windows-tb-09.spec.ts:77`
- Related file: `frontend/tests/e2e/windows-tb-08c.spec.ts:95`

TB-09c explicitly includes hardening the Playwright flow for staging API access, and `_helpers.ts` now adds `apiUrl()` for catalog seed/update calls. The final persisted-slice assertion in the new TB-09 spec still runs inside `page.evaluate()` and calls browser-relative `/api/v1/...` URLs:

```ts
const detailResponse = await fetch(`/api/v1/projects/${id}`, { credentials: "include" });
```

That works locally because Vite proxies `/api` to the backend. On Render staging, the browser page is served from `https://ph-navigator-v2-staging.onrender.com` while the API origin is `https://ph-navigator-v2.onrender.com` per `context/ENVIRONMENT.md` and the roadmap. Unless the frontend service has an undocumented `/api` rewrite, this assertion will hit the static frontend origin rather than the deployed API. That leaves the new `E2E_API_BASE_URL` / Render API-base helper only partially applied and can make the TB-09c staging acceptance fail after deployment.

Use `page.request` with `apiUrl(baseURL, ...)` for the detail and table reads, or pass the resolved API base into `page.evaluate()` and fetch absolute API URLs there. The same pattern should be fixed in `windows-tb-08c.spec.ts` now that this change touches its staging helper path.

Disposition: fixed in the TB-09c review follow-up. `frontend/tests/e2e/_helpers.ts` now exposes `readWindowTypesSlice(...)`, and both `windows-tb-09.spec.ts` and `windows-tb-08c.spec.ts` use `page.request` through `apiUrl(...)` for final saved-slice readback instead of browser-relative `/api` fetches.

### P3 - Review All report is a flat list, not grouped by window type and element as planned

- File: `frontend/src/features/windows/refresh/RefreshReviewAllModal.tsx:34`
- Planning reference: `docs/plans/01_IMPLEMENTATION-ROADMAP.md` TB-09.c Includes
- Context reference: `context/user-stories/10-windows.md` US-WIN-11 criterion 5

The TB-09c plan says the modal lists every drifted / deactivated ref "grouped by window type and element." The implementation builds a flat `<ul>` where every row repeats `windowTypeName`, `elementLabel`, and `slotLabel`. It is still usable for the current 1x1 MVP and does hand off to the per-entry dialog correctly, but it diverges from the planned grouping behavior and will get noisy as soon as a Window Type has multiple elements or multiple drifted frame sides.

This can be a small UI follow-up rather than a blocker: group rows by `window_type_id` then `element_id`, render the window type / element once, and keep the existing per-slot Review buttons. That would also make the `source_deactivated` entries easier to scan without adding any bulk apply behavior.

Disposition: fixed in the TB-09c review follow-up. `RefreshReviewAllModal` now groups the report by window type and element, with per-slot Review buttons inside each group and no bulk action.

## Non-Findings / Confirmed Scope

- `Review all` is hidden in Viewer / locked contexts because `WindowsTab` gates both the header action and banner on `canEdit`, matching the V2 v1 MVP note that read-only drift affordances are deferred.
- The modal has no bulk update action, matching TB-09c and PRD/context guidance.
- The handoff from `RefreshReviewAllModal` to the existing TB-09.b `RefreshDialog` preserves the per-entry write path through `PUT /draft/tables/window_types`; no new bulk mutation surface was introduced.
- The docs-pass update to `context/technical-requirements/api.md` matches the implemented backend endpoint shape from TB-09.a and correctly states that apply actions reuse the replace-slice endpoint.

## Residual Risk

Review follow-up verification: `cd frontend && npm run lint`; `cd frontend && npm run build`; `cd frontend && npm run test:e2e -- tests/e2e/windows-tb-08c.spec.ts tests/e2e/windows-tb-09.spec.ts`; `git diff --check`.
