---
DATE: 2026-05-13
TIME: 14:50 EDT
STATUS: Code review of P1-05 first-pass deliverable (in progress)
SCOPE: Dashboard and project-shell completion. Reviews un-committed
       changes representing the P1-05 phase against the roadmap, the
       relevant user stories (`US-1`, `US-2`, `US-3`,
       `US-Errors-SchemaFallback`), the UI/UX narrative §1.1/§2.2/§2.3,
       and the API/MCP contract amendments that landed in the same
       pass. Does not review against final-app completeness; pin /
       reorder persistence, Settings modal, MCP-token UI, and the full
       schema-fallback workspace are explicitly out of scope per the
       P1-05 / P1-07 / US-Errors-SchemaFallback splits.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - planning/ROADMAP.html (P1-05 row + ledger)
  - planning/archive/dated/2026-05-13/phase-1-full-buildout-plan.md
  - planning/code-reviews/2026-05-13/p1-04-code-review.md (preceding slice)
  - context/PRD.md §16 (success criteria amendments)
  - context/user-stories/00-foundation-shell.md (US-1, US-2, US-3,
    US-Errors-SchemaFallback)
  - context/UI_UX.md §1.1 (top header), §2.2 (dashboard), §2.3
    (catalog landing), §2.4 (project workspace), §2.11 (viewer)
  - context/technical-requirements/api.md §9.4 / §9.5 (read-safe
    envelope)
  - context/technical-requirements/llm-mcp-schema.md §10.5 (schema
    versioning mechanisms)
---

# Code Review — P1-05 Dashboard And Project Shell Completion (first pass)

## Scope Check

P1-05's stated scope from the roadmap (line 164–175):

> Finish the Phase 1 shell stories enough that later tabs land inside a
> stable frame. Includes: dashboard row metadata; New Project modal
> polish; Catalogs dropdown routing without full catalog management;
> workspace header, breadcrumbs, tab routing, Viewer/read-only
> separation; no AirTable affordance.

Explicit deferrals recorded in the P1-05 lessons row:

- **Pin / reorder** — depends on a `user_project_preferences`
  table/API that does not exist yet. The slice ships inert pin (☆) /
  row-menu (⋯) placeholders only.
- **Project-shell account identity** — still renders as the literal
  string `Editor` until a later shell/auth cleanup decides whether
  public project routes should also probe `/auth/session`.

This review evaluates only against that P1-05 scope, plus the
companion PRD / API / MCP contract amendments that landed in the
same uncommitted change-set.

## Diff Summary

| File | Status | Notes |
|---|---|---|
| `backend/features/projects/repository.py` | Modified | `list_projects_for_owner` switched from `ORDER BY created_at DESC` to `ORDER BY bt_number DESC`. |
| `backend/tests/test_projects.py` | Modified | Dashboard-list test now creates two projects (`2426`, `2425`) and asserts the BT-DESC order; existing tests untouched. |
| `context/PRD.md` | Modified | §16 success-criteria item for schema fallback reframed around MVP raw-JSON recovery + post-MVP shim hardening. |
| `context/technical-requirements/api.md` | Modified | §9.4 / §9.5 read-safe envelope text reframed as a Phase 1 aid, not a full editability guarantee. |
| `context/technical-requirements/llm-mcp-schema.md` | Modified | §10.5 mechanisms list rewritten; MVP contract + raw recovery + fail-closed surfaces hoisted to items 1–4; shims + golden corpus marked post-MVP. |
| `context/user-stories/00-foundation-shell.md` | Modified | US-Errors-SchemaFallback status changed to "Re-scoped for MVP" with a new MVP acceptance subset; original criteria retained as post-MVP hardening. |
| `planning/ROADMAP.html` | Modified | P1-05 status `[~] In progress` + ledger row. |
| `frontend/src/App.css` | Modified | Adds 4-col topbar grid, breadcrumbs, catalog/account `<details>` menus, dashboard sections, pin/menu placeholder columns, project-title row, read-only pill, narrow-viewport row reflow, catalog-placeholder layout. |
| `frontend/src/App.test.tsx` | Modified | Dashboard heading expectation updated `Projects` → `My Projects`; viewer test now matches the "Read-only" pill text; new test for Catalogs dropdown → Materials placeholder route. |
| `frontend/src/app/router.tsx` | Modified | Adds `/catalog/:catalogSlug` route under `RequireAuth`. |
| `frontend/src/features/projects/components/ProjectList.tsx` | Modified | Adds `onCreateProject` empty-state CTA, "All projects" section heading with count, pin/menu placeholder columns, "Last modified" column header, relative + tooltip date formatting. |
| `frontend/src/features/projects/routes/Dashboard.tsx` | Modified | Heading "My Projects"; topbar now receives `userName` / `onSignOut` (account dropdown takes over the user-menu slot); empty-state CTA wired through. |
| `frontend/src/features/projects/routes/ProjectShell.tsx` | Modified | Builds `topbarBreadcrumbs` from project name + active tab; replaces full-width Viewer banner with inline `read-only-pill`; passes breadcrumbs into `WorkspaceTopbar` for both normal and read-safe paths. |
| `frontend/src/shared/lib/dates.ts` | Modified | Adds `formatProjectDateTime` and `formatRelativeProjectDate` (with `now` injection for testability). |
| `frontend/src/shared/ui/WorkspaceTopbar.tsx` | Modified | Accepts `breadcrumbs`, `userName`, `onSignOut`; renders breadcrumb nav, Catalogs `<details>` dropdown over the live `CATALOGS` array, and an account `<details>` dropdown when `userName`/`onSignOut` are provided. |
| `frontend/tests/e2e/health.spec.ts` | Modified | Scopes `New project` button to `.page-heading` (since it now also appears in the empty-state), updates dashboard heading + Viewer pill text. |
| `frontend/src/features/catalogs/routes/CatalogPlaceholder.tsx` | **New** | Catalog placeholder route under `RequireAuth`; invalid slug → `<Navigate to="/dashboard" replace />`. |
| `frontend/src/shared/lib/catalogs.ts` | **New** | Canonical `CATALOGS` array (`materials`, `window-frame-elements`, `window-glazing`) + `catalogPath` / `catalogBySlug` helpers. |

Net effect: ~411 added / 70 removed across 15 changed files plus 2
new files.

## Verdict

**Approve with one structural fix required and several non-blocking
recommendations.** The slice delivers the visible P1-05 scope —
catalog routing, breadcrumbs, dashboard row metadata, relative
last-modified timestamps, BT-DESC ordering, the inline Viewer pill,
and the absent AirTable affordance. The deferrals match the recorded
lessons. The required fix is the duplicate-numbered list in
`llm-mcp-schema.md` §10.5; the other items are quality / consistency
nits the next slice can carry. Nothing on the security or data path
should block landing this pass.

---

## Findings

### High — Required before completing P1-05

#### H1. `llm-mcp-schema.md` §10.5 mechanisms list has duplicate item numbers

The doc rewrite landed items 1–6 for the new MVP contract, but the
old items 5–7 (Production-corpus drill, Deprecation marker, Pydantic
models per schema version) were left in place with their original
numbering, producing this sequence:

```
1. schema_version integer …
2. Raw recovery download
3. Typed surfaces fail closed
4. Document-level read-safe aid
5. Forward-only upgrade shims (post-MVP)
6. Golden-file corpus (post-MVP)
5. Production-corpus drill before bumping schema_version
6. Deprecation marker on schema_version, never removal
7. Pydantic models per schema version
```

This will read as authoritative MCP/schema doctrine the next time
someone scans §10.5 to decide what's part of MVP vs. later. Re-number
the trailing three items to 7 / 8 / 9 (and confirm they're still
intended to be "post-MVP" per the rewrite's framing; if so, mirror
the `(post-MVP)` suffix used on the new items 5–6).

File: `context/technical-requirements/llm-mcp-schema.md:267-275`.

---

### Medium — Should fix before P1-06, not blocking P1-05 sign-off

#### M1. Catalog dropdown / account dropdown using `<details>/<summary>` does not match UI/UX intent and breaks on the most obvious user gestures

The new `WorkspaceTopbar` implements both menus as native `<details>`
elements:

```tsx
<details className="catalog-menu">
  <summary>Catalogs</summary>
  <div className="catalog-menu-panel">…</div>
</details>
```

Observable consequences:

1. **No click-outside dismissal.** Once opened, the menu stays open
   until the user clicks the summary again. Clicking any non-menu
   surface (project rows, search, page heading) leaves both menus
   floating over the page.
2. **No `Esc`-to-close.** `<details>` only toggles on summary
   activation; the user cannot dismiss with the keyboard the way
   shadcn `DropdownMenu` would allow.
3. **No menu-pattern ARIA.** Screen readers announce a disclosure
   widget, not a menu. WAI-ARIA Authoring Practices for this surface
   want `role="menu"` / `role="menuitem"` and `aria-haspopup` /
   `aria-expanded` on the trigger. The dashboard a11y baseline is
   close to landing in P1-08 (DataTable) and will set the bar for
   the rest of the app; this is the first non-trivial menu to ship
   and it sets the wrong precedent.
4. **Stays open after navigation within the same surface.** Because
   each route remounts its own `WorkspaceTopbar`, navigation between
   `/dashboard` and `/catalog/materials` does reset the open state
   (verified by inspection). But navigation *within* the dashboard
   (e.g. opening the new-project modal, switching project tabs from
   the project shell) leaves the catalog menu open underneath the
   modal/page, which is jarring.

The UI/UX narrative (§1.1) explicitly references shadcn `Dialog` /
`Sonner` primitives; the equivalent here would be shadcn
`DropdownMenu` or a small `useState` + click-outside hook. P1-04
deliberately deferred installing shadcn until a real surface needed
it. This menu is that surface.

**Recommended fix for P1-06:** replace both `<details>` menus with a
small `Popover`/`Menu` primitive (either shadcn, or a hand-rolled
`useState` + ref-based outside-click detection) so the menus behave
the way the rest of the dashboard's interactive surfaces do.

Files: `frontend/src/shared/ui/WorkspaceTopbar.tsx:42-66`,
`frontend/src/App.css:325-370`.

#### M2. `ReadSafeRecoveryPanel` still renders the old full-width "Read-only public view" banner; rest of the app moved to the inline pill

The roadmap lesson row for P1-05 records that the Viewer header now
shows a "compact Read-only pill instead of a full-width banner"
(matching UI/UX §2.11). `ProjectShell.tsx:127-130` implements that
for the normal path:

```tsx
<div className="project-title-row">
  <h1 id="project-title">{project.name}</h1>
  {isViewer ? <span className="read-only-pill">Read-only</span> : null}
</div>
```

…but `ReadSafeRecoveryPanel` at line 180 still uses the pre-P1-05
banner:

```tsx
{isViewer ? <div className="read-only-banner">Read-only public view</div> : null}
```

Consequence: a public Viewer who hits an unsupported-schema version
sees the old banner; a public Viewer who hits a supported version
sees the new pill. The two existing read-safe-path tests at
App.test.tsx:381 and 405 still assert "Read-only public view", which
will start to look like accidental drift the next time someone
greps for the banner class.

**Recommended fix:** reuse the same `project-title-row` + `read-only-pill`
pattern (or its banner equivalent) in `ReadSafeRecoveryPanel` so the
recovery state isn't the lone holdout. Update the two read-safe-path
tests in lockstep.

Files: `frontend/src/features/projects/routes/ProjectShell.tsx:178-244`,
`frontend/src/App.test.tsx:405`.

#### M3. Project-list row uses a single `<Link>` wrapping pin and row-menu placeholders, so clicking the (decorative) pin/menu icons activates the project link

`ProjectList.tsx:60-79` wraps the entire row in `<Link to={projectStatusPath(...)}>`,
including the pin star (`☆`) and the row-menu ellipsis (`⋯`). UI/UX
§2.2 is explicit:

> Row click anywhere except the pin / row-menu opens the project.

The icons are aria-hidden so screen-reader users won't try them, but
visually they invite a click that's about to do something different
from what the user expects. Today the consequence is benign (both
icons just open the project), but the next slice that wires up real
pin/menu actions will need to undo the row-spanning `<Link>`
anyway. Two options for now:

1. **Defer with a comment.** Leave the `<Link>` row, drop the pin/menu
   placeholder columns, and reintroduce both as part of US-1.1 when
   they get real semantics.
2. **Restructure now.** Replace the row `<Link>` with a `<tr>` (or
   `<div role="row">`) whose name and BT-number cells navigate via
   `useNavigate`, and leave the pin / menu cells as inert spans.

Either is fine; the current row-as-link with click-eating icons is
the worst of both worlds because it commits to the placeholder slots
without committing to how they behave.

File: `frontend/src/features/projects/components/ProjectList.tsx:60-79`.

#### M4. `CatalogPlaceholder` sign-out does not navigate to `/sign-in`, unlike `Dashboard.tsx`

`Dashboard.tsx:17-23` explicitly navigates after the sign-out mutation
settles:

```tsx
const handleSignOut = () => {
  signOutMutation.mutate(undefined, {
    onSettled: () => {
      navigate("/sign-in?next=%2Fdashboard", { replace: true });
    },
  });
};
```

`CatalogPlaceholder.tsx:24` does not:

```tsx
onSignOut={() => signOutMutation.mutate()}
```

The good news: `useSignOutMutation` removes the session query, and on
the next `RequireAuth` render the missing session triggers
`<Navigate to={`/sign-in?next=...`} replace />`. So the user does end
up at sign-in. **But** there's a render in between where the catalog
page still has the previous session in scope, and the redirect's
`next` parameter will include `/catalog/materials`, which is actually
better behavior than the dashboard's hard-coded `next=%2Fdashboard`.

Two equally reasonable resolutions:

1. **Make both consistent — drop the explicit navigate in Dashboard.**
   Let `RequireAuth`'s redirect handle the post-sign-out flow
   everywhere, and pick up the `next` parameter for free.
2. **Make both consistent — add an explicit navigate to CatalogPlaceholder.**
   Mirror Dashboard's pattern with a route-appropriate `next`.

Today the asymmetry is fine, but it implies that whoever wired up
account dropdown for one surface didn't audit the other. Tighten in
P1-06.

Files: `frontend/src/features/catalogs/routes/CatalogPlaceholder.tsx:10-24`,
`frontend/src/features/projects/routes/Dashboard.tsx:17-23`.

#### M5. Import ordering in `app/router.tsx` is inconsistent

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../features/auth/routes/RequireAuth";
import { CatalogPlaceholder } from "../features/catalogs/routes/CatalogPlaceholder";
import { SignInPage } from "../features/auth/routes/SignInPage";
```

`CatalogPlaceholder` is wedged between two `features/auth/routes/*`
imports. The rest of the file groups by module path. If a lint rule
for sorted imports lands later (it isn't enabled today), this will be
the first thing it flags. Easy one-line fix.

File: `frontend/src/app/router.tsx:1-7`.

---

### Low — Cleanups for the next docs/simplify pass

#### L1. `formatRelativeProjectDate` has no targeted unit test

TB-03.5 set the precedent that "pure helper tests for status state
cycle, order-index movement, and date-only formatting" live in
`shared/lib/dates.ts`'s adjacent test file. The new
`formatRelativeProjectDate` has four threshold branches (seconds,
minutes, hours, days, fall-back to absolute) and a future-date code
path (negative `elapsedSeconds`). Worth a 5-line Vitest exercise with
an injected `now` to lock the behaviour before P1-06 changes it.

File: `frontend/src/shared/lib/dates.ts:33-51`.

#### L2. `<section className="empty-state" aria-label="Empty dashboard">` overrides the visible `<h2>No projects yet</h2>` heading for the accessible name

This was already the case before the diff, but the empty-state now
has a CTA, so it's worth reconsidering whether `aria-label="Empty
dashboard"` should be `aria-labelledby="..."` pointing at the `<h2>`,
or removed entirely. Minor.

File: `frontend/src/features/projects/components/ProjectList.tsx:32-39`.

#### L3. Topbar grid uses four columns even when the breadcrumb is empty

`.topbar { grid-template-columns: auto minmax(0, 1fr) auto auto; }`
plus the `breadcrumbs.length > 0 ? <nav/> : <span aria-hidden />`
fallback means the dashboard variant (no breadcrumb) still allocates
a 1fr column for nothing. Visually this is fine because `gap: 22px`
takes care of spacing. But the explicit `aria-hidden` empty span is
load-bearing for the grid layout, which is easy to delete later by
accident. A short comment on the placeholder span, or switching the
grid to `auto 1fr auto auto` and conditionally rendering the slot,
would protect it.

Files: `frontend/src/shared/ui/WorkspaceTopbar.tsx:27-41`,
`frontend/src/App.css:243-244`.

#### L4. Catalog placeholder breadcrumb has `Catalogs` as plain text but `Materials` as a self-link

```tsx
breadcrumbs={[
  { label: "Catalogs" },
  { label: catalog.label, to: `/catalog/${catalog.slug}` },
]}
```

UI/UX §1.1 says "Each breadcrumb segment is a link to the
corresponding page." There is no `/catalog` index page in MVP, so the
first segment is appropriately not linked. But the second segment
linking to itself is mildly redundant. Both choices are defensible;
just flag the asymmetry for next docs-pass alignment with §1.1.

File: `frontend/src/features/catalogs/routes/CatalogPlaceholder.tsx:18-25`.

#### L5. Test `routes the Catalogs dropdown to the live catalog placeholders` uses chained `mockImplementationOnce` and only mocks two fetches

```tsx
fetchMock
  .mockImplementationOnce(sessionResponse)
  .mockImplementationOnce(() => jsonResponse({ projects: [] }));
```

Once the catalog route renders, no other fetches are made (the
placeholder is static), and the React Query cache should serve the
session for the second render. So the test passes today. But this
test is the only entry point that exercises the
`<details className="catalog-menu">` summary toggle, and it's also
the canary for "did anyone wire fetches into the placeholder route
without remembering to update this test." Worth switching to the
`mockImplementation((input) => ...)` URL-switching pattern that the
later tests use, so future drift fails loudly instead of silently
404-ing.

File: `frontend/src/App.test.tsx:447-462`.

#### L6. Backend dashboard test now creates `2426` and `2425`; the test comment / setup makes the BT-DESC intent explicit, but the original test name still reads as a "filtered-to-owner" test

The new test asserts ordering as a side effect of the filter check:

```python
assert [project["bt_number"] for project in projects] == ["2426", "2425"]
```

That's fine, but it now does two jobs (owner-filter + sort order) under
the original `test_dashboard_list_is_filtered_to_owner` name. A small
follow-up test specifically named `test_dashboard_list_is_ordered_by_bt_number_desc`
would make the intent of the ordering change discoverable for the
next maintainer.

File: `backend/tests/test_projects.py:104-122`.

---

## Architectural Posture

### What the slice gets right

- **`shared/lib/catalogs.ts` is the right shape.** Catalog labels and
  slugs are declared once as a `readonly` tuple with a derived
  `CatalogSlug` union type. `catalogPath` and `catalogBySlug` are
  pure helpers. When the catalog manager UI lands (TB-07), this is
  exactly the kind of pointer file that scales — add a new
  catalog by editing one constant, and the dropdown, route, and
  breadcrumb pick it up automatically.
- **Breadcrumb shape is data-driven.** `WorkspaceTopbar` takes a
  typed `Breadcrumb[]` array rather than each route reaching into the
  topbar markup. Catalog and project routes both supply their own
  trail; future tabs can do the same.
- **No frontend calculations creep in.** `formatRelativeProjectDate`
  is a display formatter only; sort order and last-modified
  timestamps come from the backend. Holds the CLAUDE.md / PRD §11.5
  invariant that "all calculations and data manipulation live in the
  backend."
- **Backend test caught the regression.** Switching to `bt_number DESC`
  could have silently broken the dashboard for a real user; the test
  asserts the new ordering explicitly.
- **Single Catalogs roster source.** Both `WorkspaceTopbar`'s dropdown
  and `CatalogPlaceholder`'s "available catalog routes" pull from the
  same `CATALOGS` constant — no duplicate listing to drift.

### What's appropriate to defer (matches recorded lessons)

- **Pin / reorder persistence.** No `user_project_preferences` table
  exists yet; shipping inert placeholders is correct.
- **Account identity (`Editor` literal).** Public project routes
  don't probe `/auth/session`, so the project shell can't yet
  distinguish "signed-in editor" from "signed-in editor visiting
  someone else's project as a viewer."
- **Schema-fallback workspace polish.** The PRD / API / MCP doc
  rewrites move the full read-safe workspace behaviour into post-MVP
  hardening. Matches P1-03's MVP re-scope decision.
- **Settings / MCP token UI.** Owned by P1-07.
- **DataTable visual contract.** Owned by P1-08; the placeholder
  catalog page does not pretend to render a table.

### Where the slice diverges from the canonical docs

1. **UI/UX §1.1 menu pattern.** The shipped `<details>` menus do not
   match the dropdown UX implied by "Click opens a small menu listing
   the available catalogs." Recommend M1.
2. **UI/UX §2.2 row interaction.** "Row click anywhere except the
   pin / row-menu opens the project" is violated by the row-spanning
   `<Link>`. Recommend M3.
3. **UI/UX §2.11 Viewer pill.** Normal Viewer path migrated; read-safe
   Viewer path did not. Recommend M2.
4. **`llm-mcp-schema.md` §10.5.** Duplicate numbering. Required (H1).

No divergence from the data model, the API contract, or the access-
check seam.

---

## Security & Data-Path Considerations

- **No new mutating endpoints, no new write tools.** Backend change
  is a single `ORDER BY` flip with no schema or auth-surface
  implications.
- **Access-check seam unchanged.** Catalog routes are gated under
  `RequireAuth`. Catalog placeholder makes no API calls. Future
  catalog manager work will need to flow through
  `require_project_access` or its catalog equivalent, but that's
  TB-07 / TB-08, not this slice.
- **`bt_number DESC` ordering is safe.** `bt_number` is a `TEXT` column
  with a `UNIQUE` constraint per US-1 Q7 / Q3. For the documented
  4-digit format, lexicographic DESC == numeric DESC. The E2E tests
  use `e2e-<timestamp>` / `tabs-<timestamp>` numbers which are not
  fixed-width — fine for tests because they're all the same length
  within one run, but worth a one-line comment in the repository
  function if mixed-length BT numbers ever become a real-life
  concern. (Lean: not now; the spec pins format.)
- **Public Viewer behaviour unchanged.** The pill replaces the
  banner without changing what's hidden from a signed-out visitor;
  Save controls are still gated on `isViewer`, and the read-safe
  envelope path keeps the existing "Edit controls hidden" copy.
- **Sign-out from catalog page** routes through `RequireAuth`'s
  redirect; see M4 for the consistency note, not a security gap.

No security findings.

---

## Performance Considerations

- **`Intl.RelativeTimeFormat` / `Intl.DateTimeFormat` instances are
  module-singletons** at the top of `dates.ts`. Good — they're not
  recreated per call.
- **`formatRelativeProjectDate(value, now = new Date())`** creates a
  fresh `now` if the caller doesn't pass one. With dozens of project
  rows per dashboard render, that's still well under any reasonable
  budget. If the dashboard ever scales to hundreds of rows and React
  renders dominate the timeline, memoize `now` at the `ProjectList`
  level and thread it through.
- **`<details>` panels render their contents into the DOM even when
  closed.** With three catalogs and a sign-out button, the panel
  weight is negligible. Stops being negligible if M1 is left
  unresolved and the panel grows to the future 9-catalog menu.

No performance findings.

---

## Test Coverage

### Backend

- `test_dashboard_list_is_filtered_to_owner` is now also load-bearing
  for the BT-DESC ordering invariant (see L6).
- No new endpoint or service code, so no new fixtures or contract
  tests are required by this slice.

### Frontend unit

- Two existing tests updated for the heading rename and the Read-only
  pill copy change (`App.test.tsx:189, 207, 282, 436`).
- One new test exercises the Catalogs dropdown → Materials
  placeholder (`App.test.tsx:447`). Coverage gap noted in L5.
- Read-safe-path tests at `App.test.tsx:381, 405` still assert the
  old "Read-only public view" banner; this is the read-safe-path
  drift flagged in M2.

### Frontend E2E

- `health.spec.ts` updated to scope `New project` to `.page-heading`
  (because the empty-state dashboard now also has its own button),
  to look for "My Projects" instead of "Projects", and to look for
  "Read-only" instead of "Read-only public view". Locator
  refactors look correct.
- No new E2E for the catalog placeholder route. Acceptable — the
  P1-05 plan says the dropdown ships "without full catalog
  management," and a unit-level route-render assertion covers the
  routing contract.
- No E2E for the dashboard ordering or relative-date display.
  Acceptable for P1-05 because the backend test guards ordering and
  the date formatter is pure.

---

## Roadmap / Docs Hygiene

- The roadmap P1-05 row (lines 164–175) accurately reflects what
  landed and what is deferred. The "Lessons" cell explicitly calls
  out the inert pin/menu placeholders and the `Editor` literal —
  matches the diff.
- The Phase-1 ledger row for P1-05 (line 600) records the local
  verification commands and the staging blocker. Browser-check
  caveat ("Browser plugin reached sign-in but could not type into
  `input[type=email]`; Playwright fallback captured…") is honest and
  reusable for the next pass.
- The companion PRD / API / MCP rewrites are consistent across files
  except for H1. After H1 is fixed, the schema-fallback story will
  read coherently end-to-end.

---

## Recommendations Summary

1. **H1** — Renumber the trailing items in `llm-mcp-schema.md` §10.5.
2. **M1** — Replace `<details>` menus with a real popover/menu
   primitive in P1-06 (or sooner if it blocks shadcn install).
3. **M2** — Migrate `ReadSafeRecoveryPanel` from the full-width
   banner to the inline Read-only pill, and update the two
   read-safe-path tests.
4. **M3** — Resolve the row `<Link>` vs. pin/menu placeholder
   ambiguity before US-1.1 lands.
5. **M4** — Pick one sign-out post-mutation pattern and apply it to
   both `Dashboard` and `CatalogPlaceholder`.
6. **M5** — Fix import ordering in `app/router.tsx`.
7. **L1** — Add a unit test for `formatRelativeProjectDate`.
8. **L2** — Reconcile `aria-label="Empty dashboard"` with the
   visible heading.
9. **L3** — Document the load-bearing empty `<span>` in the topbar
   grid, or restructure the grid to make it unnecessary.
10. **L4** — Settle whether the catalog-self-link breadcrumb segment
    should be a plain label.
11. **L5** — Switch the Catalogs-dropdown test to URL-switching
    `mockImplementation`.
12. **L6** — Split the dashboard-ordering assertion into its own
    backend test.

None of L1–L6 should block P1-05 being marked complete after H1.
M1–M5 should be tracked into the P1-06 / P1-07 work so they don't
silently roll forward.

## Verification I Ran

- Read the P1-05 row and Phase-1 ledger in
  `planning/ROADMAP.html`.
- Read the full diff via `git diff` and the two new files.
- Cross-referenced against `context/PRD.md` §16,
  `context/user-stories/00-foundation-shell.md` US-1 / US-2 / US-3 /
  US-Errors-SchemaFallback, `context/UI_UX.md` §1.1 / §2.2 / §2.3 /
  §2.4 / §2.11, and the api.md / llm-mcp-schema.md amendments.
- Did not run `make lint` / `make test` / `make e2e`; verification
  evidence already recorded in the roadmap ledger row for this slice.
