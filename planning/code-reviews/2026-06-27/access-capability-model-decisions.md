---
DATE: 2026-06-27
TIME: 15:10 ET
STATUS: DECISIONS LEDGER — page-by-page access classification against the full
        role matrix. **Page walkthrough COMPLETE (all 12 surfaces, 2026-06-27).**
        **GRADUATED** to `planning/refactor/access-capability-model/` (README /
        PRD / decisions / PLAN / STATUS), where the schema was finalized
        (fine-grained `user_grants`) and a 5-phase build plan written. This ledger
        remains the **authoritative per-surface exposure record** the refactor
        references; forward-looking contract + plan live in the refactor folder.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: Defines (1) the access principals + capability taxonomy, (2) a
        provisional additive/nullable schema scaffold to reserve now, and
        (3) per-page exposure/gate decisions. Companion to the current-state
        review.
RELATED:
  - planning/code-reviews/2026-06-27/editor-vs-viewer-access-model-review.md  (current state)
  - planning/features_v2.0/multi-tenant-teams/PRD.md  (the future role/team model this reserves for)
  - backend/features/projects/access.py  (the single seam all of this flows through)
---

# Access Capability Model — Page-by-Page Decisions + Reserved Schema

> Decisions: **full v2.0 role matrix** classification (not just binary), and
> **reserve schema now** (additive/nullable, applied at end of walkthrough).
> See the sequencing note in §0.

## 0. How we're doing this

1. **Now:** define principals + capability taxonomy (§1, §2).
2. **Walkthrough:** classify every page/affordance against the matrix (§4),
   discovering the real capability list as we go. Each page ends with explicit
   decisions for Ed.
3. **End:** finalize the reserved schema scaffold (§3) from the *discovered*
   capability set — strictly additive, nullable, behavior-preserving (defaults
   reproduce today's "any session = editor, anonymous = viewer").

Legend for the per-page tables — each cell is the **intended** access, even
where beta implements it as binary:
- **R** = read/visible · **W** = write/act · **—** = no access · **(redact)** =
  visible but stripped fields · **?** = open decision.

---

## 0.1 The decided model at a glance

- **Two viewer principals, both read-only, both scoped to ONE project by link
  (no dashboard, no catalogs — CP-8):**
  - **`client`** (home-owner / public): most-redacted. Sees status, climate
    (city/state/coords, **no street line**), apertures/envelope/spaces/equipment/
    thermal-bridges/model **read-only**, **latest committed version only — no
    version UI**, may **view + download attachments**, may **not** download bulk
    exports.
  - **`certifier`**: everything `client` sees **plus** street address, client
    name, `phius_dropbox_url`, **version history + switch + diff**, and **bulk
    exports/downloads** (CSV/HBJSON/PHPP/Phius/model). **Never writes.** (CP-2)
- **Everything that mutates the document/backend is `member`+ (CP-6).** View
  controls (pan/zoom/sort/columns — CP-1), click-to-inspect modals (CP-5), and
  the IP/SI toggle (CP-9) are available to everyone.
- **Editor ladder:** `member` (own projects) → `admin` (whole team) → `staff`
  (bldgtyp cross-tenant); plus a grantable **catalog-admin** capability and
  **owner/admin (T2)** for project management (rename/delete/metadata/MCP tokens).
- **Beta reality:** no certifier mechanism or teams yet → every viewer is a
  `client`; every editor is a `member`. The certifier/admin/staff/catalog-admin
  distinctions are *recorded and schema-reserved* (§3), not yet enforced.

## 1. Principals (matrix columns)

| Key | Principal | Today | v2.0 | Notes |
|---|---|---|---|---|
| `client` | **Client / public viewer** | live ("viewer") | unchanged | plain by-link viewer (home-owner / public). Most redacted. |
| `certifier` | **Certifier viewer** | — (no mechanism yet) | enhanced viewer | **read-only like `client` but with MORE read scope** (e.g. street address). Still **no write**. Needs an identifying mechanism — a per-project certifier share/role (reserved-schema item). |
| `member` | **Member / editor** | live ("editor" = any session) | project owner or scoped member (junior engineer) | the live "editor" today |
| `admin` | **Team admin** | — (no teams) | firm-wide visibility + member/seat mgmt (senior/manager) | T2 |
| `staff` | **Platform / bldgtyp staff** | — | cross-tenant consult/support | T3; design deliberately, not an accidental super-user |
| `token` | **API / MCP token** | MCP live, per-project | + downstream API (Rhino/GH/Honeybee-PH) | acts *as* a principal; **never widens** beyond issuer's grants; same seam |

**Persona split is REAL (decided on Climate):** `client` and `certifier` are
distinct viewer principals with different *read* scopes (certifier sees the
street address; client does not). Both are strictly read-only. **Beta has no
certifier mechanism**, so today every viewer = `client` (most-redacted);
certifier's extra read scope is a future capability gated on the certifier
principal existing. This is a primary reason the reserved schema must carry a
per-project share/role notion.

## 2. Capability taxonomy (grows during the walkthrough)

Capabilities are the stable thing the UI and seam gate on. A role is just a
named bundle of capabilities. Starter set (refined per page):

- **Project shell:** `project.view`, `project.manage` (rename/bt-number/settings),
  `project.create`, `project.delete`/`restore`
- **Document/versions:** `document.view`, `document.edit` (draft writes),
  `version.commit`, `version.manage`
- **Per tab:** `status.*`, `climate.*`, `apertures.*`, `envelope.*`, `spaces.*`,
  `equipment.*`, `thermalbridges.*`, `model.*`
- **Assets:** `assets.view`, `assets.download`, `assets.manage`
- **Table views:** `tableviews.use` (load/save personal layouts)
- **Admin/team (v2.0):** `members.manage`, `team.manage`, `seats.manage`
- **Tokens:** `tokens.mcp.manage`, `tokens.api.manage`
- **Global catalogs:** `catalog.view`, `catalog.edit`

## 2.1 Cross-cutting principles (discovered during the walkthrough)

- **CP-1 · Client-state view controls are always available to viewers.**
  Session-local *view* state — canvas pan/zoom, interior/exterior view
  direction, table sort, column visibility — is frontend-only (Zustand /
  `useState`), never a backend write, so it is available to every principal
  including `client`. Only operations that **mutate the document or backend**
  are gated. *Verified:* aperture `canvasZoom` (`apertures/store/builder-store.ts`)
  + `viewDirection` (`useState`); envelope `useEnvelopeCanvasZoom`. **Rule:**
  never gate a pure view control on `canEdit`.
- **CP-2 · `certifier` ⊇ `client`.** The certifier is consistently "client +
  extra technical/review reads" (street address, HBJSON export), never a writer.
  Capabilities should be additive from `client` → `certifier` → `member`.
- **CP-3 · Catalog/QA internals are editor-only.** Catalog-drift badges and
  similar "differs from the catalog" QA signals are meaningless/confusing to
  viewers; they stay T1 (hidden from `client` AND `certifier`).
- **CP-4 · Frontend gate ⊇ backend gate must hold both ways.** Where the UI is
  *more* restrictive than the API (e.g. HBJSON export), close the API gap too so
  a viewer can't reach via direct request what the UI hides.
- **CP-5 · Inspection is a read-only view, editing is the gate.** Clicking a
  canvas element / row to **open its detail** (material, dimensions, specs) is a
  *view* affordance available to all viewers; only the *mutation* controls inside
  that detail are gated. So detail/inspect modals need a read-only variant — the
  click-to-open must NOT be gated on `canEdit`. Applies to the aperture AND
  envelope SVG canvases. **Build item:** verify the current canvas doesn't gate
  the inspection click on `canEdit`; add the read-only modal variant if it does.
- **CP-6 · The DataTable rule (governs every DataTable, unless a table is
  flagged as an exception).** On any DataTable, `client` and `certifier` may
  **VIEW all rows + columns** (with sort / column-visibility per CP-1 and
  row/cell inspect per CP-5) and may **VIEW attachments** (datasheets), but may
  **SET nothing**: no add/edit/delete rows or cells, no creating/editing **links**
  (cross-table relationships), no add/edit/delete **attachments**. Only `member`+
  mutate. **Table-views** (saved column/sort presets) are editor-personal; every
  viewer gets the **default layout** in beta. *Deferred (maybe someday):*
  `tableviews.shared` — an editor-curated client-facing layout. Reserved as a
  named future capability, **not built for MVP**. *(A DataTable's **download
  CSV** is an export → `certifier`+ per CP-7, NOT available to `client`.)*
- **CP-7 · Bulk exports are `certifier`+; individual attachments are open to all
  viewers.**
  - **Bulk data exports** of the project's structured data — table **CSV**
    downloads, **HBJSON**, **PHPP**, the heat-pump **Phius** export, the raw model
    **.hbjson** — are `certifier`/`member`+ only; **`client`/anon may not
    download.** Close backend VIEW gaps on export routes (CP-4); in beta (no
    certifier mechanism) these collapse to editor-only.
  - **Individual attachment files** — manufacturer datasheets, TB detail
    drawings, and any row/cell attachment on a DataTable — are **view +
    download for ALL viewers** (`client` + `certifier`). *(Ed, 2026-06-27: the
    view-vs-download split was a meaningless soft gate since both resolve the
    same signed URL, so attachments are simply open.)*
  - The **general** raw-asset/document download policy (security-review C-6 —
    should anonymous callers receive signed URLs at all) is still settled on the
    Assets/chrome page (§4.9); this CP-7 attachment ruling covers **DataTable /
    spec attachments** specifically.
- **CP-8 · Viewer scope is a single project (version-scope TBD).** A `client` /
  `certifier` reaches **only the one project** in their link. They have **no
  access to the dashboard / project list** and **no access to the global
  catalogs** (both stay AUTH-ONLY — matches today). The link is the entire scope.
  **Version-scope (resolved 2026-06-27):** persona-split — `client` sees the
  **latest committed version, auto-following, with NO version UI** (no list,
  switch, or diff); `certifier` sees **full version history + switch + diff**;
  `member`+ additionally get drafts/save/rename. Prerequisite: version-name
  hygiene, but only toward the certifier (professional audience); the client
  never sees version names.
- **CP-9 · IP/SI unit toggle is available to every principal.** Verified
  client-side: the toggle renders unconditionally (`WorkspaceTopbar`), conversion
  is client-side display formatting, and for anon it persists to `localStorage`
  and skips the backend (no 401). Logged-in users additionally round-trip to
  `/auth/preferences` for cross-device persistence. **No change needed for
  viewers.**

## 3. Reserved schema scaffold (PROVISIONAL — finalized in step 3)

Goal: make the future role model a *fill-in*, not a *migration of meaning*.
Everything additive + nullable; **defaults reproduce today's behavior** so the
seam's logic is unchanged until we choose to consult these.

Hardened by the walkthrough — three buckets. **§3 still gets a dedicated
finalization pass** (Ed chose "reserve schema too"); this is the shape, not the
final DDL.

**(a) Tenancy / roles** — `member`/`admin`/`staff` + project scoping (§4.10):
- `teams (id, name, membership_status, seat_limit, membership_expires_at, deleted_at, audit…)`.
- `team_members (team_id, user_id, role, joined_at)` — `role ∈ {admin, member}`.
- `projects.team_id UUID NULL` — owning firm; null = legacy/bldgtyp-internal.
- `users.is_staff BOOLEAN NOT NULL DEFAULT false` — platform/staff (T3).

**(b) Per-user capability grants** — NEW, driven by the **catalog-admin** decision
(§4.11): catalog write is a grant "turned on for specific members," independent
of the role ladder. This is the first concrete per-user grant, so it forces a
choice:
- *Option 1 (cheap):* per-capability booleans on `users` — e.g.
  `users.can_edit_catalog BOOLEAN DEFAULT false`. Fine while grants are few.
- *Option 2 (extensible):* a `user_grants (user_id, capability, scope…)` table —
  future-proof for the "fine-grained permissions eventually" goal, more moving
  parts now.
- **Lean:** start with the boolean (`can_edit_catalog`) for beta — it also closes
  security-review C-4 — and migrate to a grants table only when a 2nd/3rd
  per-user grant appears. Decide at the §3 finalization.

**(c) Viewer shares (certifier vs client + version-scope)** — NEW, driven by the
`certifier` principal (§1) and the version split (§4.9). To distinguish a
`certifier` link from a `client` link and to carry the version-scope, reserve:
- `project_shares (id, project_id, audience ∈ {client, certifier}, version_scope ∈ {latest, pinned}, pinned_version_id NULL, token_hash, expires_at NULL, created_by, created_at, revoked_at NULL)`.
- Beta can ship with **no shares table** (all anon = `client`, latest-version,
  most-redacted); the certifier audience + pinned scope land when certifier
  access is actually needed. But the **access seam + response redaction must be
  written to read an `audience`/scope input now** so adding shares is a fill-in.

**Migration posture (Ed: "reserve schema too"):** migrate the cheap,
behavior-neutral parts now — `projects.team_id` (nullable), `users.is_staff`,
`users.can_edit_catalog` — since they default to today's behavior and let the
seam start consulting them. Hold `teams`/`team_members`/`project_shares` as
finalized DDL applied at their trigger (v2.0 tenancy; first certifier link),
unless Ed wants them stubbed empty now. **Confirm all of this at the §3
finalization pass.**

---

## 4. Page-by-page decisions

> Status key: ✅ decided · 🟡 proposed, awaiting Ed · ⬜ not yet walked

### 4.1 Status tab — ✅ decided (2026-06-27)

Current code: list = VIEW (anon-readable); all writes = EDITOR;
apply-default-template = EDITOR. Status item descriptions support sanitized
markdown + links.

| Affordance | `anon` | `member` | `admin` | `staff` | `token` | Capability | Tier |
|---|---|---|---|---|---|---|---|
| View status list | R | R | R | R | R(scope) | `status.view` | T0 |
| Add / edit / delete / reorder item | — | W | W | W | W(scope) | `status.edit` | T1 |
| Cycle state, set due date | — | W | W | W | W | `status.edit` | T1 |
| Apply default template | — | W | W | W | — | `status.template` | T1 |

**Decisions (Ed):**
1. ✅ **Expose to viewers — YES.** Status is *the* primary viewer page —
   "where are we at?" / "what's left to do?". Highest-value read surface for
   clients (and certifiers).
2. ✅ **All status content is shareable.** The Status page is explicitly
   designed as public-facing, so editor notes/descriptions being viewer-visible
   is intended. **No `internal | shared` split, no `status.item.visibility`
   capability, no extra column.**
3. ✅ **Viewer is strictly read-only — zero actions.** No reorder/rename/edit/
   state-cycle/due-date for `anon`. (Matches today.) `apply-default-template`
   recorded as `status.template` = **T1 (member)**; cheap to reserve to T2 later
   if managers should own template application — no schema impact either way.
4. ✅ **No persona split.** Single shared `anon` scope for client + certifier.

**Implication for the public-facing framing:** Status is the one tab we should
treat as *designed for the viewer*, not merely *exposed to* them. Worth keeping
that lens when we design the viewer chrome.

### 4.2 Climate tab — ✅ decided (2026-06-27, one caveat to confirm)

Address is decomposed into separate fields (`street_address`, `city`, `state`,
`postal_code`, `county`, `country`); today **only `street_address` is redacted**
for non-editors (`service.py:492`). All "Set…" actions are editor-gated.

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View coords, elevation, climate zone, time zone, **city, state, postal_code, county, country** | R | R | R | `climate.location.view` | T0 |
| View **street address** (street line only) | — | R | R | `climate.location.address` | certifier+ |
| View sun-path diagram | R | R | R | `climate.location.view` | T0 |
| View attached climate sources + dataset record detail | R | R | R | `climate.source.view` | T0 |
| Set Location / Set Phius Climate / Set PHI data / Set Hourly Data / remove source | — | — | W | `climate.location.edit` / `climate.source.edit` | T1 |
| Browse **global** climate catalog (datasets, epw-roster) | — | — | R | `catalog.climate.view` | T1 |

**Decisions (Ed):**
1. ✅ **Expose Climate — YES.** Site + climate basis is valid context for client
   and certifier.
2. ✅ **Street line private for `client`, VISIBLE for `certifier`** (and members).
   **City + state public to everyone.** Rationale: a certifier already has full
   client/owner details, so there's nothing to hide from them. → drove the
   `certifier` principal split (§1).
3. ✅ **Climate data is viewer-visible (read OK for our purposes).** **All
   "Set…" actions are invisible + inaccessible to BOTH `client` and `certifier`**
   — only logged-in full-access users (`member`+) may set locations/datasets.
   So `climate.*.edit` = T1; both viewer personas excluded.

**Caveat resolved (Ed, 2026-06-27):** only the **street line** (`street_address`)
is redacted for `client`. Everything else — exact coords, `postal_code`,
`county`, `country`, city, state — stays **public to all viewers**. ("That's
fine to show.") So the single private field for the public viewer is the street
line; the certifier sees that too. Coords-pinpoint accepted as residual.

**Reserved-schema implication:** need a per-project **certifier share/role** so
`climate.location.address` (and future certifier-only reads) can key off the
certifier principal. **Field-granularity implication:** address is already
decomposed, so per-field redaction (`street_address`, `postal_code`, `county`)
is cheap — no schema change needed for that part.
### 4.3 Apertures tab (Apertures / Glazings / Frames) — ✅ decided (2026-06-27)

Builder with canvas + glazing/frame spec panels. `canEdit = !isViewer && !locked`.
Backend reads (spec-report, u-values, drift-report, hbjson) are VIEW today.

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View aperture grid/canvas, dimensions, all elements | R | R | R | `apertures.view` | T0 |
| Pan / zoom / interior↔exterior toggle | R | R | R | (client-state, CP-1) | always |
| View U-values + spec report (window schedule) | R | R | R | `apertures.spec.view` | T0 |
| View glazing/frame specs + manufacturer data + datasheets | R | R | R | `apertures.spec.view` | T0 |
| View catalog-drift badges (QA) | — | — | R | `apertures.drift.view` | T1 |
| Export HBJSON model | — | R | R | `apertures.export.hbjson` | **certifier+** |
| Set dimensions / type assignments; add/rename/dup/delete aperture; rows/cols | — | — | W | `apertures.edit` | T1 |
| Add/delete spec or datasheet; refresh-from-catalog; manufacturer-filters | — | — | W | `apertures.spec.edit` / `apertures.edit` | T1 |

**Decisions (Ed):**
1. ✅ **Expose Apertures + Glazings + Frames to ALL viewers** (`client` too, not
   just certifier). May view all pages/elements. May **not Set** anything
   (dimensions, type assignments). May pan/zoom/flip — verified client-side
   (CP-1).
2. ✅ **Viewers may view specs + datasheets** — public manufacturer data, no
   concern. Only logged-in users may **Set** (add/delete) specs or datasheets.
   → `apertures.spec.view` = T0; `apertures.spec.edit` = T1.
3. ✅ **Catalog/drift hidden from `client` AND `certifier`** — editor-only
   (CP-3). → `apertures.drift.view` = T1.
4. ✅ **HBJSON export = certifier + editor only**; `client` cannot download.
   → close the backend gap (route is VIEW today; must exclude `anon/client`)
   per CP-4. In beta (no certifier mechanism) this collapses to editor-only.
### 4.4 Envelope tab — ✅ decided (2026-06-27)

Same builder shape as Apertures: assemblies + layers + materials on a canvas
(client-side zoom = CP-1), spec panels with datasheets + catalog-drift, plus
HBJSON + PHPP exports.

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View assemblies, layers, materials, canvas | R | R | R | `envelope.view` | T0 |
| Pan / zoom | R | R | R | (client-state, CP-1) | always |
| **Click SVG element → read-only detail modal** (material + width) | R | R | R | `envelope.element.inspect` (CP-5) | T0 |
| View thermal results (U-/R-values, assembly thermal) | R | R | R | `envelope.thermal.view` | T0 |
| View material specs + datasheets | R | R | R | `envelope.spec.view` | T0 |
| View material-catalog-drift (QA) | — | — | R | `envelope.drift.view` | T1 |
| Export **HBJSON** | — | R | R | `envelope.export.hbjson` | certifier+ |
| Export **PHPP** (+ preflight) | — | R | R | `envelope.export.phpp` | certifier+ |
| New assembly, import HBJSON, edit dims/layers, **assign materials**, status, refresh, add/del specs & datasheets | — | — | W | `envelope.edit` / `envelope.spec.edit` | T1 |

**Decisions (Ed):**
1. ✅ **PHPP export = certifier + editor only** (PHI-licensed artifact); `client`
   may not download. **HBJSON export = certifier+** (mirrors Apertures). Close the
   backend gap — both routes are VIEW today (CP-4).
2. ✅ **Thermal results (U-/R-values) = T0**, visible to all viewers incl `client`.
3. ✅ **SVG elements: no EDIT for `client` or `certifier`** (can't change dims or
   assign materials), **but click-to-inspect a read-only detail modal IS allowed**
   for all viewers (material + width details). → CP-5; `envelope.element.inspect`
   = T0.
4. ✅ **Materials view = T0** for `client` + `certifier`; **no edit**. Only
   logged-in users may Set (add/delete) project specs + datasheets.
   → `envelope.spec.view` = T0; `envelope.spec.edit` = T1.
### 4.5 Spaces tab — ✅ decided (2026-06-27)

First DataTable tab: Space Types table + Rooms schedule (iCFA, occupancy) + room
detail modal. Governed by **CP-6**.

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View Space Types + Rooms tables (iCFA, occupancy), all columns | R | R | R | `spaces.view` | T0 |
| Sort / show-hide columns | R | R | R | (CP-1) | always |
| Click room → read-only detail modal | R | R | R | `spaces.room.inspect` (CP-5) | T0 |
| View row attachments / datasheets | R | R | R | `spaces.view` | T0 |
| Insert/edit/delete rows + cells, add columns, create/edit links, add/edit attachments | — | — | W | `spaces.edit` | T1 |
| Save/load personal table-views | — | — | W | `tableviews.use` | T1 (default layout for viewers) |

**Decisions (Ed):**
1. ✅ **Fully exposed to `client` + `certifier`** (view all). Per **CP-6**: no
   SET of any kind (add/edit/delete rows/cells, no new links, no
   add/edit attachments). Only `member`+ mutate.
2. ✅ **Rooms fully exposed**; room detail modal is read-only-viewable (CP-5).
3. ✅ **Default table layout for viewers in beta.** Customizable/shareable views
   deferred (`tableviews.shared`, CP-6) — not built for MVP.
### 4.6 Equipment tab — ✅ decided (2026-06-27)

~12 DataTables (Ventilators, Pumps, Fans, Hot-Water Heaters/Tanks, Electric
Heaters, Appliances, heat-pump Indoor/Outdoor Units & Equip, Rooms) + manufacturer
datasheets. Governed by **CP-6** + **CP-7**.

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View all equipment tables, all columns + datasheets | R | R | R | `equipment.view` | T0 |
| Sort / show-hide columns, click-to-inspect | R | R | R | (CP-1/CP-5) | always |
| Add/edit/delete rows + cells, links, attachments | — | — | W | `equipment.edit` | T1 |
| Download table CSV | — | R | R | `equipment.export.csv` (CP-7) | certifier+ |
| Export heat-pump → Phius | — | R | R | `equipment.export.phius` (CP-7) | certifier+ |

**Decisions (Ed):**
1. ✅ **CP-6 applied wholesale to all Equipment tables** — view-all for both
   viewer personas, no Set of any kind. **No exceptions.**
2. ✅ **Heat-pump exports AND all CSV downloads = certifier + editor only**;
   `client`/anon may not download. → drove **CP-7** (applies app-wide).
### 4.7 Thermal Bridges tab — ✅ decided (2026-06-27)

DataTable (`assets/thermal-bridges/ThermalBridgesTable.tsx`) — TB types,
psi-values, lengths, + TB detail-drawing attachments. Governed by CP-6 + CP-7.

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View TB table (psi-values, lengths) | R | R | R | `thermalbridges.view` | T0 |
| **View + download TB detail drawings** (attachments) | R | R | R | `thermalbridges.view` | T0 |
| Sort / show-hide / click-to-inspect | R | R | R | (CP-1/CP-5) | always |
| Add/edit/delete rows, links, attachments | — | — | W | `thermalbridges.edit` | T1 |
| **Download CSV** (bulk export) | — | R | R | `thermalbridges.export` (CP-7) | certifier+ |

**Decisions (Ed):**
1. ✅ CP-6 + CP-7 wholesale; no exceptions.
2. ✅ **TB detail drawings (and all DataTable attachments) — view + download for
   ALL viewers.** Only the **bulk CSV export** is `certifier`+. → drove the CP-7
   attachment ruling (attachments open; bulk exports gated).
### 4.8 Model tab (3D viewer) — ✅ decided (2026-06-27)

Interactive 3D HBJSON viewer (geometry, spaces, mechanical-system overlays).
Orbit/pan/zoom client-side (CP-1).

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| View 3D model (geometry, spaces) + orbit/pan/zoom | R | R | R | `model.view` | T0 |
| View system overlays (ventilation, hot-water, shading) | R | R | R | `model.view` | T0 |
| Download raw `.hbjson` model file | — | R | R | `model.export` (CP-7) | certifier+ |
| Upload HBJSON, rename/delete model files | — | — | W | `model.edit` | T1 |

**Decisions (Ed):**
1. ✅ **3D viewer fully exposed — geometry + system overlays — to all viewers**
   (incl `client`). No overlay split.
2. ✅ **Download `.hbjson` = `certifier` + editor only**; `client` may not
   download or upload. **`certifier` may NOT upload/rename/delete** — view +
   download only. Reaffirms **CP-2** (certifier never writes).
### 4.9 Project chrome (topbar / version controls / settings / metadata) — 🟡 mostly decided; version-exposure under discussion

**Live leak found:** `get_project_detail` (`projects/service.py:444`) only redacts
`owner_display_name` for non-editors; it currently sends `phius_dropbox_url`
(internal bldgtyp Dropbox link), `client`, and `phius_number` to anonymous
viewers. Fix as part of this work.

**Project-level metadata field redaction (Ed):**

| Field | `client` | `certifier` | `member`+ |
|---|---|---|---|
| `name`, `bt_number` | R | R | R |
| `phius_number` | R | R | R |
| `client` (client name) | — | R | R |
| `phius_dropbox_url` (internal Dropbox) | — | R | R |
| `owner_display_name` | — | — | R |

**Other chrome:**

| Affordance | `client` | `certifier` | `member`+ | Capability | Tier |
|---|---|---|---|---|---|
| IP/SI unit toggle | R/W (local) | R/W (local) | R/W (synced) | (CP-9) | always |
| Topbar read-only pill + Sign-in (viewer) | view | view | — | — | — |
| Open Project Settings modal | — | — | view/W | `project.manage` | T2 |
| Edit metadata (rename, bt#, phius#, dropbox, cert programs) | — | — | W | `project.manage` | **T2 owner/admin** |
| MCP token list/issue/revoke | — | — | W | `tokens.mcp.manage` | **T2 owner/admin** |
| See **latest committed** version (auto-follow), no version UI | R | R | R | `version.current.view` | T0 |
| **Version history list + switch + diff** | — | R | R | `version.history.view` | **certifier+** |
| Draft / save / save-as / version rename | — | — | W | `version.edit` | T1 |

**Decisions (Ed):**
1. ✅ **Field redaction:** `phius_number` public to all viewers; **`client` +
   `phius_dropbox_url` = `certifier`+** (redacted from `client`); `owner` =
   editor-only. **Backend fix:** extend the `access_mode` redaction beyond
   `owner_display_name`.
2. ✅ **IP/SI toggle works for all viewers today** (CP-9) — no change.
3. ✅ **Viewers cannot access Project Settings** (hidden entirely).
4. ✅ **Metadata management + MCP tokens = T2 (owner/admin)** — reserved above
   plain `member`; tightens security-review C-3.
5. ✅ **No dashboard / project-list / catalog access for viewers** (CP-8).
6. ✅ **Version exposure — RESOLVED (persona-split).** `client` = latest
   committed version, **auto-following, no version UI** (no list/switch/diff).
   `certifier` = **full history + switch + diff** (legitimately useful for
   iterative PH review). `member`+ = + drafts/save/rename. Fits CP-2; only the
   certifier sees version names. Note: exposing switching is nearly free in the
   current code; the new work is *pinning the client* (hide switcher, strip the
   version list from the client payload, lock to latest committed).
### 4.10 Dashboard (project list) — ✅ decided (2026-06-27)

AUTH-ONLY; no viewer access (CP-8). Today owner-scoped.

| Affordance | `member` | `admin` | `staff` | Capability | Tier |
|---|---|---|---|---|---|
| See project list | own projects | team's projects | cross-tenant | `project.list` | scoped by role |
| Create project | W | W | W | `project.create` | T1 |
| Delete / restore project | own | team | any | `project.delete` | T2 |

**Decisions (Ed):**
1. ✅ **Scoping confirmed:** `member` = own, `admin` = whole team, `staff`
   (bldgtyp) = cross-tenant. More than needed today (only Ed + John use the app)
   but the intended foundation. Encoded by reserved `team_id` +
   `team_members.role` + `users.is_staff`.
2. ✅ **Delete/restore = owner/admin (T2).**
### 4.11 Catalogs (materials / glazing / frame types) — ✅ decided (2026-06-27)

Global, AUTH-ONLY; no viewer access (CP-8). bldgtyp-curated shared libraries.

| Affordance | `member` | `member + catalog-admin grant` | `staff` | Capability | Tier |
|---|---|---|---|---|---|
| Read catalogs (browse/pick) | R | R | R | `catalog.view` | T1 |
| Create/edit/delete/import catalog records | — | W | W | `catalog.edit` | **grant-gated** |

**Decisions (Ed):**
1. ✅ **Catalog read = any member (T1).**
2. ✅ **Catalog write = a grantable "catalog-admin" capability** — NOT every
   member, NOT a whole-role tier. It can be **turned on for specific members**
   (plus bldgtyp `staff` always). This is the **first per-user capability grant
   independent of the role ladder** → see schema impact in §3 (tips toward a
   grant mechanism / per-capability flag, not just role columns).
3. ✅ **No anon/certifier catalog access** (CP-8).
4. Global shared library (bldgtyp-curated), not per-team catalogs.
### 4.12 Sign-in / auth — ✅ decided (2026-06-27)

PUBLIC entry point.

| Affordance | anon | member+ | Capability | Tier |
|---|---|---|---|---|
| Reach `/sign-in`, submit login | open | open | — | PUBLIC |
| Viewer "Sign in" link (read-only pill → `/sign-in?next=<project>`) | open | — | — | PUBLIC |
| Self-service signup | — | — | — | **none** (invite/seed-provisioned) |
| Password reset / forgot-password | — | — | — | **absent today** (v2.0 R4) |

**Decisions (Ed) / notes:**
1. ✅ Sign-in public; a viewer with an account can upgrade to editor via the
   pill's `?next=` link.
2. ✅ **No public self-registration** — accounts are provisioned (seed today,
   invite-driven in v2.0). Matches the multi-tenant PRD.
3. **Carry-forward (not beta):** password-reset / invite-accept / email
   verification are v2.0 account-lifecycle items (PRD R4/R5). Harden the
   `?next=` redirect to a same-origin allowlist (security-review M-10) whenever
   sign-in is touched.

---

## 5. Implementation punch-list (deltas from today's behavior)

> This is the original walkthrough punch-list. Build status is tracked in
> `planning/refactor/access-capability-model/{PLAN,STATUS}.md`, not by the boxes
> below — as of Phases 1–3 the backend-beta items here are done (the catalog gate
> shipped via the `user_grants` / `catalog.edit` mechanism of decision D8, not the
> `users.can_edit_catalog` boolean this list originally proposed).

Concrete code changes the decisions imply. **Beta** = needed for the read-only
launch (binary `client`/`member`); **Reserved** = schema/seam shaped now,
enforced when certifier/teams arrive.

### Backend — Beta
- [ ] **Fix metadata leak** (§4.9): extend `get_project_detail` redaction beyond
  `owner_display_name` — redact `phius_dropbox_url` + `client` from `client`
  viewers (keep `phius_number` public). `projects/service.py:444`.
- [ ] **Gate bulk-export routes** currently VIEW → editor-only in beta / certifier+
  later (CP-4, CP-7): `apertures/hbjson`, `envelope/export/hbjson`,
  `envelope/export/phpp[/preflight]`, `equipment/heat-pumps/export-phius`, table
  CSV exports, model `.hbjson` download.
- [ ] **Catalog write admin-gate** (C-4): introduce `users.can_edit_catalog`;
  gate catalog create/edit/delete/import on it (+ `is_staff`).
- [ ] **Seam reads an `audience`/version-scope input** even if beta hardcodes
  `client` + latest (so shares are a fill-in) (§3c).
- [ ] Confirm `street_address` stays the only redacted location field;
  city/state/postal/county/country stay public (no change expected).

### Frontend — Beta
- [ ] **Pin `client` to latest committed version**: hide the version
  switcher/history/diff for viewers; lock to latest committed (§4.9 / CP-8).
- [ ] **Hide bulk-export/download buttons** from `client` (CSV, HBJSON, PHPP,
  model). Attachments stay view+download for all (CP-7).
- [ ] **Hide Project Settings entry** from viewers entirely (today `isViewer` →
  read-only modal; change to not-rendered) (§4.9).
- [ ] **Verify CP-5**: aperture + envelope canvas inspection click is NOT gated on
  `canEdit`; add a read-only detail-modal variant if it is.
- [ ] (No change) IP/SI toggle already viewer-safe (CP-9); pan/zoom client-side
  (CP-1).

### Reserved (schema/seam shaped now; enforced later)
- [ ] Migrate cheap behavior-neutral columns: `projects.team_id` (nullable),
  `users.is_staff`, `users.can_edit_catalog` (defaults reproduce today).
- [ ] Finalize + hold DDL: `teams`, `team_members(role)`, `project_shares`
  (audience/version-scope) — applied at v2.0 tenancy / first certifier link.
- [ ] Decide per-user grant mechanism: boolean now vs `user_grants` table (§3b).

### Cross-cutting / posture
- [ ] `?next=` same-origin allowlist (M-10).
- [ ] Topbar de-conflates `viewer == anonymous` once `certifier` exists (today's
  "Read-only / Sign in" pill is fine for beta).
