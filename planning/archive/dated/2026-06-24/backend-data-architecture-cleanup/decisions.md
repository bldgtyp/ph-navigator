---
DATE: 2026-06-24
TIME: 22:35 EDT
STATUS: Complete / archived — D1, D2, D5 resolved and executed; D3/D4 pre-resolved and enforced.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: The forks that shape the phases. Recommendations given; confirm before Phase 3+.
RELATED: ./PRD.md, ./PLAN.md
---

# Decisions

Each has a **Recommendation** (my default, used by the phase docs as written)
and the **alternative** it displaces. Mark `RESOLVED: <choice> (Ed, <date>)`
when confirmed. Phases 1–2 do not depend on any open decision; **D1/D2/D5 gate
Phases 3–5.**

## D1 — Squash the 43 migrations into one clean baseline? `RESOLVED: YES (Ed, 2026-06-24)`

**Recommendation: YES.** With no deployed DB, collapse `0001`–`0043` into a
single `0001_baseline` that reflects the current end-state schema, authored
with a `MetaData(naming_convention=...)` and explicit constraint names from the
start. This deletes all rename/flatten/revert/body-rewrite churn (`0014`–`0017`,
`0021`, `0027`–`0031`, `0036`, `0040`, `0043`) and the two app-code-importing
seed migrations (`0038`/`0041`) in one move, and bakes in REL-1/REL-4/REL-5/REL-6.

- **Verification gate:** `pg_dump --schema-only` of a fresh `upgrade head` must
  diff-clean against the same dump taken from the current `0043` head *before*
  the old chain is deleted. Old chain stays in git history.
- **Alternative:** keep the chain, add corrective migrations (a new
  `naming_convention`, the `epw_asset_id` FK, drop the dead index). Less clean,
  leaves the churn and the app-code imports in history-as-truth.
- **Cost if deferred:** after a deploy this becomes effectively impossible
  (the baseline must match a live DB's applied history).

## D2 — Reset `schema_version` to 1 and delete the read-time shims? `RESOLVED: YES — reset to 1 + delete shims (Ed, 2026-06-24)`

**Recommendation: YES (reset to 1) + delete shims.** `schema_version` is at 12
purely from dev reseed-and-bump churn. Delete `_migrate_v11_aperture_refs` and
`_migrate_legacy_manufacturer_filters` (no data to migrate), collapse to a
single current-schema validator, set `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION =
1`, and regenerate dev seed + fixtures at v1. This also erases the DOC-5
"blanket-stamp" bug by construction.

- **Minimum (if reset feels gratuitous):** keep `= 12`, but still delete the
  shims and the blanket-stamp; keep only the current-schema validator. The dead
  code is the real problem; the renumber is the tidiness bonus.
- **Alternative:** keep shims "just in case" — rejected; they are
  unmaintained, incomplete (DOC-5), and there is nothing to migrate.
- **Dependency:** must land **after** the aperture v12 WIP (it owns the v11→v12
  transform the shims currently carry). Sequenced in Phase 3.

## D3 — Repo-return convention. `RESOLVED: repo→dict, service validates`

Repositories return raw `dict[str, Any]` / scalars; `model_validate()` happens
in the service layer. This is the existing majority convention (review REPO-2).
`features/assets/` is the lone deviation and is brought into line (and its
`schemas.py` renamed to `models.py`). Documented in `CODING_STANDARDS.md` in
Phase 1. No alternative pursued.

## D4 — Add feature-shape + import-boundary lint? `RESOLVED: YES`

After the SQL-in-service leaks (REPO-1) and the `assets` naming (REPO-2) are
fixed, add CI checks: (a) every feature package has the required layer files (or
a documented thin-feature exemption); (b) `routes.py` must not import
`database`; `repository.py` must not import FastAPI. Lands at the tail of
Phase 1 (rules written) and is enforced from Phase 5 onward once all violations
are cleared. Keeps the cleanup from regressing.

## D5 — Scope of the write-architecture unification (DOC-4). `RESOLVED: YES, and PROMOTED to its own refactor (Ed, 2026-06-24)`

> **Promoted out.** Ed agreed to the unification *and* to breaking it out as a
> separate refactor, since it is cross-stack (significant heat-pumps frontend
> rewire — verified: `src/features/equipment/heat-pumps/{api,payload-builders,
> types}.ts` is bespoke) and a distinct concern (write-path architecture, not
> DB-schema). It now lives at
> `planning/refactor/table-write-architecture-unification/`. This folder's
> `phases/phase-04-*.md` is a redirect stub; the scope decision below is the
> agreed shape, carried into the sibling refactor's PRD.

**Agreed shape: unify heat-pumps onto the registered table-contract surface;
keep the aperture/envelope semantic-command paths but extract their shared
plumbing.** Heat-pumps is an *unjustified* exception — it is CRUD over four
sub-tables and belongs on the generic `replace_table_slice` surface like every
other equipment table. The aperture-command and envelope-command paths are
*legitimately* different (merge/split, paste, refresh-from-catalog,
manufacturer-filter — semantic operations, not row replacement); they should
stay, but their duplicated draft-load / ETag-check / size-guard / validation
plumbing should move into one shared helper so all write paths share one
spine.

- **Alternative A (narrower):** unify heat-pumps only; leave aperture/envelope
  plumbing as-is. Acceptable but leaves three near-duplicate ETag/draft blocks.
- **Alternative B (broader):** force aperture/envelope commands into the table
  contract too — rejected; it would distort genuine semantic operations into
  awkward row-replacement.
- **Dependency:** after the aperture v12 WIP (it is actively changing the
  aperture-command path). Sequenced in the sibling
  `table-write-architecture-unification` refactor.
