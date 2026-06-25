---
DATE: 2026-06-24
TIME: 22:35 EDT
STATUS: Complete / archived — implementable phases complete; Phase 7 deferred to pre-first-deploy gate.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase map, dependency graph, and sequencing constraints.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./STATUS.md, ./phases/
---

# PLAN — Phase Map & Sequencing

Each phase is independently shippable and leaves `make ci` green. Phases group
by theme and are ordered by dependency + risk + the no-backcompat thesis
(clean-cut shape work first; data-dependent machinery deferred).

## Dependency graph

```
            (aperture v12 landed on main)
                         │ final shape ↓
  Phase 1 ──► Phase 2 ───┼───► Phase 3 ──────► Phase 5 ──► (Phase 7, deferred)
  (repo/      (module     │     (doc            (relational  (schema-migration
   layer       splits)    │      schema          squash)      mechanism — pre-
   consistency)           │      cleanup)                     first-deploy gate)
                          │          └──► [SIBLING REFACTOR:
                          │                table-write-architecture-unification]
                          │                (heat-pumps onto registry + frontend)
  Phase 6 (pre-deploy hardening: pool + observability) — independent; run any time
```

> **Phase 4 was promoted out (D5)** to
> `planning/refactor/table-write-architecture-unification/`. It depends on
> Phase 3 here and runs in parallel with Phase 5 (independent surfaces).
> `phases/phase-04-*.md` is a redirect stub; 05/06/07 keep their numbers.

- **Phases 1, 2, 6 are complete** on the active backend-data branch.
- **Phase 3 is complete** on the active backend-data branch.
- **Phase 5 (squash) is complete** and now captures every schema-affecting
  change in one clean baseline.
- **Phase 7 is deferred** to the pre-first-deploy gate.

## Phases

### Phase 1 — Repository & layer consistency  *(WIP-safe, low risk)*
Move SQL-in-service into repositories (REPO-1: `assets`, `projects`,
`model_viewer`); standardize repo-return on dict+service-validate (D3); rename
`assets/schemas.py` → `models.py` (REPO-2); nits (REPO-4:
`create_session`→`insert_session`, route-conn helper → service, catalog
`_shared` SQL naming); write the unified conventions into
`CODING_STANDARDS.md`; draft (not yet enforce) the boundary-lint rules (D4).
→ `phases/phase-01-repository-layer-consistency.md`

### Phase 2 — Module splits  *(WIP-safe for the non-aperture set, low risk)*
Split `assets/service.py` (by workflow), `formula/evaluator.py` (single-cell vs
document-graph), `mcp/tools.py` (by domain). Defer `document.py` split to
Phase 3 and `heat_pumps.py` split to the sibling write-unification refactor
(they fall out of those efforts and both files are WIP-hot). Pure
behavior-preserving refactor.
→ `phases/phase-02-module-splits.md`

### Phase 3 — Document schema cleanup  *(complete; medium risk)*
Delete the read-time migration shims + blanket-stamp (DOC-5); collapse to one
current-schema validator; reset `schema_version` per D2; add the body-size 413
guard (DOC-1); single canonical serialization for etag+size (DOC-6); extract
the cross-table validator out of `document.py` into `document_validation.py`
(the `document.py` split). Reseed + regenerate fixtures at the new baseline.
→ `phases/phase-03-document-schema-cleanup.md`

### Phase 4 — Unify the table-write architecture  → **PROMOTED TO ITS OWN REFACTOR (D5)**
Cross-stack (heat-pumps frontend rewire) + distinct concern, so it moved to
`planning/refactor/table-write-architecture-unification/` (DOC-3, DOC-4). Covers:
fold heat-pumps onto the registered contract, one shared backend write spine,
drop the double-validate, and rewire the heat-pumps frontend client. Depends on
this folder's Phase 3; parallel-safe with Phase 5.
→ redirect stub: `phases/phase-04-unify-table-write-architecture.md`

### Phase 5 — Relational clean baseline  *(complete; medium risk)*
Squashed 43 migrations → one baseline (D1) with `naming_convention` + explicit
constraint/index names (REL-5); added `epw_asset_id` FK (REL-1); dropped the
dead `idx_user_table_views_project_lookup` (REL-6); added justified indexes
(`user_action_log(user_id, created_at)`, `project_versions(parent_version_id)`);
removed app-code imports from seed migrations by inlining seed literals
(REL-4); added climate-ref dangle tolerance coverage + doc note (REL-3);
enforced the boundary-lint from D4. Verified by fresh old-chain vs new-baseline
schema comparison.
→ `phases/phase-05-relational-clean-baseline.md`

### Phase 6 — Pre-deploy operational hardening  *(independent track; low–med risk)*
Pool sizing + lifespan + `check=` (POOL-1/2); `/ready` DB probe + pool stats +
`healthCheckPath` (OBS-1/5); JSONB hot-path timing (OBS-2); threshold slow-query
logging (OBS-3); R2 call timing (OBS-4); `user_id` contextvar binding (OBS-7);
memoize whole-document formula recompute (DOC-2, the one P1 perf item).
Operator note: enable `pg_stat_statements` + `log_min_duration_statement` on
Render (OBS-6). Not gated on the data-shape phases; included so the review's
operational recommendations aren't orphaned.
→ `phases/phase-06-predeploy-hardening.md`

### Phase 7 — Schema-migration mechanism  *(DEFERRED — pre-first-deploy gate)*
Decide read-time forward-only shim chain vs. Alembic body-rewrite; build the
golden-file corpus + roundtrip-idempotency CI + production-corpus drill
(`llm-mcp-schema.md` §10.5). **Do not build now** (YAGNI without data). This doc
exists to keep the obligation visible and to record that "bump `schema_version`"
stays a gated reseed operation until it ships.
→ `phases/phase-07-schema-migration-mechanism.md`

## Sequencing constraints

1. **Aperture v12 has landed before Phase 3.** Phase 3 should work against the
   final `document.py`, `tables/apertures.py`,
   `project_document/aperture_commands/*`, `project_document/apertures/*`,
   `assets/registry.py`, and `envelope/commands/registry.py` shape now present
   on `main`.
2. **Decisions are all resolved (D1/D2/D5, Ed 2026-06-24).** Phase 3 applies D2;
   Phase 5 applies D1; D5 moved to the sibling refactor. Phases 1–2 need none.
3. **Squash last among schema-touching work.** Run Phase 5 after Phase 3 so no
   later phase reopens the baseline. (Phase 3 and the sibling write-unification
   refactor don't change relational DDL, but Phase 5 also folds in REL-1's FK,
   so it wants to be the final DDL word.)
4. **One phase per PR, each green.** Per `CLAUDE.md` closeout gate: `simplify` +
   `docs-pass` on the diff, `make format`, `make ci` before each phase is
   "done." Reseed/fixture regen is part of the phase that changes the shape.

## Estimated shape (not a schedule)

Phases 1, 2, 6 are each ~1 session of mechanical work. Phase 3 is ~1–2
(validation is core). Phase 5 is ~1 but verification-heavy. Phase 7 is deferred.
The promoted sibling refactor (old Phase 4) is the deepest, ~2–3 sessions across
backend + frontend (heat-pumps cascade/preview must be preserved exactly).
Sequence, not calendar — driven by when the aperture WIP lands.
