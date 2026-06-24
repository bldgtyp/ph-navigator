---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Operationalize the table regression suite after implementation.
RELATED:
  - planning/archive/data-table-regression-suite/PLAN.md
  - context/technical-requirements/data-table.md
---

# Phase 07 - Run Policy And Documentation

> Split note: renumbered from Phase 06 when the original "deep links and view
> state" phase was split into Phase 05 (linked records) and Phase 06 (view
> state). Content is unchanged.

## Goal

Make the suite useful as a table-work tool without turning it into an
unreviewed drag on normal development.

## Planned Tasks

1. Measure smoke-suite runtime.
2. Measure full-suite runtime.
3. Record known flake points and whether they are app bugs, setup bugs, or
   browser-tool limitations.
4. Add package scripts if the command shape is stable.
5. Update `context/technical-requirements/data-table.md` with accepted
   tested behavior.
6. Update this planning packet's `STATUS.md` with actual verification
   evidence.
7. Decide whether any subset belongs in default CI.

## Candidate Commands

```bash
cd frontend && pnpm run test:e2e:tables:smoke
cd frontend && pnpm run test:e2e:tables
```

Exact scripts should not be added until the implementation phases show the
suite is stable enough to justify them.

## Completion Criteria

- The suite has documented run commands.
- The suite has documented runtime and stability notes.
- The default validation policy is explicit.
- Durable behavior contracts are folded into `context/technical-requirements`.

## Outcome (implemented)

### Runtimes (local stack, one worker)

| Tag | Tests | Wall-clock |
|---|---:|---:|
| `@table-harness` (no browser) | 16 | <1s |
| `@table-smoke` | 14 | ~8–20s |
| `@table-behavior` | 13 | ~32s |
| `@table-links` | 3 | ~10–17s |
| `@table-view-state` | 4 | ~28s |
| full `tests/e2e/table-regression` | 50 | ~1.4–2.9m |

### Package scripts (added)

`frontend/package.json`:

- `test:e2e:tables:smoke` → `playwright test tests/e2e/table-regression --grep @table-smoke`
- `test:e2e:tables` → `playwright test tests/e2e/table-regression`

(Per-tag runs use `--grep @table-behavior|@table-links|@table-view-state`.)
The dedicated agent account is the sign-in default (`signInForTables` →
`codex@example.com`), so the scripts need no baked-in credentials; override
with `E2E_EMAIL` / `E2E_PASSWORD`.

### Known flake points

- **`thermal-bridges` behavior add-row, full-directory run only** — one
  full 50-test run reported a lingering `modal-backdrop` intercepting the
  add-row click and "browser has been closed" (load/timing over the ~3min
  run). Every tag passes in isolation. Classification: **browser-tool /
  load limitation**, not an app bug — the same gesture is green in the
  isolated `@table-behavior` run. Mitigation: Playwright CI `retries: 2`
  already absorbs it; if it recurs locally, run per-tag rather than the
  whole directory.
- No other flakes observed across repeated isolated runs.

### CI decision

Keep the browser matrix **out of default CI for now**. Rationale: it needs
a running frontend + backend + Postgres and the seeded agent account, which
the current CI (`make ci`) does not provision, and the full run is minutes
long. `make ci` already covers the React-free `sharedEditContract` Vitest
seam, so the commit-time contract is guarded. Recommended future step
(separate from this feature): a dedicated CI job that boots the stack and
runs `test:e2e:tables:smoke` (~20s, highest signal-per-second) as a
required gate, with the heavier tags as an on-demand / nightly job.

### Contracts folded in

`context/technical-requirements/data-table.md` gained a "Regression
Coverage" section mapping each documented contract to its test tag, plus
the run policy; the stale "Linked-record / relation cells" Deferred entry
was struck (shipped + covered by `@table-links`).
