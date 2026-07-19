---
DATE: 2026-05-11
STATUS: Split from context/USER_STORIES.md; canonical story body.
SOURCE: context/USER_STORIES.md
---

# PH-Navigator V2 — User Stories: Settings, Operations, LLM API

## US-Settings — Project settings modal (US-3.7)

**Status:** Draft · **Priority:** MVP
**PRD ref:** §6.1 (`projects` table), §11.1 (project tabs +
header `⋯` menu placement), §4 (access model — updated
2026-05-10)
**V1 ref:** V1 has no equivalent; project metadata was edited
in AirTable
**Inherits:** US-3 / US-3.1 for the project header `⋯` menu
placement

### Story

> As an editor, I want a single Project Settings modal where
> I can edit the project's identifying metadata (name,
> BT number, Phius certification number, Dropbox link) and
> see at a glance who owns this project and when it was
> created / last saved — so I don't have to dig through
> AirTable or admin tools to keep a project's record clean.

### Architectural decisions (2026-05-10)

- **Modal, not a tab.** Settings opens as a shadcn `Dialog`
  triggered from the project header `⋯ → Project settings`
  menu item (per PRD §11.1 — no top-level Settings tab).
- **Scope = project-level metadata only.** Editing fields on
  the `projects` relational row. **Not** included in this
  modal:
  - **Version-level concerns** (Save / Save As / Lock /
    Unlock / Discard) — live in the version dropdown
    (US-3.1) and elsewhere in the `⋯` menu.
  - **Project delete** — **dashboard only** (US-1.4) per
    Q-SET-3 resolved 2026-05-10. Not in this modal.
    Rationale: deletion is rare, high-stakes, and naturally
    pairs with the dashboard's project-list context where
    you can see your remaining projects.
  - **public link management** — does not exist as a concept
    after the 2026-05-10 PRD §4 update. Project URLs are
    public-readable; to "revoke access" the project is
    soft-deleted (US-1.4). No share-link surface in V2 v1.
  - **MCP token management** — included in V2 v1 per
    Q-SET-5 revised 2026-05-11. Tokens are project-scoped,
    read/write capable, and issued/revoked from this modal.
- **Edits bypass the draft buffer.** Project-level metadata
  is relational (not document-versioned), so saves are
  direct PATCH calls to `/api/v1/projects/{id}`. No
  JSON-Patch through the version draft.

### Acceptance criteria

1. **Trigger.** Project header `⋯` overflow menu →
   **"Project settings"**. Opens a shadcn `Dialog`. Modal
   width ~480px; vertical scroll within if content
   overflows.

2. **Modal title:** `"Project settings"` (small subtitle
   below: the project's display name, e.g.
   *"Brooklyn Retrofit · BT-2024-013"* — for orientation).

3. **Editable fields** (per Q-SET-1 resolved):
   | Field | Type | Validation | Notes |
   |---|---|---|---|
   | `name` | text | required; trim whitespace; max 200 chars | Pure cosmetic — see Q-SET-6 (display-only) |
   | `bt_number` | text | required; **UNIQUE across all projects** (Q-CREATE-2) | Editable post-create (Q-SET-2 resolved); rare but real (typo correction, internal renumbering) |
   | `phius_number` | text | optional; max 100 chars | E.g. `PHIUS-2024-0445`. Empty = not yet registered |
   | `phius_dropbox_url` | URL | optional; must be a valid URL starting with `http(s)://` if non-empty | Link to the project's Dropbox certification folder |

4. **Read-only fields** displayed below the editable block:
   | Field | Source |
   |---|---|
   | Owner | `projects.owner_id` → user name. Read-only in v1 (transfer UI is post-MVP per Q-OWN-2 resolved) |
   | Created | `projects.created_at` (formatted date + creator's name) |
   | Last saved | `projects.last_saved_at` (denormalized per Q-DASH-2 resolved) |
   | Project ID | `projects.id` UUID — small monospace; click-to-copy icon for sharing in tickets / debugging |

5. **`bt_number` uniqueness check** (Q-SET-2 + Q-CREATE-2
   resolved):
   - On Save, backend validates the new value doesn't
     collide with another project's `bt_number` (excluding
     soft-deleted projects — per US-1.4 notes, soft-deleted
     bt_numbers are retained permanently and **never
     reused**).
   - Collision → 409 response → modal shows inline error
     on the field: *"BT number is already in use by
     another project."* Save button stays disabled until
     the user corrects.
   - **Self-collision is fine** (saving the modal without
     changing `bt_number` doesn't trigger a collision
     check against the same project's own row).

6. **Field-level validation runs on blur AND on Save.**
   Errors render inline (red border + error icon +
   tooltip). Save button disabled while any field is in
   error state.

7. **Save / Cancel** at modal footer (per Q-SET-7
   resolved):
   - **Save button** — disabled when no fields have
     changed from the loaded state, or when any field is
     in error.
   - On Save: single `PATCH /api/v1/projects/{id}` with
     only the changed fields. Closes modal on success;
     toast: *"Project settings saved."*
   - On Save failure (other than 409 uniqueness): toast
     with the backend error; modal stays open with edits
     preserved.
   - **Cancel** discards in-modal edits; closes modal.
     If the modal has dirty edits, a small inline-warning
     prompt before close: *"You have unsaved changes.
     Discard?"* with Cancel / Discard buttons.

8. **Renaming has no other effects** (per Q-SET-6
   resolved):
   - URLs use `{project_id}` UUID, not name — renaming
     doesn't change any URL.
   - HBJSON downloads use the **new** `bt_number` +
     `name` in the filename pattern per Q-ENV-12.4 (the
     slugified filename pattern reads from the current
     project record at download time).
   - Dashboard refreshes show the new name on next load.
   - **No cascade rename of derived artifacts** — old
     downloaded HBJSON / JSON files on the user's disk
     keep their original filenames.

9. **MCP token management — V2 v1**
   (Q-SET-5 revised 2026-05-11). Render a compact
   **MCP tokens** section below project metadata:
   - Existing active tokens list: label, token prefix,
     scopes, created date, last used date, optional expiry,
     and **Revoke** button.
   - **Create token** action opens an inline form:
     token label, scopes (`project:read`, `project:write`,
     `asset:read`, `asset:write`), optional expiry.
     Default scopes: all four v1 scopes.
   - Created token plaintext is shown exactly once in a
     copy field; after the dialog closes, only prefix/hash
     remain server-side.
   - Tokens are project-scoped. They can read/write only this
     project, never all projects.
   - Revocation blocks the next MCP request with a structured auth
     error. A request already past auth may complete atomically, but
     any follow-up commit step must re-check token state (see
     US-Concurrency).
   - Issue/revoke actions write `mcp_token_issue` /
     `mcp_token_revoke` events to `user_action_log`.

10. **Project delete — NOT in this modal** (per Q-SET-3
    resolved). The dashboard's per-row `⋯` menu is the
    sole entry point (US-1.4). The Settings modal has
    **no "Danger zone"** section in V2 v1.

11. **Viewer permissions:**
    - **Modal trigger hidden in the project header `⋯` menu**
      for Viewers. They can't open Settings.
    - If someone manually constructs a settings-modal-open
      URL fragment (edge case), the modal renders **read-only**:
      all editable fields display as plain text; Save button
      hidden; Cancel becomes Close.

12. **Locked-version handling: N/A.** Project settings are
    relational (on the `projects` row), not bound to any
    project document version. Switching the active version
    or locking it has no effect on this modal — same
    settings visible regardless. (Sibling pattern with
    `project_status_items` per US-Status criterion 14 and
    `project_hbjson_files` per US-VIEW-1 architectural
    decision 2.)

13. **MCP-callable** (per NEW-LLM-API-1):
    - `GET /api/v1/projects/{id}` — returns the project
      record (editors + Viewers).
    - `PATCH /api/v1/projects/{id}` — partial update
      (editors only). Same endpoint that powers the
      modal's Save action.
    - Agentic workflow can update project metadata
      ("rename this project to 'Final Approved Round 4'")
      without opening the UI.

### Resolved questions (2026-05-10)

- **Q-SET-1: What's editable in the modal?** Resolved:
  `name`, `bt_number`, `phius_number`, `phius_dropbox_url`.
  Owner stays read-only in v1 (transfer UI is post-MVP per
  Q-OWN-2).
- **Q-SET-2: Is `bt_number` editable post-create?**
  Resolved: yes, editable subject to uniqueness check.
  Q-CREATE-2's "never reused" applies to soft-deleted
  projects' freed bt_numbers, not the owning project's
  own renames.
- **Q-SET-3: Where does project delete live?** Resolved
  (redirect from lean): **dashboard only** (US-1.4). Not
  in the Settings modal. Rationale: rare, high-stakes
  action; pairs naturally with the dashboard's
  project-list context.
- **Q-SET-4: public link management?** Resolved
  (moot 2026-05-10): no public link management surface
  exists because public links don't exist as a concept
  after the PRD §4 access-model update. To revoke
  access, soft-delete the project (US-1.4).
- **Q-SET-5: MCP token management?** Revised 2026-05-11:
  include in V2 v1. MCP is read/write capable from day 1,
  so Project Settings issues/lists/revokes project-scoped
  bearer tokens.
- **Q-SET-6: Rename side-effects?** Resolved: none.
  Rename is display-only. URLs use UUID; old downloaded
  files keep their original names.
- **Q-SET-7: Save flow — explicit Save or auto-save?**
  Resolved: explicit Save / Cancel. Edits bypass the
  draft buffer (relational, not document-versioned);
  single `PATCH` on Save.

### Open questions
None outstanding.

### Cross-references

- **PRD §6.1** — `projects` table schema; the fields this
  modal edits live there.
- **PRD §11.1** — `⋯` menu placement; "no top-level
  Settings tab" framing.
- **PRD §4 (updated 2026-05-10)** — access model; gates
  who can open the modal vs view it read-only.
- **US-3.1 (version dropdown)** — handles version-level
  concerns the Settings modal doesn't touch (Save / Save
  As / Lock).
- **US-1.4 (project delete)** — sole entry point for
  deletion; intentionally not duplicated here.
- **US-1.3 / Q-CREATE-2** — `bt_number` uniqueness rules
  (UNIQUE, never reused after soft-delete).
- **Q-OWN-2** — ownership transfer UI is post-MVP;
  modal renders Owner as read-only.
- **NEW-LLM-API-1** — MCP-callable PATCH endpoint
  (criterion 13).

---

### C-1 — Per-user action logging

**Status:** Draft  
**Priority:** MVP  
**PRD ref:** new — needs to be added to §6.1 and §15

> As BLDGTYP support / admin, I want a per-user action log so that I
> can troubleshoot issues, answer "who changed what when" questions,
> and audit access.

#### What we log (v1 scope)
| Event | When | Metadata |
|---|---|---|
| `login` | successful sign-in | IP, user-agent |
| `login_failed` | failed sign-in | email attempted, IP, user-agent |
| `sign_out` | explicit logout | — |
| `project_create` | new project | project_id, name |
| `project_update_metadata` | rename, change client, etc. | project_id, fields changed |
| `project_delete` | soft-delete | project_id, name |
| `version_create` | Save As | project_id, version_id, name, kind |
| `version_save` | Save (overwrite) | project_id, version_id |
| `version_lock_toggle` | lock / unlock | project_id, version_id, new state |
| `version_delete` | soft-delete | project_id, version_id |
| `hbjson_upload` | new HBJSON file | project_id, file_id, size |
| `hbjson_delete` | soft-delete HBJSON | project_id, file_id |
| `catalog_record_create` / `_update` / `_version_create` / `_delete` | catalog edits | catalog_table, record_id, version_id |
| `mcp_token_issue` / `_revoke` | MCP auth admin | token_id |

Out of scope for v1: every read, every JSON-Patch op on a draft. Too
noisy. If we need draft-level forensics later, draft patches already
write to `project_version_drafts.last_patched_at`.

#### Storage
New table `user_action_log`:
```sql
user_action_log (
    id           BIGSERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id),
                 -- nullable: failed login attempts before user lookup
    action       TEXT NOT NULL,
    project_id   UUID REFERENCES projects(id),
    target_type  TEXT,
    target_id    TEXT,
    metadata     JSONB,
    ip_address   INET,
    user_agent   TEXT,
    at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON user_action_log (user_id, at DESC);
CREATE INDEX ON user_action_log (project_id, at DESC);
CREATE INDEX ON user_action_log (action, at DESC);
```

#### Surfacing
- v1 ships with **no UI surface** for the log; it's queried via SQL by
  Ed for support purposes.
- v1.1 may add a per-project "activity" tab.
- **Open question:** retention policy — keep forever? Roll off after
  N months? **Lean:** keep forever; volume is trivial at two-user
  scale.

---

### C-2 — Header consistency

**Status:** Draft  
**Priority:** MVP  
**PRD ref:** §11.1 (top-level surfaces)

Every page in the signed-in app shares a top header:

| Region | Content | Behavior |
|---|---|---|
| Far left | PH-Nav logo (text + minimal mark) | Click → `/dashboard` |
| Center / left | Breadcrumb / context (e.g. "Project Foo › Status") | Each crumb is a link |
| Center / right | "Catalogs ▾" dropdown | Reveals catalog list (US-2) |
| Far right | User name + avatar, click → menu (Sign out, Settings) | Menu opens on click |

The header is **not present** on `/sign-in`. For Viewers on a
project URL, the header is **present but reduced** —
no "Catalogs ▾" dropdown, no user-avatar menu (replaced with a
"Sign in" link). All edit affordances under the header hide; reads
remain available. Per the access model in PRD §4 updated
2026-05-10.

---

## New features (post feature-parity)

This section captures **net-new** features Ed has flagged during
V2 user-story review. They are **NOT in the V1→V2 parity scope**
and are tracked here so they don't get mixed into US-WIN / US-ENV
parity stories. Each gets a full story write-up once we close the
parity backlog and decide priority.

### NEW-DATASHEET-1 — Bulk + individual datasheet download

**Status:** Stub (post-parity) · **Priority:** Tied to PH
certification submission workflow
**Source:** Ed feedback 2026-05-10 (Q-ENV-2.1 resolution thread)

**Story.** As a CPHC packaging up a Phius/PHI certification
submission, I want to download **all** of a project's product
datasheets in one click (zipped, conventionally named so the
certifier can pair them with the materials list), and I also
want to download individual datasheets when only one or two need
re-submission.

**Why this matters.** Certification submissions today involve
manually pulling each datasheet from Dropbox / AirTable / email
and renaming it for the certifier's tree. This is a top
time-sink and a common source of mismatches between the model's
material list and the submitted documents. Centralizing it on
the project's `project_materials[]` table (the source of truth
per Q-ENV-2) lets us guarantee 1:1 coverage.

**Open design questions (queued, not blocking V2 v1 parity):**
- File-naming convention in the bulk zip: by `project_material.name`
  (`XPS Foam.pdf`) or by name + spec-status (`XPS Foam [submitted].pdf`)?
- Include unused materials? Probably yes — submitted-but-not-used
  is still a QA record.
- Per-version download or only HEAD? Lean: per-version (mirrors
  HBJSON / window-construction export under header `⋯` menu).
- One PDF binder vs zip of individual PDFs? Lean: zip; PDF binder
  as v1.1+.
- Surface in: Materials sub-tab toolbar (bulk button) AND
  project header `⋯` menu (per Q-ENV-11 pattern). Per-row "↓"
  button on each material card for individual download.

**Cross-references.** Implies stable asset IDs and signed download URLs
through `project_assets`. Couples with NEW-LLM-API-1 (LLM-friendly
asset endpoints).

### NEW-LLM-API-1 — LLM-friendly read/write MCP + asset API

**Status:** V2 v1 scope (cross-cutting — not envelope-only)
· **Priority:** MVP infrastructure
**Source:** Ed feedback 2026-05-10; day-1 read/write decision
confirmed 2026-05-11.

**Story.** As an LLM agent assisting a CPHC, I need authenticated,
project-scoped **read/write** access to PH-Navigator from day 1: fetch
documents, apply JSON-Patch edits to drafts, save/save-as, upload
datasheet PDFs or batches, attach assets to the right project-document
paths, and download existing assets for review / re-upload.

**Why this matters.** Datasheet ingest is the highest-volume
manual workflow on a project. An LLM that can:
1. Read an uploaded email attachment,
2. Match it to the right `project_material` (by product name),
3. Upload it via API,
4. Update spec-status to `submitted`,

…would compress what is currently a 5-minute manual click-fest
per product into a single agent call. This is the kind of leverage
PHN-V2 is meant to enable, so the API design has to support it
from day one — not retrofit it later.

**Design constraints (capture early so V2 v1 endpoints don't
paint us into a corner):**
- **One asset backbone.** All uploaded files are `project_assets`
  rows (PRD §6.5). Datasheets, photos, HBJSON, future simulation
  files, and export bundles share signed upload/download, dedup,
  soft-delete, and GC behavior.
- **Stable asset IDs plus explicit kind.** Tool calls reference stable
  `asset_id` values; agents determine meaning from `asset_kind`, not
  from an overloaded id prefix.
- **Consistent endpoint shape across asset types.**
  `POST /projects/{id}/assets/upload-intent` returns `asset_id` +
  signed PUT URL; `POST /projects/{id}/assets/{asset_id}/complete-upload`
  marks upload complete; `GET /projects/{id}/assets/{asset_id}/url`
  returns a signed download URL. The same shape covers datasheet,
  site photo, and HBJSON bytes.
- **Clear MIME / type discrimination.** `asset_kind` enum
  (`datasheet | site_photo | hbjson | …`) so an agent inspecting
  a project's assets can filter without guessing.
- **Idempotent uploads** — agents retry; we should not get duplicate
  active rows on retry. Match by
  `(project_id, asset_kind, content_hash_sha256)` and return
  `duplicate_of` metadata when appropriate.
- **Bulk endpoints.** `POST /projects/{id}/assets/bulk` for batch
  uploads; `GET /projects/{id}/assets?kind=datasheet` for batch
  reads. Avoids N round-trips for an agent doing 30 datasheets.
- **Attach/detach through drafts.** `attach_asset` and `detach_asset`
  are convenience wrappers over draft JSON-Patch. Removing an asset
  from a material/photo UI detaches the reference from the active draft;
  hard purge waits for GC after saved-version and active-draft reference
  checks.
- **OpenAPI spec served at `/api/v1/openapi.json`** (FastAPI gives
  us this for free) — let any LLM tool (Claude / Anthropic API tool
  use, OpenAI function-calling, etc.) auto-discover the endpoints
  without bespoke docs.
- **Project-scoped bearer tokens** issued from Project Settings.
  Tokens are shown once, stored hashed, revocable, audit-logged,
  and scoped to one project. v1 scopes:
  `project:read`, `project:write`, `asset:read`, `asset:write`.
- **MCP is never anonymous.** Public browser read access to
  `/projects/{id}/...` does not grant unauthenticated tool access.
- **Tool surface wraps the same REST/service layer.** No separate
  LLM-only business rules. MCP tools call the same validation,
  access checks, JSON-Patch, idempotency, and audit paths as the
  web UI.
- **Write path goes through drafts.** LLM JSON-Patch edits target
  the token owner's draft; `save_draft` explicitly flushes to the
  version body. Save against locked/stale versions returns the
  same structured 409s as the web UI.
- **MCP/browser concurrency follows US-Concurrency.** MCP mutating
  tools freeze browser write controls through a short edit lease;
  token revocation blocks the next request and all follow-up commit
  steps after revocation.
- **Typed table query contract.** `query_table` accepts a constrained
  typed query object, not SQL, JSONPath, Python, or free expression
  text. The object supports optional substring `query`, `and` / `or`
  groups, simple field comparisons, allow-listed operators, sort,
  offset, and server-capped `limit`. Fields and operators are validated
  against the table schema before execution. Results return compact row
  summaries plus stable row targets for follow-up calls.
- **Minimal MCP error UX contract.** MCP errors share the REST
  structured-error baseline, but v1 does not predefine the exhaustive
  taxonomy in planning. Before the first MCP write tool ships, errors
  must include at least `code`, `message`, `request_id`, and coarse
  `recoverability`. Tool-specific `details`, `next_action`, and final
  code names are defined while implementing each route/tool. On MCP
  failure, the browser releases any MCP edit lease, preserves local
  edits, does not silently apply failed/partial MCP state, and surfaces
  a concise banner/toast with request id when the open draft/project was
  affected.

**Resolved design decisions (2026-05-11/12):**
- Bearer tokens live in `mcp_tokens` (PRD §6.1).
- v1 tokens are per-user and per-project. The issuing editor owns
  the token; every write is attributed to that user.
- Project Settings is the v1 token UI: issue, list, revoke.
- MCP tools are read/write capable in v1, but catalog writes are
  excluded. Catalog browse is read-only through MCP until a concrete
  global-library edit workflow and review policy exist.
- LLM-callable write endpoints are wrappers around human-driven
  endpoints/services, not a separate business surface.
- **2026-05-12:** `query_table` uses the PRD §10.3 typed query object.
  This follows the Ladybug Tools MCP precedent of typed search
  parameters, simple substring search, reusable targets, and strict
  validation rather than arbitrary query-language strings.
- **2026-05-12:** MCP error UX is a minimal baseline now, not a fully
  enumerated taxonomy. Establish the shared envelope and browser failure
  behavior before the first MCP write tool; fill route-specific details
  during implementation.

**Cross-references.** NEW-DATASHEET-1 (bulk download) and
NEW-DATASHEET-1's per-row download both ride on this API. Future
agentic features (auto-extract spec values from datasheet PDFs,
auto-match products from email attachments) are blocked on this.

---
