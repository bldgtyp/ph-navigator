---
DATE: 2026-06-14
TIME: 15:52 EDT
STATUS: Deferred (v2.0 — speculative). No code. Captures thinking, concerns,
  and requirements for opening PH-Nav-V2 to external paying members via the
  Reimagine Buildings Collective (RBC) partnership. Not scheduled; not gated.
AUTHOR: Claude (for Ed)
SCOPE: Router for the multi-tenant / external-membership feature — turn the
  single-trusted-team internal app into a multi-firm tenant model with team
  admins, scoped members, downstream API tokens, and MCP tokens, provisioned
  through an RBC membership entitlement (RBC handles end-user payment).
RELATED:
  - PRD.md — context, the partnership shape, team/role model, token strategy,
    requirements, concerns, open questions.
  - STATUS.md — current state (speculative), next decision.
  - backend/features/projects/access.py — the existing "forward-compatible
    project access seam" this feature must grow an ownership/membership check
    into (single chokepoint).
  - backend/features/projects/routes.py — project-scoped routes that currently
    enforce authentication but NOT ownership (the Tier-1 hurdle).
  - backend/alembic/versions/20260512_0006_mcp_tokens.py — existing per-project
    token model to extend/mirror for downstream API + MCP tokens.
  - backend/alembic/versions/20260512_0002_auth_sessions.py — users + sessions
    schema (single-active-session unique partial index lives here).
  - backend/config.py — session lifetime, password (Argon2id) params, CORS
    origins (currently pinned to localhost).
---

# Multi-Tenant Teams — opening PH-Nav-V2 to external members (RBC partnership)

Make PH-Navigator V2 usable by **paying firms outside bldgtyp**, delivered as
part of a [Reimagine Buildings Collective](https://collective.reimaginebuildings.com)
(RBC) annual membership. Each member firm is a **tenant**: a team admin manages
the firm's users and access and sees all of the firm's projects; ordinary
members see only their own scoped projects.

## Why this exists

So far the app has only ever served bldgtyp staff — everyone with an account is
trusted. Going to external members changes exactly one thing, but it changes it
everywhere: **the security model can no longer assume goodwill.** The whole
feature is the cost of crossing that trust boundary; 100-ish users is trivial
for the infrastructure, so this is *not* a scale problem.

The RBC partnership makes the money side easy — **RBC handles end-user
payment**; bldgtyp bills RBC under a separate contract. That removes in-app
billing (Stripe/subscriptions/dunning) from scope and replaces it with a much
smaller **provisioning / entitlement** concern.

## The one hard part

Everything except authorization is *absent surface area* (routine to build).
The single architecturally significant hurdle is **tenant isolation**: today
`backend/features/projects/access.py` checks that you are *authenticated*, not
that the project is *yours* — and view access is open even unauthenticated.
That is harmless among trusted staff and a cross-tenant data breach the moment
two firms share the database. The good news: there is a deliberate single seam
to fix it in, and tenancy lives in one column (`projects.owner_id`), not
scattered across every table.

## Read order

1. `PRD.md` — the substance: partnership shape, team/role model, token
   strategy, requirements, concerns, open questions.
2. `STATUS.md` — speculative; the next decision is whether/when to pursue.

## Status

**Speculative.** Recorded now so the thinking is not lost. No implementation,
no phase plans, no schedule. Promote to `planning/features/` (v1.x) only if the
RBC partnership firms up and Ed decides to build it.
