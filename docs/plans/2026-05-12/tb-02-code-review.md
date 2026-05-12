---
DATE: 2026-05-12
TIME: 15:30 EDT
STATUS: Review of TB-02 (Create And Open Project Shell) uncommitted changes.
AUTHOR: Claude (code-review)
SCOPE: Code review against TB-02 scope as outlined in
       docs/plans/01_IMPLEMENTATION-ROADMAP.md. Reviewed only the
       uncommitted working-tree changes; not a completeness audit
       against the full MVP.
RELATED: docs/plans/01_IMPLEMENTATION-ROADMAP.md (TB-02 row),
         context/PRD.md §4, §6, §9,
         context/technical-requirements/api.md §9.2, §9.5,
         context/technical-requirements/data-model.md §6.1, §6.2,
         context/user-stories/00-foundation-shell.md (US-0, US-1, US-1.3, US-1.5, US-3).
---

# TB-02 Code Review — Create And Open Project Shell

## Files Reviewed

Backend (new):
- `backend/alembic/versions/20260512_0003_projects.py`
- `backend/features/projects/{__init__,models,access,repository,service,routes}.py`
- `backend/tests/test_projects.py`

Backend (modified):
- `backend/main.py` (router wiring)

Frontend (modified):
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `frontend/src/api.ts`
- `frontend/tests/e2e/health.spec.ts`

Docs (modified):
- `docs/plans/01_IMPLEMENTATION-ROADMAP.md` (TB-02 row update + lesson log)

## Verdict

TB-02 implementation is **well-aligned with the slice scope and PRD**. The
forward-compatible `require_project_access` seam (US-1.5), public-readable
project shell, BT-number uniqueness rules, initial Working version + empty
`ProjectDocumentV1`, ownership-filtered dashboard, and audit logging are all
present and tested. The lesson log accurately calls out what's deferred. No
high-severity security issues. Below are issues worth fixing before TB-03
builds on top.

## Disposition — 2026-05-12 Follow-Up

Addressed immediately:
- #2 `access_mode` now uses the existing `AccessMode` literal through the
  route/service boundary instead of a free `str` with silent fallback.
- #3 `create_project` now accepts a typed FastAPI `Request`; the
  `type: ignore[arg-type]` calls were removed.
- #8 frontend API failures now preserve HTTP status and structured
  `error_code`; `RequireAuth` redirects only for auth/session failures and
  renders a session-check error for 500/network-style failures.
- #12/#13 viewer sign-in links now use `useLocation()` and preserve
  `pathname + search + hash`.
- #4 `ProjectAccess` now carries the already-fetched `ProjectSummary`, so
  `GET /api/v1/projects/{id}` does not perform a second identical project
  lookup before loading versions.

Deferred deliberately:
- #1 proxy-aware client IP and JSON app logs belong with staging/deploy
  setup, where the trusted proxy header and logging target can be verified.
- #5 idempotency key handling remains deferred until draft/save or a
  global mutating-write policy is implemented.
- #10 modal accessibility/focus behavior should be resolved before the
  session-expiry/device-collision modal pattern becomes canonical.
- #11 frontend BT-number availability race is UX polish; backend uniqueness
  remains authoritative.
- #14 deleted-project BT conflict leakage is deferred until soft-delete
  exists.
- #15 project-version name uniqueness should be noted in TB-05 as already
  implemented.

## Architectural / divergence flags

1. **Includes-list items not actually implemented — already acknowledged but
   worth re-flagging.** The TB-02 row lists "proxy-aware client-IP handling,
   JSON application-log setup" in Includes. Implementation has neither:
   - `backend/features/auth/service.py:33` uses `request.client.host`
     directly. Behind Render's proxy this will log the LB IP. Will silently
     poison `user_action_log.ip_address` for every TB-02+ login/project-create
     unless fixed before the staging cutover.
   - No structured JSON logger; FastAPI/uvicorn default text logging only.

   The lesson log acknowledges this and punts to "staging/ops setup." That's
   a fine call but the roadmap row text and the actual code disagree —
   recommend either implementing both before the staging deploy lands, or
   trimming the Includes wording.

2. **`access_mode` stringly-typed across the service boundary.**
   `backend/features/projects/service.py:104` declares `access_mode: str` and
   then re-discriminates with `"editor" if access_mode == "editor" else
   "viewer"`. The route at `routes.py:62` likewise builds the string from a
   bool. Use the existing `AccessMode = Literal["editor", "viewer"]` from
   `models.py:13` end-to-end and drop the silent fallback.

3. **`request_meta: object` + `# type: ignore[arg-type]`** in
   `service.create_project` (`service.py:70`, `:90-91`). The caller always
   passes a `fastapi.Request`. Type it as `Request` and remove the ignores —
   the auth-feature helpers (`client_ip`, `user_agent`) already expect
   `Request`. The type-ignore pair is a quiet bug magnet.

4. **Double project fetch on every authorized read.** `require_project_view_access`
   (`access.py:42`) loads the project to enforce 404, then `get_project_detail`
   (`service.py:106`) loads it again. Not a TB-02 blocker, but the same path
   will fire on every Status / draft / table-slice request from TB-03 onward.
   Cheap fix: stash the row on `request.state` from the dependency and reuse.

5. **No `Idempotency-Key` handling on `POST /api/v1/projects`.** `api.md` §9.5
   says "All mutating REST writes accept `Idempotency-Key`." Strictly
   speaking §9.5 is in the Drafts subsection, so this may be deliberately
   scoped to draft writes — but if the policy is global, project-create needs
   it. Flagging because BT uniqueness limits the blast radius (a re-tried
   network failure with the same payload can't dup-create), so risk is
   limited.

6. **`UniqueViolation` raised inside a `with transaction()` block then caught
   outside** (`service.py:74-99`) works, but only because the inner context
   manager re-raises after rollback. The audit-log row written before the
   violation gets rolled back together with the failed insert. This is the
   desired behavior but is not obvious — worth a single-line comment, since
   the analogous bug bit TB-01 (failed login audit got rolled back).

7. **`require_project_edit_access` is exported but unused in TB-02.**
   Reasonable to leave as a forward-compat hook (TB-03/TB-04 need it). Add a
   one-line `__all__` or comment so the next slice doesn't accidentally
   hand-roll a parallel dependency.

## Frontend issues

8. **`RequireAuth` bounces to `/sign-in` on every error, not just 401**
   (`App.tsx:83-87`). A flaky network, a 500, or `fetchJson`'s generic
   `Error` from a malformed body all collapse to `{ status: "error" }` and
   trigger a sign-in redirect that wipes route state. `fetchJson`
   (`api.ts:107-117`) already throws an `Error` with the API message but
   discards `response.status`. Suggest preserving the status (e.g. throw a
   typed `ApiError`) and only redirecting on 401 /
   `not_authenticated` / `session_invalidated`.

9. **`RequireAuth` re-fetches the session on every `location.key` change**
   (`App.tsx:88`). Means every internal nav (clicking a project row,
   switching tabs) hits `/api/v1/auth/session`. With the planned 60-min
   sliding-expiry "every authenticated API request resets the timer" (US-0
   #9), this is harmless on the keepalive front but wasteful. Move session
   to a context populated once, refresh on 401 from feature calls.

10. **`NewProjectModal` has no Esc-to-close, no backdrop-click-to-close, no
    focus trap, no autoFocus on first input.** Out of TB-02 scope per the
    lean shell read, but US-0 #11 establishes that in-place modal UX matters
    and TB-03's lesson note explicitly requires "the in-place
    session-expiry/device-collision modal pattern is present or explicitly
    split into a blocking auth follow-up." This modal is the prototype
    future modals will copy — worth getting right now.

11. **`canSubmit` allows submit when `availability.status === "error"` or
    `"idle"`** (`App.tsx:346-351`). If the debounced check fails
    (network/AbortError race after typing+immediate-submit), the user can
    still click Create and the backend will return 409. Acceptable, but the
    "checking" lockout window leaves a small interval where a stale
    "available" reading lets a duplicate slip past frontend validation. Not
    a correctness issue (backend enforces) — a UX one.

12. **Sign-in link in viewer mode** (`App.tsx:506-509`) preserves `pathname`
    only, not `search` or `hash`. If TB-15 adds viewer state to the URL it'll
    be lost on re-auth.

13. **`window.location.pathname` is read directly in JSX** (`App.tsx:507`).
    Use `useLocation()` so the link re-renders if the route changes while
    the shell is mounted.

## Data model / migration

14. **`get_project_by_bt_number` does *not* filter `deleted_at IS NULL`**
    (`repository.py:44-52`). This is *correct* per the spec ("soft-deleted
    projects retain their numbers; numbers are never reused"). Flagging only
    because the `check-bt-number` response will leak a deleted project's
    `name` to the dashboard once US-1.4 ships delete. Cheap fix: return the
    conflict but hide `name` if `deleted_at IS NOT NULL`.

15. **Migration enforces `uq_project_versions_project_name`** (line 75)
    ahead of the Decision Queue ("Project version name uniqueness — Needed
    by TB-05"). Matches the lean but ships the decision early. Worth noting
    in TB-05's lesson log that this is already in place.

16. **Migration order is correct** — `project_versions.project_id` FK
    created at table creation; `projects.active_version_id` FK added
    afterward; downgrade reverses cleanly. ✓

## Test coverage

Targeted at the slice's "tests" bullet (bt_number uniqueness, create/list/open
contracts, view-vs-edit access, public write rejection). ✓

Gaps worth a single follow-up:
- No test for `CreateProjectRequest` validators: dedup of `cert_programs`,
  name/bt_number strip-then-required, `cert_programs` value-validation when
  Pydantic rejects a bad literal.
- No test that the explicit `existing is not None` path AND the race-path
  `UniqueViolation` catch both produce `bt_number_taken`. Add one test that
  simulates a concurrent insert (or trust the constraint).
- `test_projects.py` truncates `users` in its fixture (lines 22, 30).
  Acceptable in test-DB isolation, but blasts state any sibling test (e.g.
  `test_auth.py`) created in the same session — TB-01 lessons noted this
  same pattern. Consider per-test transactional rollback (savepoint) instead.

## Security

No high-severity findings. Quick confirmations:
- Cookie: HttpOnly, SameSite=Lax, Path=/, Secure-by-env. ✓
- Mutating browser write requires `Origin` in allowed set (middleware). ✓
- `check-bt-number` requires auth → no public BT-number enumeration. ✓
- `get_project_by_id` projection excludes `owner_id` (fix referenced in
  TB-02 lesson log). ✓
- Public viewer cannot mutate (representative test). ✓
- Password hashing inherited from TB-01 (Argon2id). ✓

## Out of TB-02 scope (do not need to fix here)

- `PATCH /projects/{id}` (rename/metadata/transfer), `DELETE /projects/{id}`
  — `api.md` §9.2 lists them; spec'd for v1.1 (US-1.4) and Settings tab
  post-MVP. Correctly absent.
- `?scope=all` on list — currently dashboard-filter only, which the api.md
  spec permits since "today: same as default for editors."
- Real version dropdown, Save, Settings menu — placeholders only, matches
  the Includes wording.
- Status content, draft/save endpoints, MCP, catalog, model, etc. — owned
  by later slices.

## Summary recommendation

Land TB-02 essentially as-is. Before TB-03 starts, address (in rough
priority): #8 (redirect-on-any-error), #2/#3 (type holes around
`access_mode` / `request_meta`), and #4 (single project lookup per
request). These are now fixed. #1 (proxy IP + JSON logs, or rewrite the
Includes line) remains staging-owned. #10 (modal a11y) should resolve
before or together with the TB-03 session-expiry modal.
