---
DATE: 2026-06-27
TIME: 14:30 ET
STATUS: REVIEW — current-state map of logged-in (editor) vs logged-out
        (anonymous viewer) access control, plus a first-draft access RULE
        to guide the read-only-experience work. Read-only audit; no code
        changed. This is the research/review artifact that precedes any
        page-by-page UI planning for the shared read-only experience.
AUTHOR: Claude (Opus 4.8)
SCOPE: Whole-app access control — backend route protection seam, session
       model, and frontend affordance gating. Does NOT propose the read-only
       UX yet; it establishes the baseline and the rule we build on.
REVIEWED:
  - backend/features/projects/access.py            (the access seam)
  - backend/features/auth/service.py               (session lifecycle)
  - backend/features/auth/routes.py                (CurrentUser dependency)
  - backend/database.py                            (connection/transaction CMs)
  - backend/features/*/routes.py                   (full route inventory)
  - backend/features/catalogs/*/routes.py          (global catalog gating)
  - frontend/src/features/projects/routes/ProjectShell.tsx (viewer centerpiece)
  - frontend/src/features/auth/{hooks,api,lib}.ts, routes/RequireAuth.tsx
  - frontend/src/app/router.tsx                    (route guards)
  - frontend/src/shared/api/client.ts              (credentials + 401)
  - frontend/src/features/{project_status,envelope,apertures,spaces}/...
RELATED:
  - planning/code-reviews/2026-06-07/security-review.md  (findings C-2..C-6 = the authZ gaps named here)
  - planning/code-reviews/2026-06-04/auth-current-user-pipeline-review.md  (per-request cost of the session check)
  - context/GLOSSARY.md  (fold "editor"/"viewer"/"access_mode" terms here once ratified)
---

# Editor vs Viewer — Current Access-Control Map + Access RULE (v0.1)

## TL;DR

The whole logged-in/logged-out boundary turns on **one backend-computed
field**: `access_mode: "editor" | "viewer"`, attached to the project-detail
response. A request carrying a valid session cookie gets `"editor"`; an
anonymous request gets `"viewer"`. The frontend reads `project.access_mode`,
derives a `canEdit` boolean, and threads it down to gate every write control.
The backend enforces the same boundary independently via a small dependency
seam (`access.py`).

Two facts to anchor on:

1. **Reading a single project is public-by-link; writing requires a session.**
   An anonymous user who has a project URL can read that project's *published*
   data. They cannot list projects, see drafts, see owner identity, or write.
2. **"Editor" today means "any logged-in user."** There is **no per-project
   ownership or membership check** on the write path — `is_editor = (user is
   not None)`. Ownership is consulted *only* for delete/restore/hard-delete.
   (This is security-review finding **C-2**; it is by-design-for-now, not a
   bug to panic over, but it is the single biggest thing the read-only model
   must not entrench.)

The architecture is in good shape for a read-only experience because the
per-project signal (`access_mode`) is already cleanly separated from the
global "is there a session at all" signal. **Build on `access_mode`, never
on "is there a session."**

---

## 1. The mental model — two independent questions

The system answers two *different* questions, and keeping them distinct is the
key to not painting ourselves into a corner:

| Question | Who answers it | Backend signal | Frontend signal |
|---|---|---|---|
| **A. Is there a logged-in user at all?** (global) | `current_user_from_request` | raises 401 / returns `UserPublic` | `useSessionQuery()` → `/auth/session` |
| **B. May this caller edit *this* project?** (per-project) | `require_project_access(mode)` | `ProjectAccess.is_editor` → `access_mode` | `project.access_mode === "editor"` |

Today A and B coincide (any session ⇒ editor of every project), so it is
tempting to gate UI on A. **Don't.** Gate on B. The day we add per-project
membership, B becomes "logged in *and* a member of this project" while A stays
"logged in at all," and every affordance already keyed to B keeps working.

The two viewer personas we care about — **the client (home-owner)** and **the
certifier** — are both *anonymous B-viewers* in the current model: no account,
reach one project by link, read published data.

---

## 2. Backend architecture & patterns

### 2.1 The access seam — `backend/features/projects/access.py`

This 85-line file is the entire per-project authorization surface. Everything
flows through it.

- **`ProjectAccess`** (frozen dataclass, `access.py:23-32`) — the value every
  project route receives. Carries `project_id`, `mode` (`"view"|"edit"`),
  `user: UserPublic | None`, the `project` summary, and the property
  `is_editor = (self.user is not None)`.
- **`optional_current_user`** (`access.py:35-40`) — calls
  `current_user_from_request`, **swallows the 401**, returns `None`. This is
  what makes anonymous reads possible.
- **`require_project_access(project_id, request, mode)`** (`access.py:43-66`) —
  loads the project (404 if missing, 410 if soft-deleted), then branches on
  mode:
  - `mode == "edit"` → calls `current_user_from_request(request)` **directly**
    (line 63) → raises 401 if no/invalid session. `access.user` is guaranteed
    non-null.
  - `mode == "view"` → uses `optional_current_user(request)` (line 66) →
    `access.user` may be `None`. **Anonymous allowed.**
- **`require_project_view_access` / `require_project_edit_access`** — thin
  wrappers (`access.py:69-74`) that feature routers wrap in `Annotated[...]`
  dependency aliases.
- **`require_editor_user(access)`** (`access.py:77-80`) — raises 401
  `not_authenticated` if `access.user is None`, else returns the non-optional
  `UserPublic`.

The view/edit distinction is literally these two lines:

```python
# mode == "edit"  → raises 401 for anonymous
user, _expires_at = current_user_from_request(request)
# mode == "view"  → tolerates anonymous (user may be None)
... user=optional_current_user(request) ...
```

### 2.2 How routes consume the seam — and the *double gate*

Each feature router declares its own local aliases (a small amount of
repetition, ~16 modules):

```python
ProjectViewAccess = Annotated[ProjectAccess, Depends(require_project_view_access)]
ProjectEditAccess = Annotated[ProjectAccess, Depends(require_project_edit_access)]
```

There are then **two layers** of editor enforcement, and it's worth
understanding why both exist:

1. **The dependency** (`ProjectEditAccess`) already raises 401 for anonymous
   callers — that *is* the security boundary.
2. **`require_editor_user(access)` called again inside the service/route** —
   used widely (`projects/routes.py:126`, `project_location/routes.py`,
   `project_climate_source/routes.py`, and many services). Its real job is
   **type-narrowing**: it turns `UserPublic | None` into `UserPublic` so the
   write code has a guaranteed user. It is belt-and-suspenders, not redundant
   noise — but note that *correctness of the boundary lives in the dependency*,
   not in the second call.

### 2.3 The `CurrentUser` dependency (non-project routes)

`backend/features/auth/routes.py:23-30` defines the canonical alias every
*non-project* route imports:

```python
def require_current_user(request: Request) -> tuple[UserPublic, datetime]:
    return current_user_from_request(request)

CurrentUser = Annotated[tuple[UserPublic, datetime], Depends(require_current_user)]
```

This is the AUTH-ONLY tier: "any logged-in user, not tied to a project"
(dashboard list, catalogs, global climate datasets, `/auth/session`,
`/auth/preferences`).

### 2.4 Session model (how "logged in" is decided)

`current_user_from_request` (`auth/service.py:182-252`):

- Session = **opaque UUID4** in an httpOnly `phn_session` cookie pointing at a
  `sessions` DB row (not a JWT — so real server-side revocation works).
- One transaction joins `sessions`↔`users`, rejects invalidated/expired
  sessions and inactive users, and slides `expires_at`/`last_seen_at` (throttled).
- **Single active session per user** (partial unique index); a new login
  supersedes prior sessions. CSRF posture: `SameSite=Lax` + Origin allowlist.
- Failure codes returned: `not_authenticated`, `invalid_session`,
  `session_invalidated`, `session_expired` — all HTTP 401.

(Per-request cost and the `FOR UPDATE`/touch-throttle tradeoffs are already
documented in the 2026-06-04 auth-pipeline review; not repeated here.)

### 2.5 DB context managers (the "context managers" Ed asked about)

`backend/database.py` exposes two CMs that all repository access goes through:

- **`connection()`** (`database.py:69-84`) — pooled connection, commit on
  success / rollback on exception. Used for reads.
- **`transaction()`** (`database.py:86-96`) — same, wrapped in
  `conn.transaction()`. Used for writes.

Both install a slow-query timer. `optional_current_user` and the access seam
open their own short `connection()`/`transaction()` scopes; that's why the auth
check is a self-contained per-request unit.

### 2.6 The four protection tiers (+ one)

Every endpoint in the app maps to exactly one of these. This vocabulary is the
backbone of the RULE in §5.

| Tier | Who can call | Mechanism |
|---|---|---|
| **PUBLIC** | anyone, no session | no auth dependency at all |
| **VIEW** | anyone (anonymous OK); user optional | `ProjectViewAccess` / `optional_current_user` |
| **AUTH-ONLY** | any logged-in user; not project-scoped | `CurrentUser` |
| **EDITOR** | logged-in user (= any user today) | `ProjectEditAccess` (+ `require_editor_user`) |
| **OWNER-ONLY** | the project's `owner_id` | `_ensure_project_owner` (404-masks non-owners) |

---

## 3. Backend route inventory (current state)

Complete map across feature modules. "VIEW" = anonymous-readable.

### 3.1 PUBLIC (no auth at all)
- `GET /api/v1/health`, `/ready`, `/version`
- `GET /api/v1/schemas/**` (JSON schema documents)
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`

### 3.2 AUTH-ONLY (any session; **not** anonymous)
- `GET /api/v1/auth/session`, `PATCH /api/v1/auth/preferences`
- `GET /api/v1/projects` (dashboard list — **anonymous cannot enumerate**),
  `POST /api/v1/projects`, `/bulk-delete`, `GET /deleted`, `GET /check-bt-number`
- `GET /api/v1/climate/datasets/**` (**global** climate catalog — login required)
- **All catalog reads *and* writes** — materials, glazing_types, frame_types
  (`GET`/`POST`/`PATCH`/`DELETE`/`import`/`options`). Both read and write are
  `CurrentUser`. **Anonymous users cannot read the global catalogs at all.**

### 3.3 VIEW (anonymous-readable, per-project, by direct link)
- `GET /api/v1/projects/{id}` — returns `access_mode` editor/viewer;
  `owner_display_name` redacted to `null` for viewers (`projects/service.py:445`)
- **Status:** `GET .../status-items`
- **Document/versions:** `GET .../versions/{v}/document`, `.../document/tables/{t}`,
  `.../download`, `.../download/tables/{t}`, `GET .../diff`
- **Apertures (reads):** `spec-report`, `u-values`, `drift-report`, `hbjson` export
- **Envelope (reads):** `GET .../envelope`, `.../assemblies/{id}/thermal`,
  `.../material-catalog-drift`, `.../export/hbjson`, `.../export/phpp[/preflight]`
- **Assets:** `GET .../assets`, `.../assets/{id}`, `.../assets/{id}/url`,
  `.../assets/{id}/download`, `.../assets/bulk-urls`, `.../jobs/{job_id}`
  — ⚠ signed-URL routes are anonymous (security-review **C-6**)
- **Model viewer:** `GET .../hbjson-files[/{id}]`, `.../download`, `.../model_data`,
  `.../faces`, `.../spaces`, `.../ventilation_systems`, `.../hot_water_systems`,
  `.../shading_elements`
- **Location/climate:** `GET .../location` (private fields editor-only),
  `.../sun-path`, `.../climate/sources`
- **Equipment:** `POST .../equipment/heat-pumps/export-phius` (read-only export)

### 3.4 EDITOR (write; login required — any user today)
Every per-project mutation: status writes; **all** draft endpoints
(`draft/**`, save, save-as, preview-replace, custom-fields mutate, aperture
commands, version PATCH); envelope import + `draft/envelope/commands`; asset
upload/complete/patch/delete/attach/detach/bulk-download; model-viewer
create/patch/delete; location PUT + derive/geocode/elevation/epw; climate
source create/patch/delete + dataset-locations + epw-roster; MCP token
list/issue/revoke.

⚠ **`table-views` GET is EDITOR-tier** (`table_views/routes.py:26`) — saved
column layouts/sort state are editor-only state, so **viewers get no saved
table views**. Relevant to read-only UX: a viewer always sees a table's default
layout.

### 3.5 OWNER-ONLY
- `POST /api/v1/projects/{id}/delete`, `/restore`, and internal hard-delete —
  `_ensure_project_owner`, 404-masked to non-owners. **The only place
  `owner_id` is enforced.**

---

## 4. Frontend architecture & patterns

### 4.1 Two auth signals (mirror of §1)

- **Global session:** `useSessionQuery()` (`features/auth/hooks.ts:12`) →
  `GET /auth/session`. Tells the app whether *anyone* is logged in.
- **Per-project access:** `project.access_mode` (`features/projects/types.ts:32`)
  from `GET /projects/{id}`. The **source of truth for edit affordances.**

### 4.2 API client + 401

`shared/api/client.ts` — `fetchJson`/`fetchBlob` send `credentials: "include"`
(cookie auth; no tokens in storage), throw `ApiRequestError` on non-2xx.
`isAuthFailure(err)` (`auth/lib.ts:3`) = `status === 401`. **There is no global
401 interceptor.** 401 handling is local: route guards redirect to sign-in;
table features map a 401 to a "version-locked / sign-in" banner.

### 4.3 Route guards — `frontend/src/app/router.tsx`

| Route | Guard | Anonymous? |
|---|---|---|
| `/sign-in` | none | ✅ public |
| `/`, `/dashboard`, `/catalog/*` | `RequireAuth` | ❌ → `/sign-in?next=` |
| `/projects/:projectId/:tab/*` | **none** (`ProjectShell`) | ✅ **viewer-readable** |

`RequireAuth` (`auth/routes/RequireAuth.tsx`) runs `useSessionQuery`; on a 401
it redirects to `/sign-in?next=<pathname>`. **Project pages are deliberately
*not* wrapped** — they load through `ProjectShell`, which tolerates anonymity.

### 4.4 The viewer centerpiece — `ProjectShell.tsx`

- Loads `useProjectQuery(projectId)` with no auth guard;
  `isViewer = projectData?.access_mode === "viewer"` (`ProjectShell.tsx:43`).
- **Viewers read the committed document, editors read their draft**
  (`ProjectShell.tsx:44-53`): editors call `useDraftSummaryQuery` (EDITOR
  route), viewers call `useProjectDocumentQuery` (VIEW route). → **Anonymous
  users never see in-progress drafts.** Clean, deliberate boundary.
- Topbar account slot (`ProjectShell.tsx:121-130`): if viewer → a
  `Read-only` chip + a `Sign in` link; else if session → account menu.

### 4.5 The `access_mode → canEdit` threading pattern

Each tab computes a local boolean from `access_mode` and passes it down. The
recurring formula in the *builder* surfaces is:

```ts
const isViewer = project.access_mode === "viewer";
const isLocked = project.active_version?.locked ?? false;
const canEdit  = !isViewer && !isLocked;     // viewer OR locked version ⇒ read-only
```

| Surface | Flag | Site |
|---|---|---|
| Status | `isEditor` | `project_status/routes/StatusTab.tsx:30` → `StatusItemRow` (drag/edit/delete/date all gated) |
| Envelope | `canEdit` | `envelope/routes/EnvelopePage.tsx:68-70` → workspace/materials/dialogs |
| Apertures | `canEdit` | `apertures/routes/AperturesTab.tsx:61-63` → sidebar/header/canvas/panels |
| Spaces/Rooms | `isEditor`→`canEdit` | `spaces/routes/SpaceTypesPage.tsx:99` → `useSliceTableController` |
| DataTable | `readOnly` | `shared/ui/data-table/DataTable.tsx` (insert/edit/fill/delete all gated) |

Note the dual meaning of read-only: **viewer** (no session) and **locked
version** (editor, but the version is immutable) both collapse to
`canEdit=false`. The UI distinguishes them only in the topbar (viewer gets the
"Read-only/Sign in" pill; a locked editor gets a banner from the table shell).

---

## 5. What a logged-out user can / cannot do TODAY

| Page | A viewer sees | Hidden / disabled |
|---|---|---|
| **Project list / dashboard** | nothing — route is `RequireAuth` | the entire list (must have a direct project link) |
| **Project status** | read-only status items | add / edit / delete / reorder / state-cycle |
| **Envelope (assemblies)** | read-only structure, materials, datasheets, drift badges | new assembly, import, all edit dialogs, status dropdowns, refresh-from-catalog, uploads |
| **Apertures** | read-only grid + properties, glazing/frame specs | add/rename/dup/delete aperture, edit dims, add/del rows-cols, uploads |
| **Spaces / Rooms** | read-only DataTable (sort/visibility still work) | insert/edit/delete rows, add columns, **saved table views** |
| **Model viewer** | full 3D view + model data | (read-only by nature) |
| **Assets** | list + can fetch signed download URLs ⚠ | upload / delete / attach / detach |
| **Catalogs (standalone)** | nothing — `RequireAuth` → sign-in | entire `/catalog/*` |
| **Topbar** | "Read-only" pill + "Sign in" link | account menu, project settings |

**Boundary that is working well:** viewers get *published* data, redacted
owner identity, no drafts, no project enumeration, and every write control is
hidden client-side *and* refused server-side.

---

## 6. Known rough edges & inconsistencies (verify during the UX pass)

Ordered roughly by how much they affect the read-only experience.

1. **No per-project membership (security C-2).** "Editor" = "any logged-in
   user." The read-only model must treat `access_mode` as the seam so that
   adding membership later is a backend-only change. **Do not** add UI that
   keys editing off `useSessionQuery` presence.
2. **Topbar conflates `viewer` with `anonymous`** (`ProjectShell.tsx:121`).
   A logged-in *non-member* (future state) viewing a project would be shown
   "Sign in" instead of their account menu. Latent; harmless today.
3. **Anonymous can fetch original-resolution asset bytes (security C-6).**
   `assets/{id}/url|download|bulk-urls` are VIEW and issue ≤1h signed R2 URLs.
   Whether the client/certifier read model *should* include raw downloads is a
   product decision, not just a security one — flag it for §7.
4. **Global catalogs are AUTH-ONLY (read included).** A viewer cannot call
   `/catalog/*` endpoints. Project-embedded catalog data reaches viewers
   through VIEW envelope/document endpoints (e.g. `material-catalog-drift`), so
   the envelope page itself should render — but **verify no viewer-rendered
   component eagerly fetches a `/catalog/*` list** and 401s. The standalone
   catalog pages are correctly sign-in-gated.
5. **Global climate datasets are AUTH-ONLY**, while per-project
   `climate/sources` and `location` are VIEW. Asymmetric but probably correct
   (the global picker is an editor tool). Note it so we don't "fix" it blindly.
6. **`table-views` GET is EDITOR-tier** — viewers never get saved column
   layouts/sort. If we want shareable saved views for clients/certifiers, this
   tier has to change.
7. **A few write handlers are defined unconditionally** (e.g. aperture
   add/rename/delete dispatchers, `AperturesTab.tsx:159-191`). The *buttons*
   are `canEdit`-gated so they're unreachable, and the backend refuses anyway,
   but the handlers themselves have no `if (!canEdit) return` guard. Minor
   defense-in-depth tidy.

None of 1–7 is a confirmed anonymous-write hole; the write boundary is intact.
They are the friction points a polished read-only experience will run into.

---

## 7. THE RULE — Editor/Viewer Access Guideline (v0.1)

A deliberately simple, followable rule set for all future work. Not perfect;
the goal is a default we can point at in PRs and only deviate from
consciously.

> **One-line rule:** *Reading a project is public-by-link and read-only;
> writing requires an editor session. The per-project `access_mode` is the one
> switch — gate on it, redact for it, and enforce it on the server.*

**R1 — Every endpoint and every UI affordance declares one tier.**
PUBLIC / VIEW / AUTH-ONLY / EDITOR / OWNER-ONLY (§2.6). New code states its
tier explicitly; "no tier" is not a valid state. Default for a new *read* is
VIEW only if it's safe for a client/certifier to see; otherwise AUTH-ONLY.
Default for any *write* is EDITOR.

**R2 — Anonymous = read ONE project, by link, published only.**
A viewer may read a single project's *committed* data via its direct URL. A
viewer may **not**: enumerate projects, see drafts, see another project,
see owner identity / private metadata, or perform any write.

**R3 — Gate on `access_mode`, never on "is there a session."**
Editor affordances (backend and frontend) key off the per-project signal
(`ProjectAccess.is_editor` / `project.access_mode === "editor"`), not off the
mere presence of a cookie or `useSessionQuery`. This keeps per-project
membership a backend-only change later.

**R4 — Published, not draft.** Drafts and draft-only endpoints are EDITOR-tier.
Viewers see the committed version. (Already true; keep it true.)

**R5 — The server is the boundary; the client is the courtesy.**
Frontend `canEdit` gating is UX — it must never be the only thing stopping a
write. Every EDITOR endpoint enforces independently. Corollary: **never show
an enabled write control to a viewer**, and never rely on hiding it for safety.

**R6 — VIEW responses are redacted by default.**
A VIEW payload strips anything not meant for a client/certifier: owner
identity, internal/private metadata, anything licensed (PHPP/WUFI-derived
specifics — this repo is public; see the project memory). When in doubt, omit
and make the editor view add it back. (Pattern exists: `owner_display_name`,
location private fields.)

**R7 — Binary assets inherit the project's read tier, but the *mechanism* is a
separate decision.** Today VIEW issues 1h signed URLs to anyone. Before the
public read-only launch, decide explicitly (with §6.3): keep anonymous
download, shorten TTL + cap batch, gate behind a per-asset "shareable" flag, or
require login for raw bytes. Don't let the current default become the decision.

**R8 — Global/shared data is AUTH-ONLY until proven otherwise.**
Catalogs and global climate datasets require a session. If a viewer-facing
surface needs catalog-derived data, serve it *through a project VIEW endpoint*
(server-side joined + redacted), not by exposing the global catalog to
anonymous callers.

**R9 — Distinguish the two read-only causes.** `canEdit=false` means *either*
"viewer (no/insufficient access)" *or* "editor, but this version is locked."
Surface them differently (the viewer needs a sign-in path; the locked editor
needs a "make a draft / open active version" path). Don't merge their messaging.

---

## 8. Open questions to settle before designing the read-only UX

These are the product decisions that turn this baseline into a plan. (For the
follow-on discussion Ed flagged — *what* read-only access we actually want.)

1. **Who is a viewer, exactly?** Pure anonymous-by-link for both client and
   certifier? Or do certifiers eventually get accounts with scoped, non-editor
   per-project access (which would activate the R3 separation for real)?
2. **Link sharing model.** Is the project UUID-in-URL the share token (current
   reality), or do we want signed/expiring share links, per-link scopes, or a
   per-project "public read" on/off switch?
3. **What's in the client/certifier read view?** Which tabs/sections are
   appropriate for a home-owner vs a certifier? (e.g. raw asset downloads,
   PHPP/HBJSON exports, diff view, model viewer.) This drives R6/R7 redaction.
4. **Should viewers get saved table views / shareable layouts?** (Changes the
   `table-views` tier — §6.6.)
5. **Asset download policy** (R7) — the one item with both a product and a
   security dimension; needs an explicit call.
6. **Viewer chrome & wayfinding.** What does a viewer *see* about the fact that
   they're read-only, who owns the project, how to request edit access, and how
   to sign in — beyond today's single "Read-only / Sign in" pill?

---

## Appendix — canonical pointers

- Backend seam: `backend/features/projects/access.py`
- Session: `backend/features/auth/service.py:182` (`current_user_from_request`)
- `CurrentUser`: `backend/features/auth/routes.py:30`
- DB CMs: `backend/database.py:69` / `:86`
- `access_mode` computed: `backend/features/projects/routes.py:115` +
  `service.py:419-445`
- Frontend viewer centerpiece: `frontend/src/features/projects/routes/ProjectShell.tsx:43`
- `access_mode` type: `frontend/src/features/projects/types.ts:32`
- Route guards: `frontend/src/app/router.tsx`
- AuthZ gaps (cross-ref): 2026-06-07 security review, findings C-2..C-6
</content>
</invoke>
