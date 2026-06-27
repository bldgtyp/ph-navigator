---
DATE: 2026-06-27
TIME: 16:10 ET
STATUS: Active — phased implementation sequence. No phase started.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: How the capability model gets built. Maps the decisions-ledger §5
        punch-list onto ordered phases. Each phase is independently shippable
        and leaves the app green.
RELATED:
  - PRD.md (the contract each phase builds to)
  - decisions.md (D1..D10)
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md §5 (the punch-list)
---

# PLAN — Access Capability Model

Five phases. Phases 1–4 are the **beta** (binary-equivalent behavior + the
agreed deltas + future-proof schema). Phase 5 is **deferred** to the multi-tenant
trigger. Each phase ends green (`make ci`) and is shippable alone.

This document is the build plan; the per-phase summaries below are the working
detail (earlier drafts referenced a `phases/` sub-folder that was never written).

> Sequencing logic: schema → resolver → backend enforcement → frontend gating →
> (later) tenancy. The resolver (P2) defaults to today's behavior, so P1+P2 are
> invisible to users; P3+P4 are the only observable beta changes; P5 is gated on
> the business trigger.

## Phase 1 — Schema foundation ✅ DONE (migration `20260627_0003`)
**Goal:** lay down the additive, behavior-neutral schema.
- Migrate now: `projects.team_id` (nullable; FK to `teams` **held** until Phase 5
  since the table doesn't exist yet), `users.is_staff` (default false),
  `user_grants` table (PRD §5.2) + repository (`features/access/`).
- Author but **hold**: `teams`, `team_members`, `project_shares` (PRD §5.1, §5.3)
  → `backend/alembic/held/phase5_tenancy_and_shares.sql` (not in the alembic
  chain; includes the deferred `projects.team_id` FK).
- Seed/dev: `scripts/manage_user_access.py` (`grant`/`revoke`/`set-staff`),
  env-guarded like `seed_user.py`.
**Verify:** ✅ migrations up/down/up clean; `ty`/`ruff`/`pytest`/boundary-check
green; `tests/test_access_user_grants.py`; no behavior change (nothing reads the
new columns yet).

## Phase 2 — Capability resolver in the seam ✅ DONE
**Goal:** `access.py` answers capability questions; behavior unchanged.
- `capabilities_for(principal)` + `require_capability(access, cap)` + capability
  constants and the `CLIENT_CAPS` / `MEMBER_CAPS` bundles, in `features/access/`.
- Principal resolution: cookie→`UserPrincipal` (with `is_staff` + global grants),
  none→`ViewerPrincipal("client")`. (Certifier/admin/staff/token → Phase 5.)
- `is_editor` is derived (`PROJECT_EDIT ∈ caps`); `require_editor_user` and the
  MCP `project_access_for_user` path flow through `require_capability`, so all
  ~83 route call-sites keep working unchanged. Per-route migration to explicit
  capabilities is deferred to P3 (where it changes behavior) — incremental, not
  big-bang (D-rejected).
**Verify:** ✅ bundles reproduce today's allow/deny exactly; full suite (1155)
green → behavior-neutral; `tests/test_access_resolver.py` covers anon→client,
session→member, is_staff/grant honored, and the 401-viewer/403-user contract.

## Phase 3 — Backend beta deltas (the observable backend changes) ✅ DONE
**Goal:** close the leaks/gaps the walkthrough found.
- ✅ **Metadata redaction** (ledger §4.9): `get_project_detail` redacts
  `phius_dropbox_url` + `client` from `client` viewers (capability-driven via
  `PROJECT_VIEW_PRIVATE`); `phius_number` stays public.
- ✅ **Gate anon-readable exports** (CP-4/CP-7): `apertures/hbjson`,
  `envelope/export/hbjson`, `envelope/export/phpp[/preflight]`,
  `equipment/heat-pumps/export-phius`, model `.hbjson` download, **and the two
  project-document JSON downloads** (`/download`, `/download/tables/{t}`) now
  require their export capability (beta: editor-only; `certifier`+ later).
  Per-surface client-side table CSVs are a frontend concern (P4). A coverage test
  asserts every export/download route 401s anonymous.
- ✅ **Catalog write grant** (D7/C-4): a `CatalogEditor` dependency on the ~23
  catalog write routes requires `catalog.edit` (grant or `is_staff`).
**Verify:** ✅ anon cannot fetch the gated exports or see the internal Dropbox
URL; member behavior unchanged; `tests/test_access_phase3_deltas.py`; full suite
(1161) green.

## Phase 4 — Frontend beta deltas
**Goal:** the viewer UI matches the decided model.
- **Pin `client` to latest committed version**: hide version switcher/history/diff
  for viewers; lock to latest (ledger §4.9 / CP-8). Strip the version list from the
  client payload.
- **Hide bulk-export/download buttons** from `client` (CSV/HBJSON/PHPP/model);
  attachments stay view+download for all (CP-7).
- **Hide Project Settings entry** from viewers entirely (today `isViewer`→read-only
  modal → not-rendered).
- **Verify CP-5**: aperture + envelope canvas inspection click is not `canEdit`-
  gated; add read-only detail-modal variant if needed.
- (No change) IP/SI toggle (CP-9), pan/zoom (CP-1) already viewer-safe.
**Verify:** logged-out walkthrough of a seeded project shows exactly the decided
client surface; `make frontend-dev-check` + Playwright smoke.

## Phase 5 — Tenancy + shares (DEFERRED to multi-tenant trigger)
**Goal:** enforce roles, certifier shares, staff.
- Apply held DDL (`teams`, `team_members`, `project_shares`).
- Add `CERTIFIER_CAPS`, `ADMIN_CAPS`, `STAFF_CAPS`; wire `role_in` to
  `team_members`; wire share-token → `ViewerPrincipal(audience, version_scope)`.
- Certifier link issuance UI (mirror MCP token UI); version-pinned shares.
- Cross-tenant denial tests (multi-tenant R1); token-as-principal audit (every
  token path runs through the seam).
- Topbar de-conflates `viewer == anonymous`.
**Gated on:** the RBC partnership / first external member (multi-tenant STATUS).

## Cross-cutting (any phase that touches the area)
- `?next=` same-origin allowlist (M-10) when sign-in is touched.
- Keep one enforcement path: every token + share check flows through the seam.

## Suggested first move
Phase 1 is pure additive schema with zero behavior change — the safe, lock-in-
reducing first commit. Phase 2 makes it useful. Recommend landing **P1+P2
together** (schema + resolver, invisible to users), then **P3+P4** as the
user-visible beta read-only experience, then stop until the P5 trigger.
