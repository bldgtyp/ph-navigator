---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Active — planning.
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
            (in-flight: aperture v12 WIP — external)
                         │ must land first ↓
  Phase 1 ──► Phase 2 ───┼───► Phase 3 ──► Phase 4 ──► Phase 5 ──► (Phase 7, deferred)
  (repo/      (module     │     (doc        (write-     (migration   (schema-migration
   layer       splits)    │      schema      arch        squash)      mechanism — pre-
   consistency)           │      cleanup)    unify)                   first-deploy gate)
                          │
  Phase 6 (pre-deploy hardening: pool + observability) — independent; run any time
```

- **Phases 1, 2, 6 are WIP-independent** (they touch non-aperture files) and can
  start immediately, in any order.
- **Phases 3, 4 are blocked on the aperture v12 WIP** landing (they edit
  `document.py`, the registries, and write paths the WIP owns). See "Sequencing
  constraints" below.
- **Phase 5 (squash) goes near last** so the baseline captures every
  schema-affecting change (only REL-1's FK is a relational DDL change; the rest
  is app code / JSONB body).
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
Phase 3 and `heat_pumps.py` split to Phase 4 (they fall out of those phases and
both files are WIP-hot). Pure behavior-preserving refactor.
→ `phases/phase-02-module-splits.md`

### Phase 3 — Document schema cleanup  *(after aperture WIP; medium risk)*
Delete the read-time migration shims + blanket-stamp (DOC-5); collapse to one
current-schema validator; reset `schema_version` per D2; add the body-size 413
guard (DOC-1); single canonical serialization for etag+size (DOC-6); extract
the cross-table validator out of `document.py` into `document_validation.py`
(the `document.py` split). Reseed + regenerate fixtures at the new baseline.
→ `phases/phase-03-document-schema-cleanup.md`

### Phase 4 — Unify the table-write architecture  *(after aperture WIP; higher risk)*
Fold heat-pumps add/replace/delete + cascade + dry-run preview onto the
registered table-contract `apply_replace` surface; remove the bespoke
`apply_patch`/`JsonPatchOp` service (DOC-4, D5); the `heat_pumps.py` split falls
out here; drop the heat-pumps double-validate (DOC-3); extract the shared
draft/ETag/size plumbing so aperture/envelope semantic commands share one spine;
make the Phase-3 size guard apply through the single write boundary.
→ `phases/phase-04-unify-table-write-architecture.md`

### Phase 5 — Relational clean baseline  *(near-last; medium risk)*
Squash 43 migrations → one baseline (D1) with `naming_convention` + explicit
constraint names (REL-5); add `epw_asset_id` FK (REL-1); drop the dead
`idx_user_table_views_project_lookup` (REL-6); add justified indexes
(`user_action_log(user_id, created_at)`, `project_versions(parent_version_id)`);
remove app-code imports from seed migrations (REL-4, moot if squashed);
climate-ref dangle tolerance + doc note (REL-3). Enforce the boundary-lint from
D4. Verify by schema-dump diff.
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

1. **Aperture v12 WIP must land before Phases 3 & 4.** The working tree shows
   active edits to `document.py`, `tables/apertures.py`,
   `project_document/aperture_commands/*`, `project_document/apertures/*`,
   `assets/registry.py`, and `envelope/commands/registry.py`. Starting 3/4
   before that merges guarantees conflicts. Phases 1, 2, 6 avoid these files.
2. **D1/D2/D5 confirmed before their phases.** Phase 3 needs D2; Phase 4 needs
   D5; Phase 5 needs D1. Phases 1–2 need none.
3. **Squash last among schema-touching work.** Run Phase 5 after Phase 3/4 so
   no later phase reopens the baseline. (Phases 3/4 don't change relational DDL,
   but Phase 5 also folds in REL-1's FK, so it wants to be the final DDL word.)
4. **One phase per PR, each green.** Per `CLAUDE.md` closeout gate: `simplify` +
   `docs-pass` on the diff, `make format`, `make ci` before each phase is
   "done." Reseed/fixture regen is part of the phase that changes the shape.

## Estimated shape (not a schedule)

Phases 1, 2, 6 are each ~1 session of mechanical work. Phase 3 is ~1–2
(validation is core). Phase 4 is the deepest, ~2–3 (heat-pumps cascade/preview
must be preserved exactly). Phase 5 is ~1 but verification-heavy. Phase 7 is
deferred. Sequence, not calendar — driven by when the aperture WIP lands.
