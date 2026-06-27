---
DATE: 2026-06-27
TIME: 22:55 ET
STATUS: Deferred (v2.0 — gated on the RBC trigger). No code beyond the reserved
  schema + resolver shape already shipped in the access-capability-model beta.
  This is the **enforcement** half of that model: light up roles, certifier
  shares, and staff once real external members / certifier links exist.
AUTHOR: Claude (Opus 4.8) + Ed
SCOPE: Router for "access-capability enforcement" — the deferred **Phase 5** of
  the access-capability-model refactor. The beta (Phases 1–4b) shipped the
  capability resolver with binary-equivalent behavior and a reserved tenancy /
  shares schema; this feature is the work that turns those reservations into
  enforced roles + certifier/client share links.
RELATED:
  - PRD.md — the deferred scope: principals to add, capability bundles, held
    DDL to apply, the share-token → principal path, certifier link UI, tests.
  - planning/archive/dated/2026-06-27/access-capability-model/ — the completed
    beta packet (PRD/decisions/PLAN/STATUS) this continues. Source of truth for
    the model, the CP-1..CP-9 principles, and the per-surface rulings.
  - planning/features_v2.0/multi-tenant-teams/ — the business/product story for
    external membership (the RBC partnership) whose *trigger* gates this work.
    That feature owns the tenant-isolation hurdle; this one owns the capability
    enforcement that rides on top of it.
  - backend/alembic/held/phase5_tenancy_and_shares.sql — the finalized,
    unapplied DDL (teams, team_members, project_shares, the deferred
    projects.team_id FK) this feature drops into a real migration.
  - backend/features/access/ — the live resolver (principals, capabilities,
    grants) written to accept an audience/scope input now, so this is a fill-in.
  - backend/features/projects/access.py — the single enforcement seam every
    token + share check must continue to flow through.
---

# Access-Capability Enforcement — deferred Phase 5

The access-capability-model **beta** (Phases 1–4b, archived) replaced the binary
`is_editor = (user is not None)` check with a capability model: every decision
answers *"does this principal have capability C on this resource?"* It shipped
the resolver, the `client`/`member` bundles, the per-surface beta deltas, and a
**reserved-but-unenforced** schema for teams and viewer shares.

This feature is the deferred **Phase 5**: the enforcement layer that fills in
those reservations. It is **gated on the RBC partnership trigger** (first real
external member or first certifier link) — the same business trigger as
[[multi-tenant-teams]]. Nothing here is scheduled.

## What "beta-equivalent" left undone

The beta deliberately collapsed every viewer to `client` and every editor to
`member`, because there is no mechanism yet to be anything else:

- **No teams** → no `admin`/`staff` roles, no per-tenant project scoping, no
  cross-tenant denial. Today any logged-in user is a full `member` on any
  project (the tenant-isolation hurdle that [[multi-tenant-teams]] owns).
- **No certifier mechanism** → no `certifier` principal, so the extra certifier
  read scope (street address, `phius_dropbox_url`, version history, bulk
  exports) is reserved in code but unreachable; every anonymous viewer is the
  most-redacted `client`.
- **No share links** → viewers reach a project only by being anonymous on its
  URL; there is no audience, no version-pinning, no rev**ocation.

## Read order

1. `PRD.md` — the substance: principals to add, bundles, held DDL, the
   share-token → principal path, the certifier link issuance UI, and the tests
   that prove cross-tenant isolation + audience redaction.
2. The archived beta packet (see RELATED) for the model and decisions this
   builds on.

## Status

**Deferred / speculative.** Recorded so the precise fill-in is not lost. The
resolver and schema were written *for* this; promoting it to `planning/features/`
and applying the held DDL happens only when the RBC partnership firms up.
