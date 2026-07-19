---
DATE: 2026-07-19
TIME: 14:30 EDT
STATUS: Accepted planning contract — implementation not started
AUTHOR: Codex with Ed May
SCOPE: Product, persistence, compatibility, and rollout contract for canonical
  specification status `needed`.
RELATED:
  - ./README.md
  - ./decisions.md
  - ./research.md
  - ./PLAN.md
---

# PRD — Specification-status value unification

## Goal

Use one user-facing specification-status vocabulary across Materials,
Glazings, Frames, Equipment, Thermal Bridges, Documentation, and Status:

| Canonical meaning | Display label |
| --- | --- |
| `complete` | Complete |
| `needed` | Needed |
| `question` | Question |
| `na` | N/A |

The built-in literal contract used by Materials/Glazings/Frames must no longer
use `missing`. Equipment/Thermal Bridges retain their equivalent stable option
ids, including `opt_status_needed`.

## Current problem

Materials/Glazings/Frames currently use
`complete | missing | question | na`. Documentation and Status feeds translate
`missing` to `needed`; Materials labels it Needed while still storing
`missing`; Apertures still visibly labels it Missing. Documentation editor
writes translate `needed` back to `missing` for these three built-in tables.

That creates four contracts for one state:

- built-in project-document value: `missing`;
- DataTable option id: `opt_status_needed`;
- summary API value: `needed`;
- visible label: either Missing or Needed depending on the surface.

## Canonical internal contract

After the v8 cutover:

- Backend `SpecificationStatus` is
  `Literal["complete", "needed", "question", "na"]`.
- Frontend Envelope and Apertures `SpecificationStatus` unions match it.
- Current typed document reads and current saves contain `needed`, never
  `missing`, at `tables.project_materials[*].specification_status`,
  `tables.project_glazings[*].specification_status`, and
  `tables.project_frames[*].specification_status`.
- Documentation and Status summary code passes canonical built-in values
  through; custom-status option ids continue through their explicit option-id
  adapters.
- Shared status widgets use a `needed` status/tone key and
  `--report-status-needed: #d97706`. The existing missing token becomes
  `--report-status-missing: var(--report-status-needed)` for unchanged Climate
  and other non-status consumers.

## Historical and external compatibility

The word/value `missing` remains valid only in named compatibility contexts:

1. Frozen v7 fixtures and raw downloads of historical saved versions.
2. `_upgrade_v7_to_v8`, which recognizes the legacy stored value.
3. A transitional request adapter for old/cached PH-Navigator clients.
4. External Honeybee reference metadata. Installed `honeybee_ref` accepts
   `COMPLETE | MISSING | QUESTION | NA`, not `NEEDED`.
5. Generic non-status meanings such as missing evidence, a missing catalog row,
   missing geometry, or missing climate data.

These exceptions must be named and tested; they are not alternate canonical
PH-Navigator states.

## Project-document migration contract

Use `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 8` and a pure forward upgrader:

- input: schema v7 raw dict;
- rewrite only `"missing"` → `"needed"` in the three row lists named above;
- preserve `complete`, `question`, `na`, defensively preserve already-`needed`,
  and preserve every valid unrelated key/value, row order, and id;
- stamp schema v8;
- validate once against the current Pydantic model;
- remain idempotent.

Historical saved rows remain immutable and raw download remains raw. Typed
reads upgrade in memory. Stale drafts may be rewritten by the existing draft
upgrade path and receive a new draft ETag. Save overwrites an unlocked selected
version with current schema; Save As creates a new current-schema version.

No Alembic JSONB update and no bulk production-row rewrite belong in this
refactor.

## Release contract

Use an expand/contract rollout because the production workflow deploys API and
web separately:

- Compatibility release (schema v7): backend mutation boundaries accept both
  values but normalize to v7 `missing`; frontend reads tolerate both, displays
  Needed everywhere, and continues emitting legacy `missing`. If production is
  still v6, this compatibility work ships with the already-required v7 corpus,
  write-freeze, and rollback gate rather than assuming v7 is already live.
- Canonical release (schema v8): upgrader/domain use `needed`; backend still
  accepts cached-client `missing` at one named request boundary; frontend emits
  `needed`.
- Cleanup release: remove temporary PH-Navigator-client adapters only after Ed
  and John have refreshed and the agreed cache/observation window has passed.
  Permanent Honeybee/file-format adapters remain.

## Production-project contract

Before the canonical release, identify both production projects by name/id and
record, for every saved version and every user draft:

- version/draft id, owner where applicable, active/locked state, schema version,
  persisted `draft_etag`, persisted `base_version_etag`, candidate-derived saved
  document ETag, body size, and target-value counts;
- candidate upgrade result, applied steps, validation result, and preview hash;
- exact semantic diff count at the three permitted paths.

Raw production artifacts stay under gitignored `working/`; planning docs record
only ids/counts/hashes and gate outcomes. Resolve active drafts deliberately,
close old tabs, pause writes, and record a verified database restore point
before deployment.

## Acceptance criteria

1. All in-scope specification-status UI surfaces display Complete / Needed /
   Question / N/A; Apertures no longer displays Missing as a
   specification-status label. Evidence-only controls keep their smaller set.
2. Current backend/frontend built-in status contracts use `needed` and current
   PH-Navigator writes never persist `missing`.
3. A frozen v7 body upgrades through v8 with an exact, idempotent diff limited
   to schema version plus the three permitted row paths.
4. All saved versions and drafts belonging to both production projects pass the
   candidate upgrader before deploy. For pre-v7 bodies, the accepted existing
   chain is verified source → v7, then the v7 intermediate → v8 exact diff and
   replacement counts reconcile independently.
5. Equipment/Thermal Bridges retain `opt_status_needed`; summary APIs still
   return semantic `needed` for those tables.
6. Documentation built-in writes emit `needed`; its response-only `unknown`
   sentinel remains and presents/writes as Needed.
7. Status-summary and documentation-summary built-in `missing → needed`
   translation tables are removed; pass-through behavior is tested.
8. Legacy Honeybee/HBJSON `MISSING` imports as internal `needed`; both the
   hand-built native HBJSON material-ref export and rich Honeybee/Grasshopper
   export write external `MISSING`; native current round-trips preserve
   internal meaning.
9. MCP and GH API current typed outputs expose `needed`, except the named rich
   Honeybee reference adapter.
10. Compatibility and canonical releases each pass focused gates plus full
    `make ci`; the v8 candidate passes fixture, local/staging DB, and production
    corpus audits.
11. Both production projects pass authenticated read-only smoke after deploy;
    later ordinary Save/Save As persists v8 without a forced historical rewrite.
12. Rollback/roll-forward evidence records whether any v8 draft/version has
    been persisted and whether candidate Alembic/config changes remain
    backward-compatible with the previous SHA. No one redeploys v7 code across
    either boundary without a compatible DB/config state, DB restore, or
    reviewed repair.

## Non-goals

- Unifying every status table onto one storage representation.
- Rewriting all historical saved bytes to v8.
- Renaming generic grammatical uses of `missing`.
- Changing status colors.
- Combining status-pill CSS systems during the data migration.
- Removing old-schema upgraders or frozen fixtures.
