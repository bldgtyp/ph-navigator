---
DATE: 2026-06-27
TIME: 15:10 ET
STATUS: WORKING DECISIONS LEDGER — page-by-page access classification against
        the full role matrix, plus the reserved-schema scaffold to avoid
        locking ourselves into the current binary editor/viewer model. Filled
        collaboratively with Ed, one page at a time. Will graduate to
        `planning/refactor/access-capability-model/` when it becomes a build plan.
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

## 1. Principals (matrix columns)

| Key | Principal | Today | v2.0 | Notes |
|---|---|---|---|---|
| `anon` | **Anonymous viewer** | live ("viewer") | + logged-in non-members | by-link; personas: **client/home-owner**, **certifier**. May split per-persona later. |
| `member` | **Member / editor** | live ("editor" = any session) | project owner or scoped member (junior engineer) | the live "editor" today |
| `admin` | **Team admin** | — (no teams) | firm-wide visibility + member/seat mgmt (senior/manager) | T2 |
| `staff` | **Platform / bldgtyp staff** | — | cross-tenant consult/support | T3; design deliberately, not an accidental super-user |
| `token` | **API / MCP token** | MCP live, per-project | + downstream API (Rhino/GH/Honeybee-PH) | acts *as* a principal; **never widens** beyond issuer's grants; same seam |

**Persona note:** the two `anon` personas (client vs certifier) may eventually
want *different* read scopes. We record a per-persona split only where the
walkthrough shows it matters; default is a single `anon` read scope.

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

## 3. Reserved schema scaffold (PROVISIONAL — finalized in step 3)

Goal: make the future role model a *fill-in*, not a *migration of meaning*.
Everything additive + nullable; **defaults reproduce today's behavior** so the
seam's logic is unchanged until we choose to consult these.

Provisional (to harden after the walkthrough):
- `teams (id, name, membership_status, seat_limit, membership_expires_at, deleted_at, audit…)` — empty until v2.0.
- `team_members (team_id, user_id, role, joined_at)` — `role ∈ {admin, member}`.
- `projects.team_id UUID NULL` — owning firm; null = legacy/bldgtyp-internal.
- `users.is_staff BOOLEAN NOT NULL DEFAULT false` — the platform/staff (T3) flag (also resolves security-review C-4's missing admin flag for catalogs).
- (Maybe) a `capabilities`/grants concept — **deferred**; decide if a role→capability map in code is enough vs. a grants table. Lean: code map for v2.0, table only if per-project custom shares (rule (c)) are needed.

**Open:** how much of this to actually migrate in beta vs. leave as designed-DDL.
Ed chose "reserve schema too" → default is migrate the cheap, behavior-neutral
parts (`projects.team_id`, `users.is_staff`) and hold `teams`/`team_members`
until the v2.0 trigger, unless Ed wants them stubbed now. Confirm at step 3.

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

### 4.2 Climate tab — ⬜ not yet walked
### 4.3 Apertures tab — ⬜ not yet walked
### 4.4 Envelope tab — ⬜ not yet walked
### 4.5 Spaces tab — ⬜ not yet walked
### 4.6 Equipment tab — ⬜ not yet walked
### 4.7 Thermal Bridges tab — ⬜ not yet walked
### 4.8 Model tab — ⬜ not yet walked
### 4.9 Project chrome (topbar / version controls / settings / assets-attachments) — ⬜ not yet walked
### 4.10 Dashboard (project list) — ⬜ not yet walked
### 4.11 Catalogs (materials / glazing / frame types) — ⬜ not yet walked
### 4.12 Sign-in / auth — ⬜ not yet walked
