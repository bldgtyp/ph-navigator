---
DATE: 2026-06-27
TIME: 16:10 ET
STATUS: COMPLETE / ARCHIVED — accepted decisions for the access-capability-model
        refactor (beta shipped Phases 1–4b; Phase 5 deferred in
        planning/features_v2.0/access-capability-enforcement/). Folded from the
        2026-06-27 review + page-by-page walkthrough with Ed.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: The agreed decisions + rationale. Per-surface exposure tables are NOT
        duplicated here — they live in the decisions ledger (RELATED) and are
        authoritative there.
RELATED:
  - PRD.md
  - planning/code-reviews/2026-06-27/access-capability-model-decisions.md  (authoritative per-surface tables + CP-1..CP-9 full text)
---

# Accepted Decisions — Access Capability Model

## D1 — Capability model over binary

Replace `is_editor = (user is not None)` with a capability resolver
(`capabilities_for` / `require_capability` at the `access.py` seam). Roles +
viewer-audiences are code-defined capability bundles; per-user exceptions are
explicit grants. **Why:** the binary cannot express the agreed client/certifier/
member/admin/staff/catalog-admin model and would require ripping `is_editor` out
of every call site later. Gating stays on a per-resource capability, never on raw
session presence (review RULE R3 → realized).

## D2 — Five principals + token

`client`, `certifier` (viewer audiences via `project_shares`); `member`, `admin`
(`team_members.role`), `staff` (`users.is_staff`) (logged-in users); `token`
(acts as issuer, never widens). Beta: anonymous = `client`, any session =
`member` (+ `owner` where `owner_id` matches). See PRD §2.

## D3 — Two viewer personas, additive (CP-2)

`certifier ⊇ client`. Certifier = client's reads **plus** street address, client
name, `phius_dropbox_url`, version history + diff, and bulk exports. **Certifier
never writes.** Decided across the Climate (street address), Model (no
upload/rename/delete), and Version (history+diff) pages.

## D4 — Cross-cutting principles CP-1..CP-9

The walkthrough produced nine governing principles (full text in the ledger).
Summary:
- **CP-1** view controls (pan/zoom/sort/columns/view-direction) are client state — always available.
- **CP-2** `certifier ⊇ client`; both read-only.
- **CP-3** catalog/QA internals (drift badges) are editor-only — hidden from both viewers.
- **CP-4** close API gaps where the UI is more restrictive than the route.
- **CP-5** click-to-inspect detail modals are read-only views — available to all viewers.
- **CP-6** the DataTable rule: viewers view all rows/columns, set nothing (no rows/cells/links/attachments); default layout in beta.
- **CP-7** bulk exports (CSV/HBJSON/PHPP/Phius/model) = certifier+; individual attachments (datasheets, detail drawings) = view + download for all.
- **CP-8** viewers are link-scoped to one project; no dashboard, no catalogs.
- **CP-9** the IP/SI toggle works for every principal (verified client-side; no change).

## D5 — Per-surface rulings (authoritative in the ledger §4)

All 12 surfaces decided: Status (public-facing, all content shareable, view-only
for viewers); Climate (street line `certifier`+, everything else public); Apertures
& Envelope (full read incl specs + click-inspect; drift hidden; HBJSON/PHPP export
`certifier`+); Spaces / Equipment / Thermal-Bridges (DataTable rule); Model (3D +
overlays viewable; `.hbjson` download `certifier`+; certifier no writes); chrome
(metadata redaction; settings hidden from viewers; version persona-split); Dashboard
& Catalogs (AUTH-ONLY, no viewers); Sign-in (public, no self-signup). **Do not
restate — see ledger.**

## D6 — Version exposure: persona-split

`client` = latest committed version, auto-following, **no version UI**.
`certifier` = full history + switch + diff (legitimately useful for iterative PH
review). `member`+ = + drafts/save/rename. **Why:** the personas have opposite
needs; pinning hurts the certifier, history clutters/leaks for the client. Only
the certifier sees version names (professional audience) → low naming-hygiene risk.

## D7 — Catalogs: grantable catalog-admin, global library

Catalog read = any member. Catalog **write** = a grantable `catalog.edit`
capability ("turned on for specific members") + `staff`, NOT a whole role tier.
Catalogs stay a single bldgtyp-curated **global** library (not per-team). **Why:**
matches the PH-Materials/PH-Apertures shared-library model; a member firm must not
edit a library other firms depend on. This is the first per-user grant.

## D8 — Fine-grained `user_grants` table (not booleans)

Chosen mechanism for per-user capabilities is a general
`user_grants(user_id, capability, scope_type, scope_id)` table, **not** a
per-capability boolean. **Why (Ed):** future-proof the auth model now — the goal
is fine-grained permissions eventually, and a grants table absorbs every future
case (per-project collaborator, scoped admin) without new tables. Catalog-admin is
its first row. Trade-off accepted: more moving parts now for no schema churn later.

## D9 — Schema reserved now; enforcement phased

Migrate the behavior-neutral parts now (`projects.team_id`, `users.is_staff`,
`user_grants`); author but hold `teams`/`team_members`/`project_shares` until their
feature lands (avoid empty unused tables in a public repo). Resolver ships beta
(binary-equivalent); role/team/share enforcement lands incrementally. See PRD §5.4,
§6.

## D10 — Beta deltas (the only observable changes from today)

From the ledger §5 punch-list: fix the **metadata leak** (`phius_dropbox_url`/
`client` redaction); **gate anon-readable export routes**; **pin `client` to latest
version** (hide version UI); **hide bulk-export buttons + Project Settings** from
viewers; **catalog write grant**; verify **CP-5** inspect modals aren't `canEdit`-
gated. Plus posture: `?next=` allowlist (M-10). Everything else is identical to
today.

## Rejected / deferred

- **Per-capability booleans** instead of `user_grants` — rejected (D8): not
  future-proof enough for Ed's goal.
- **Per-team catalogs** — deferred (D7): global library chosen.
- **`tableviews.shared`** (editor-curated client-facing layouts) — deferred; beta
  shows default layout (CP-6).
- **Client pinned to a frozen link version** — rejected in favor of latest-
  auto-follow (D6); pinned remains available per-share (`version_scope='pinned'`).
- **Big-bang `is_editor` removal** — deferred; resolver lands first, call sites
  migrate incrementally.
