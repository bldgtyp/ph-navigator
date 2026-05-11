# `research/` — precedent and examples (NOT on the import path)

This folder holds POC artifacts that informed the V2 design — primarily
the catalog spike (week 0 → gate 2026-05-07). Copied verbatim from V1
for reference; **do not import or build against them.**

The V1 originals remain in place under `../ph-navigator/`; this is a
working copy so V2 can be developed without reaching across repos.

## Contents

| Folder | What's in it | V1 origin |
|---|---|---|
| `poc-plans/` | The 7 planning docs that gated the catalog POC | `ph-navigator/docs/plans/2026-05-06/` |
| `poc-sandbox/` | TanStack + AG Grid spike components | `ph-navigator/frontend/src/features/catalog/_components/` |
| `poc-tests/` | The 172 passing unit tests at gate | `ph-navigator/frontend/src/features/catalog/_components/__tests__/` |
| `poc-backend/` | Spike route for seed-data reads | `ph-navigator/backend/features/catalog/spike_routes.py` |

## What to use these for

- **Precedent.** Read `poc-sandbox/SandboxTanStack.tsx` and the phase
  helpers when designing the real `<DataTable>` (see
  `context/DATA_TABLE.md`). The lessons file
  (`poc-plans/poc-lessons-for-real-build.md`) is the canonical list
  of 25 design rules; `context/DATA_TABLE.md` §3 already cross-refs
  them.
- **Test scaffolding.** `poc-tests/sandboxPhase{3,4,5}.test.ts` show
  the level of unit coverage that landed for paste, fill, undo, view
  state. New `<DataTable>` extraction should at minimum preserve the
  shape of these tests.

## What NOT to use these for

- Don't `import` from `../research/...` in `frontend/src/` or
  `backend/`. The V2 dependency surface is different (Vite vs CRA;
  newer React; potentially different lockfiles). Rewrite the parts
  you need into V2's tree, don't reach into here.
- Don't update these files in place. They're frozen as-of the gate
  decision (2026-05-07). If you need a corrected copy, do it under
  `frontend/src/` or `backend/`.

## Original V1 locations (for archeological lookup)

See the per-file `V1 origin` column in `context/DATA_TABLE.md` §13.
