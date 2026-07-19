---
DATE: 2026-07-19
TIME: 10:30 EDT
STATUS: Phase 00 evidence complete
AUTHOR: Codex
SCOPE: Classified status surface inventory and schema-baseline evidence.
RELATED:
  - ./phases/phase-00-contract-baseline.md
  - ./research.md
  - ./STATUS.md
---

# Phase 00 inventory

## Baseline evidence

| Evidence | Result |
| --- | --- |
| Starting implementation branch/SHA | `codex/documentation-page-redesign` / `753379bf` |
| Current schema constant/model | v7 |
| Upgrade chain | contiguous through `_upgrade_v6_to_v7` |
| Fixture inputs | four: v1 and v4 empty/representative bodies |
| Current generated fingerprint | `3e9e579a198ee52bec2bb80542a48e6c02cc6d661b6e31bdd32285f3455813e7` |
| Previous committed guard | v6 / `36e16de386ee3789260073c5ef06477a0bda6e41655c7579db0aeb177aa132db` |
| Guard correction | v7/hash only; fixture inputs, expected outputs, models, and status semantics unchanged |

## Production release evidence

Read-only public checks at 2026-07-19 10:29 EDT found:

- `GET https://api.ph-nav.com/api/v1/version` reports production SHA
  `2060194272775684c890e770a3d30e0037e6b7eb`;
- the latest successful `Deploy Production` workflow run (`29623256739`)
  targeted the same SHA and completed 2026-07-18;
- deployed SHA `20601942` declares project-document schema v4 and has upgrade
  steps only through v4;
- `https://www.ph-nav.com/version.json` currently returns the SPA HTML, so the
  frontend SHA is inferred from the pinned successful workflow rather than
  independently proven by a build marker;
- anonymous `GET /api/v1/projects` returns `401`, as required;
- the existing authenticated production dashboard identifies exactly two live
  projects without mounting an editor route; their names/ids are recorded only
  in the gitignored operator worksheet.

Therefore Compatibility Release A must also carry the existing v4 → v7
upgrade chain and its corpus/write-freeze/rollback controls. It must not assume
production is already v6 or v7. Phase 01's build marker is required before a
future deploy can independently prove the web SHA.

## Status-hit classification

The inventory command is intentionally scoped to status symbols and known
boundaries:

```bash
rg -n \
  'SpecificationStatus|specification_status|typedSpecificationStatus|ReportStatusKey|report-status-(missing|needed)|data-(status|tone)|opt_status_needed|REF_STATUS|MISSING' \
  backend frontend
```

### A. Canonical v8 targets

These uses currently encode PH-Navigator's built-in v7 `missing` status and
must move to `needed` in Phases 02–03:

- backend domain/defaults: `project_document/envelope_models.py`;
- backend producers: `envelope/commands/materials.py`,
  `project_document/apertures/_ref_helpers.py`,
  `envelope/import_planning.py`, and `seeds/project/assemblies.json`;
- summary shims: `project_document/documentation_summary.py` and
  `project_document/status_summary.py`;
- frontend unions/controls: `features/envelope/types.ts`,
  `MaterialsPanel.tsx`, `features/apertures/types.ts`, and
  `ApertureSpecReportPanel.tsx`;
- Documentation legacy write adapter: `features/documentation/hooks.ts`;
- status-semantic keys/tone/data attributes: shared report-table components,
  `StatusSelect`, and their focused CSS consumers.

### B. Temporary PH-Navigator compatibility

Phase 01 must name and test these compatibility directions while v7 remains
canonical:

- backend public mutation inputs accept `needed` and normalize to `missing`;
- frontend response boundaries accept either spelling;
- frontend built-in writes continue serializing `missing`;
- Materials and Apertures display Needed for the v7 value.

These adapters do not yet exist as a single boundary. Existing component-level
legacy writes are targets to centralize, not permanent alternate semantics.

### C. Permanent external format compatibility

- `envelope/hbjson_import.py` recognizes legacy Honeybee `MISSING`/`missing`;
- native HBJSON and rich Honeybee/GH exports must map internal `needed` to
  external `MISSING` because `honeybee_ref` does not accept `NEEDED`;
- MCP and native current GH typed outputs are PH-Navigator contracts and become
  canonical `needed`; they are not Honeybee exceptions.

### D. Frozen historical evidence

- v1/v4 fixture inputs remain immutable historical inputs;
- their expected outputs currently prove the accepted chain to v7;
- Phase 02 adds a frozen v7 input/expected-v8 pair covering all three target
  lists. Old inputs must not be regenerated to remove `missing`.

### E. Stable custom-option storage

`opt_status_needed` is intentional and unchanged in Equipment, all four Heat
Pump leaves, and Thermal Bridges. Relevant sources include
`project_document/tables/_status_field.py`, the equipment/TB seed JSON files,
frontend option fixtures, and DataTable regressions.

### F. Unrelated grammatical/data state

Do not rename generic missing-material references, absent evidence/photos,
missing geometry/catalog/climate data, validation errors, or option-absence
tests. `--report-status-missing` remains as an alias for unchanged Climate and
other non-status consumers after the status-semantic consumers move to
`--report-status-needed`.

## Deferred production-body inputs

Per-version persisted schema counts and open-draft counts were not available
from the dashboard list. Neither editor route was mounted because doing so can
invoke draft-summary behavior. Compatibility A must obtain those counts through
its read-only predeploy corpus audit before any v4 → v7 production rollout.

No production database audit or production write was performed.
