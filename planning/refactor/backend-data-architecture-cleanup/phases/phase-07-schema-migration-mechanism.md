---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Deferred — pre-first-deploy gate. Do NOT build now.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 7 — the document schema-migration mechanism (the one genuinely data-dependent obligation).
RELATED: ../PLAN.md, context/technical-requirements/llm-mcp-schema.md §10.5,
         context/technical-requirements/save-versioning.md §8.3,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md §4
DEPENDS_ON: all clean-cut phases done; gated to BEFORE the first real save / first deploy.
---

# Phase 7 — Schema-Migration Mechanism  *(DEFERRED)*

## Why this is deferred, not dropped

This is the one obligation the no-backcompat window lets us **postpone** rather
than do now. Building a forward-only shim chain + golden corpus today is YAGNI:
there is no saved data to migrate, and Phase 3 already deletes the half-built
shims. But the instant a real project version is saved on the remote DB,
`schema_version` becomes immutable history and the hard guarantee applies:
*a version openable when saved must stay openable forever* (`llm-mcp-schema.md`
§10.5).

So this phase is a **gate**: it must ship before the first real save / first
deploy, after all clean-cut work (Phases 1–6) is done. Until then, "bump
`schema_version`" stays a gated, reseed-based dev operation (Phase 3 made the
validator current-only precisely so this stays simple).

## The decision to make (when this phase activates)

Pick one canonical mechanism (the review §4 fork):

- **(A) Read-time forward-only shim chain (recommended).** Pure functions, one
  per version step (`upgrade_vN_to_vN1`); on read, if `body.schema_version <
  CURRENT`, apply in sequence and return the upgraded view; the row is not
  mutated; lazy migration lands the new body only on Save. Best fit for the
  immutable-version model.
- **(B) Deploy-time Alembic body-rewrite.** What the old `0027`–`0031` did
  (deleted in the Phase-5 squash). Simpler to reason about but mutates
  "immutable" saved bodies in place and needs batching as bodies grow. Not a
  good permanent answer for an immutable-revision product.

## Scope when built (mechanism A)
- The shim-chain runner + per-step pure-function modules.
- Per-version Pydantic models living side-by-side (`ProjectDocumentV1`, …) so old
  bodies parse against the matching model (`llm-mcp-schema.md` §10.5 item 9).
- Golden-file corpus (`tests/document_schema/fixtures/vN/*.json`) + CI that runs
  every fixture through every applicable chain on every PR, asserting
  roundtrip-idempotency (§10.5 item 6).
- Production-corpus drill: a CI job that runs the new shim against a staging
  snapshot before a `CURRENT` bump merges (§10.5 item 7).
- Reconcile `llm-mcp-schema.md` §10.5 + `save-versioning.md` §8.3 to describe
  exactly what shipped (the review's last [PENDING] doc item that can't be
  closed until this is decided).

## Acceptance criteria (when activated)
- A body saved at any prior `schema_version` reads successfully forever (golden
  corpus proves it; CI blocks any PR that breaks an old-version read).
- The original row is never mutated on read; new shape lands only on Save
  (mechanism A).
- The mechanism is documented as the **only** migration path for project-side
  schema — no ALTER TABLE for document entities.

## Trigger
Open this phase when either is true: (a) a deploy with real-user saves is
imminent, or (b) `schema_version` needs to change *after* any real body exists.
Whichever comes first ends the no-backcompat window.
