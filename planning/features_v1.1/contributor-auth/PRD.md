---
DATE: 2026-07-18
TIME: 16:10
STATUS: Draft (design stage — §D1–§D4 open; do NOT implement from this doc yet)
AUTHOR: Ed May (with Claude)
SCOPE: Product/architecture contract for Contributor (upload-only team-member) auth
RELATED: README.md, research.md, planning/archive/dated/2026-07-19/documentation-tab/PRD.md,
         planning/features_v2.0/access-capability-enforcement/
---

# Contributor auth — PRD (design draft)

## 1. Story

**US-CA-1.** A project team member (architect, consultant — not Ed/John)
signs in with minimal friction and can **add or delete photos and
datasheets on pre-existing records** for their project. They cannot edit
record fields, add records, delete records, change status values, save
versions, or touch other projects. Every upload is attributed to them.

## 2. What already exists (see research.md §A)

Capability strings + `user_grants` table (project-scoped rows storable but
not yet *resolved*), invite-token machinery (`account_tokens`), audit log,
session cookie infra, `mcp_tokens` / held `project_shares` as token
precedents, and hardened upload validation (MIME sniff, size caps). Missing:
an intermediate capability tier, project-scoped grant resolution, rate
limiting, and a landing place for contributor writes (the draft problem).

## 3. Open design decisions

### D1. Login mechanism

**Recommendation: in-app magic-link email login** (research §B ranking):
admin invites an email per project → contributor taps the emailed link →
existing `phn_session` cookie is minted with a Contributor principal. Reuses
session/cookie/audit infra wholesale; validated by CompanyCam's guest-access
precedent for exactly this persona. **Not** Cloudflare Access (parallel auth
system, cross-origin JWT + CORS preflight + mobile-Safari footguns — see
research §B for the full case). Ed to confirm this direction before any
phase planning.

Sub-decisions: session lifetime for contributors (same 480 min sliding, or
longer for field convenience?); does the **single-active-session rule** apply
to contributors (recommend: yes, unchanged — one phone + one laptop conflict
is acceptable at this scale)?

### D2. Authorization shape

**Recommendation:** a new capability (e.g. `evidence.contribute`) granted
**project-scoped** via the existing `user_grants` table, plus the missing
resolver step (extend `capabilities_for` / `require_project_access` to
resolve `scope_type='project'` grants for the project in hand). Contributor
principal = signed-in user whose capability set for the project contains
`evidence.contribute` but not `project.edit`.

- Asset routes change their gate from `require_editor_user` to "editor OR
  contributor" for upload-intent / complete-upload / attach / detach;
  everything else keeps `PROJECT_EDIT`.
- Frontend: contributors see the viewer UI **plus** upload affordances on
  attachment surfaces (Site Photos page, equipment tables' photo/datasheet
  cells, Materials). No Save/Save-As, no record editing, no catalog access.
- Stays deliberately inside the Phase-5 access-capability-enforcement
  design (this is a thin slice of it, not a fork).

### D3. Where do contributor writes land? ⚠ the hard one

Evidence refs live inside the versioned document; attach writes go to the
acting user's per-user draft; only editors can Save. A contributor's own
draft would be invisible to Ed and permanently unsaved.

| Option | Mechanic | Trade-offs |
|---|---|---|
| A — auto-committed micro-saves | Contributor attach = immediate new saved version (system-authored, e.g. "Photo added by {name}"). | Publicly visible instantly (matches contractor expectations); keeps evidence in the doc. But: version history gets noisy; "immutable-by-discipline saves" now has machine-authored versions; concurrent-draft interplay (editor's open draft is based on an older version) needs a rebase/merge story. |
| B — shared "evidence inbox" outside the doc | Contributor uploads land in a project-level holding area (relational, like Airtightness's project-level stance); an editor reviews and attaches to records (one click) in their draft. | Cleanest with the versioning model; gives Ed a review gate (quality control on blurry/wrong photos!). But: two-step flow — contributor's photo isn't "on the record" until Ed files it; needs a small new UI (inbox + per-record suggestion). |
| C — evidence moves out of the versioned doc entirely | `record_id → asset_ids` project-level relational table; doc no longer carries attachment arrays. | Makes contributor writes trivial and photos version-independent (arguably their true nature — a site photo documents the *building*, not a model version). But: a significant migration touching every attachment surface + registry + MCP tools; loses "this version's evidence set" semantics; contradicts the reaffirmed JSONB-blob shape decision (2026-06-24) unless explicitly revisited. |

**Leaning B for v1** (review gate is genuinely useful for photo QA, and it
requires no versioning-model change), with C noted as the honest long-term
home if evidence keeps growing. **This is the decision to settle with Ed
first — it shapes everything else.** Note D3-B also pairs well with
site-photos §D6: the inbox can show "pending review" state on the public
page.

### D4. Invite & management UX

- Editors (or admin?) invite a contributor per project: email + optional
  display name; revocable from the same surface. Candidate home: Project
  Settings modal (where MCP tokens already live) — "Team" section.
- Contributor list shows last-active + upload count (audit log supplies it).
- Recommend: invites are **per-project grants to a real (lightweight) user
  row** — reuses invite tokens, keeps attribution, allows the same person on
  several projects later.

## 4. Abuse / safety requirements (whatever mechanism wins)

- Rate limiting on upload-intent + magic-link-request endpoints (none exists
  today — required before any broader-than-editor upload surface ships).
- Magic-link tokens: single-use, short TTL, hashed at rest (reuse
  `account_tokens` pattern); revoke-all on contributor removal (mirror MCP
  token revocation).
- Contributor cannot enumerate other projects (project-scoped resolution) or
  read private metadata (`project.view.private_metadata` stays editor-only).
- Existing per-field MIME/size caps + magic-byte sniff already cover file
  safety; keep `site_photo`/`datasheet` kinds only for contributors.

## 5. Sequencing

1. This feature designs + lands **after** site-photos v1 (which ships on the
   editor/viewer model) but **before** site-photos User-Story 2 is promised
   to anyone.
2. If D3-B (inbox) wins, the inbox UI is this feature's main frontend
   deliverable; site-photos' page grows a "pending review" affordance.
3. Deferred until this lands: any mention of team-member login in
   user-facing docs.
