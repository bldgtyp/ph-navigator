---
DATE: 2026-07-18
TIME: 16:10
STATUS: Deferred (v1.1 candidate — design drafted, approach not yet chosen; no implementation)
AUTHOR: Ed May (with Claude)
SCOPE: Router for the contributor-auth feature folder
RELATED: planning/archive/dated/2026-07-19/documentation-tab/, planning/features_v2.0/access-capability-enforcement/,
         context/technical-requirements/stack-auth-migration.md
---

# Contributor auth — lightweight team-member login for evidence uploads

The prerequisite for site-photos User-Story 2 — **deferred to v1.1**
(Ed, 2026-07-18); design research is complete so work can resume without
re-surveying. Goal: let a small number of external team members (architects, consultants — **not** Ed/John)
sign in lightly and **add/delete photos and datasheets on pre-existing
records**, with no ability to edit, add, or delete the records themselves.

**Domain term:** a **Contributor** — a project-scoped principal who may
attach/detach evidence (photos, datasheets) but holds no record-edit
capability. (Candidate for `context/GLOSSARY.md` once accepted.)

## Read order

1. `PRD.md` — draft contract; §D1–§D4 are the open decisions. §D3 (where do
   contributor uploads land, given the per-user-draft write model) is the
   hard architectural question — read it before anything else.
2. `STATUS.md` — current state.
3. `research.md` — current auth/access code survey + the Cloudflare Zero
   Trust vs in-app alternatives research (2026-07-18).

## Relationship to other work

- **site-photos** (sibling feature) must NOT depend on this landing; it ships
  on the current editor/viewer model.
- `planning/features_v2.0/access-capability-enforcement/` is the deferred
  Phase-5 RBC work (scoped grants, share links, certifier audience). This
  feature deliberately builds a *thin slice* of it — decisions here should
  stay compatible with that packet's D1–D10, not fork a parallel model.
- The reserved `project_shares` DDL
  (`backend/alembic/held/phase5_tenancy_and_shares.sql`) and the `mcp_tokens`
  pattern are the nearest existing primitives.
