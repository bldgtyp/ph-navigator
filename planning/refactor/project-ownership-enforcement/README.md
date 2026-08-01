---
DATE: 2026-08-01
TIME: 10:14 EDT
STATUS: Complete — verified; ready to archive
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Router for the project-ownership enforcement refactor.
RELATED: ./PRD.md, ./decisions.md, ./STATUS.md, ./phases/,
  planning/features/admin-all-projects-dashboard/,
  backend/features/projects/access.py, backend/features/access/capabilities.py,
  planning/archive/dated/2026-06-27/access-capability-model/PRD.md,
  planning/features_v2.0/multi-tenant-teams/PRD.md — §2 + R1 own this gap,
  planning/features_v2.0/access-capability-enforcement/PRD.md — §7 sanctions
    doing tenant isolation early and independently
---

# Project-ownership enforcement (close the cross-user read/write gap)

Any signed-in PH-Navigator user can currently **read and edit any project by
ID**, regardless of who owns it. Project-scoped routes gate on *global*
capabilities that every signed-in user holds, so the only thing keeping one
user's projects away from another is the dashboard's `WHERE owner_id` filter —
obscurity, not access control.

This refactor moves the project seam from "is there a session?" to "does this
principal have a relationship to *this* project?".

## This is not a new finding

The gap is already documented and already owned. **`multi-tenant-teams` §2**
calls it "the tenant-isolation hurdle — the load-bearing change" and its **R1**
says *"nothing ships without it"*; **`access-capability-enforcement`** says
*"Today any logged-in user is a full member on any project."*

What this refactor does is execute **R1's owner-half early, without teams** —
sanctioned by ACE §7: *"tenant isolation is the prerequisite and is shippable on
its own as a hardening pass, independent of shares."* See `decisions.md` §D-7
for exactly what stays deferred.

The probe below was still worth running: it re-verified the claim against
current code, and `multi-tenant-teams` §2's line references
(`access.py:62-66`, `routes.py:110-127`) have since gone stale.

## Why now

It is a prerequisite for
[`planning/features/admin-all-projects-dashboard/`](../../features/admin-all-projects-dashboard/README.md).
That feature grants admins an all-projects view. If the gap stays open, the
feature is not a capability grant at all — it just surfaces in the UI what
every signed-in user could already reach by URL. Fixing enforcement first makes
the admin view mean something. (`decisions.md` §D-1.)

## Evidence

Reproduced locally on 2026-08-01 against the test database with two signed-in
users, `ed@example.com` (owner) and `john@example.com` (stranger):

```text
stranger dashboard list : 200 -> {'projects': []}      <- owner-filtered, OK
stranger GET   project  : 200
   leaked name='Ed Private House' client='Ed Client'   <- unredacted read
stranger PATCH project  : 200
   name is now='HIJACKED BY JOHN'                      <- accepted write
stranger DELETE project : 404                          <- owner-guarded, OK
```

A second probe confirmed the **anonymous** path is working as designed and is
*not* part of this refactor:

```text
anon dashboard list : 401
anon GET   project  : 200   name='Ed Private House' client=None
                            phius_url=None access_mode='viewer'
anon PATCH project  : 401
```

Anonymous callers reach a project by ID read-only with private metadata
correctly redacted — that is the documented public-viewer behavior
(`context/ui/pages/viewer-public.md`). Narrowing *which* projects are publicly
reachable is the per-project `access_mode` work from the 2026-06-27 access-model
review, and is explicitly **out of scope** here (`decisions.md` §D-5).

## Read order

1. **`PRD.md`** — the contract: current behavior, target behavior, the seam
   change, the capability key, error semantics, acceptance criteria.
2. **`decisions.md`** — the six accepted decisions and what was rejected.
3. **`STATUS.md`** — current state, next step, blockers.
4. **`phases/`** — `phase-01` (reproduce) → `phase-02` (enforce) →
   `phase-03` (sweep) → `phase-04` (docs).

## Shape of the fix

The project-reachable HTTP surface funnels through **one function** —
`require_project_access` in `backend/features/projects/access.py` — or its
MCP/GH sibling path, `project_access_for_user`. The enforcement change stays
narrow despite its wide blast radius; Phase 3's current operation count and
full module verdict table are in `implementation-report.md`.
