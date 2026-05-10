---
DATE: 2026-05-07
STATUS: Phase 2 (range selection + structured copy + row/column select)
        implemented and browser-verified
---

# Catalog POC — Weekly Notes

Running log of POC work. One section per session. Newest at top.
Pair with `airtable-parity-phases.md` (the operative vertical-slice
checklist), `catalog-poc-plan.md` (baseline setup + post-gate blocks),
and the PRD at `docs/features/2026-05-06-native-catalog-manager.md`.

## 2026-05-07 — Phase 4 single-select parity slice + browser verification

Tracker slice `NIM-4` landed in
`frontend/src/features/catalog/_components/SandboxTanStack.tsx`, with
single-select helpers extracted to
`frontend/src/features/catalog/_components/sandboxPhase4.ts` and Jest
coverage added in
`frontend/src/features/catalog/_components/__tests__/sandboxPhase4.test.ts`.
Ed verified the live browser behavior and confirmed the slice is working
as expected.

### Findings during the build (POC → real-build notes)

1. **A typed field-definition registry was the right architecture
   hinge.** Modeling `category` as `single_select` in `fieldDefs`
   unified renderer, editor, paste coercion, sort semantics, and option
   storage. This is the main architectural carry-forward from the
   phase.
2. **A small pure-helper module paid off again.** Extracting option
   match/create, palette assignment, contrast picking, and
   option-order comparison into `sandboxPhase4.ts` kept the sandbox
   editable while making the type-specific behavior testable in
   isolation.
3. **No select/autocomplete package was required for the parity
   answer.** A hand-built inline picker with search, arrow-key
   navigation, and create flow was enough to answer the UX question.
   For the real build, keep "no package by default" as the baseline and
   revisit only if a11y, reuse, or complexity justifies it.
4. **Sort semantics must be explicit per field type.** The first pass
   relied too much on inferred sorting and triggered a React
   concurrent-render recovery failure. Explicit comparators for number,
   text, and single-select fields fixed the issue cleanly and should be
   the real-build default.
5. **Single-select option creation must be a first-class undoable
   mutation.** Paste-aware create and inline create only behaved
   coherently because the history model tracked option-list mutations
   together with the cell writes that referenced them.
6. **Virtualized editor overlays need explicit stacking rules.** The
   picker initially rendered behind lower rows until the active row and
   editing cell received explicit stacking and overflow rules. This is
   not cosmetic trivia; it should become part of the table component's
   layering contract.
7. **The original Phase 4 plan over-scoped the proving case.** The
   shipped tracker slice answered the parity question with pills, inline
   picker/create, paste-aware auto-create, and the `Materials.category`
   proving case. The header-level option-management modal from the plan
   was intentionally deferred; it belongs more naturally with the later
   schema-editor / backend field-def CRUD work than with the parity
   proof itself.
8. **Browser verification caught the real layout failures.** Two bugs
   only became obvious in the live browser pass: the picker rendering
   behind the next row, and the frozen `name` body cell losing sticky
   positioning because an inline `position: relative` overrode the
   sticky class. Both are exactly the kind of integration bug this POC
   is supposed to surface before the real build.

### Validation

- ✅ `npm run format`
- ✅ `CI=true npm test -- --runInBand --watch=false sandboxPhase3.test.ts sandboxPhase4.test.ts`
- ✅ `npm run build`
- ✅ Browser verification by Ed: single-select pills, inline picker,
  inline create, paste-aware auto-create, and the follow-up render fixes
  all behaved as expected.

### POC-specific artifacts / choices to remember

- The current option set is intentionally in-memory only and seeded for
  `Materials.category`.
- Undo/redo currently includes option-list mutations because the POC had
  to prove the semantic model, not because the persistence contract is
  solved.
- The header-level field-definition option-management modal from plan
  §7.3 was intentionally deferred.

Curated lessons appended to `poc-lessons-for-real-build.md`. Tracker
item `NIM-4` had already been moved to `in-review`; this entry captures
the implementation and browser-verification learnings for the later real
build.

## 2026-05-07 — Phase 3 implementation + user verification

Phase 3 (Excel-style paste into a selected range, overflow row prompt,
fill-handle drag, bounded undo/redo, still in-memory only) landed in
`frontend/src/features/catalog/_components/SandboxTanStack.tsx`, with
pure clipboard/history helpers extracted to
`frontend/src/features/catalog/_components/sandboxPhase3.ts` and Jest
coverage added in
`frontend/src/features/catalog/_components/__tests__/sandboxPhase3.test.ts`.
Ed verified the behavior in the browser and confirmed it works as
expected.

### Findings during the build (POC → real-build notes)

1. **The right primitive was `before/after` cell writes, not a
   paste-specific or fill-specific state machine.** Once Phase 3 was
   modeled as `CellWrite[]` plus an operation envelope
   (`kind`, `summary`, `appendedRows`), inline edit, paste, fill, undo,
   and redo all shared the same write path. This is the strongest
   carry-forward architecture lesson from the phase.
2. **A small pure-helper layer paid for itself immediately.** The POC
   still evolves the sandbox in place, but extracting TSV parsing,
   paste-rectangle planning, and history-stack math into
   `sandboxPhase3.ts` made the behavior testable without mounting the
   whole table. This is the right intermediate step before the later
   real-build extraction to a reusable `<DataTable>`.
3. **No clipboard / drag / history package was required.** Native
   `copy` / `paste`, document-level pointer tracking from Phase 2, and
   a tiny history model were enough for the parity slice. Real-build
   default should remain "no package unless later requirements force
   one."
4. **Overflow row creation must be part of the same undoable action as
   the paste.** Treating row append + write set as one paste op made
   undo behavior feel right. Splitting them would have produced a
   confusing two-step revert. This should remain the real-build
   semantic rule even after persistence lands.
5. **`window.confirm` was the correct POC shortcut and the wrong
   production UI.** It let us test the row-overflow decision with
   effectively zero extra build time. Keep the decision point, replace
   the mechanism with an app modal in the real implementation.
6. **Fill-handle drag reuses the Phase 2 selection architecture.** The
   working path was not a new overlay library or a geometry package; it
   was the same document-level pointer tracking and DOM targeting
   approach already proven for range selection. That is a strong signal
   that selection and fill should share one controller in the later
   extraction.
7. **History bounded in memory is appropriate for the POC and only the
   POC.** The current 8-op stack, cleared on reload, is enough to answer
   the parity question. It is not a production conflict model. Before
   the real build ships, we still need explicit rules for refetch,
   backend failure, and concurrent edits.

### Validation

- ✅ `npm run format`
- ✅ `CI=true npm test -- --runInBand --watch=false sandboxPhase3.test.ts`
- ✅ `npm run build`
- ✅ Browser verification by Ed: paste, overflow add-rows, fill handle,
  undo, and redo all behaved as expected.

### POC-specific artifacts / choices to remember

- The current implementation is intentionally still centered in the
  sandbox file. Only the pure logic that benefited from tests was
  extracted.
- The overflow prompt currently uses native `window.confirm`.
- Undo/redo is intentionally local-only and resets on reload.
- The fill preview is rendered via per-cell styling, not a single global
  overlay. That was the lower-risk path inside the virtualized spike.

Curated lessons appended to `poc-lessons-for-real-build.md`. Tracker
item `NIM-3` was moved to `in-review` when the implementation landed;
browser verification is now complete.

## 2026-05-07 — Phase 2 implementation + browser verification

Phase 2 (contiguous range selection, structured TSV/HTML copy, sticky
row-gutter full-row select, header-strip full-column select, drag
auto-scroll) landed in
`frontend/src/features/catalog/_components/SandboxTanStack.tsx`. Ed
verified the smoke path in a real browser and confirmed the behavior is
working as expected.

### Findings during the build (POC → real-build notes)

1. **Row-select chrome belongs outside the schema column model.** The
   sticky left gutter was implemented outside TanStack's column model,
   which kept it out of reorder / resize / filter / copy semantics.
   This should be the real-build pattern too: operational chrome is
   table-shell concern, not backend field schema.
2. **Document-level drag tracking is the robust path under
   virtualization.** Selection drag used `document` `mousemove` /
   `mouseup`, `elementFromPoint()`, and a `requestAnimationFrame`
   auto-scroll loop. This held up while rows recycled under a cursor
   parked near the viewport edge. A pure cell-local hover model would
   have been brittle here.
3. **Structured copy is a matrix serializer, not a string join.** The
   working implementation writes both TSV (`text/plain`) and HTML
   (`text/html`) from the same cell matrix. Gutter numbers stay out of
   the payload. Full-column select prepends header labels. This is the
   baseline for the later paste path too.
4. **Selection perimeter and active-cell focus cannot share
   `box-shadow`.** The first pass used box-shadow for both and the
   focused selected cell lost its focus ring. Switching active-cell
   focus to `outline` solved it cleanly. Real build should preserve
   separate visual channels for focus vs. selection.
5. **POC divergence from the phase-plan wording:** the shipped Phase 2
   does **not** use a single absolutely-positioned overlay div. It uses
   per-cell edge styling to draw a contiguous rectangle. That choice was
   intentional for the POC because sticky gutter chrome + frozen first
   column + virtualized rows make overlay alignment a higher-risk path.
   For the real build, a true overlay can still be revisited as polish,
   but it is not required for the core architecture.
6. **No extra selection / clipboard package was needed at POC scale.**
   TanStack state + plain DOM events were enough for the Phase 2 slice.
   For the real build, don't add a package by default; revisit only if
   future phases (non-contiguous selection, touch/pen support, grouped
   range semantics) expose real pressure.

### Browser-test findings (Ed)

- ✅ Drag-range selection works and feels spreadsheet-like.
- ✅ `Shift` extension works.
- ✅ Row-gutter full-row select works.
- ✅ Header-strip full-column select works.
- ✅ Drag auto-scroll works.
- ✅ Structured paste into external tabular targets preserves shape.

Phase 2 marked complete 2026-05-07. Curated lessons appended to
`poc-lessons-for-real-build.md`; plan status updated in
`airtable-parity-phases.md` and `catalog-poc-plan.md`.

---

## 2026-05-07 — Phase 1 implementation pass

Phase 1 (active cell + keyboard nav + Enter-to-edit + frozen `name`
column + vertical auto-scroll + ⌘C single-cell copy) landed in
`frontend/src/features/catalog/_components/SandboxTanStack.tsx`. CRA
build passes (only pre-existing html2pdf.js source-map warning).
Awaiting Ed's manual browser walkthrough per phase plan §4.5.

### Findings during the build (POC → real-build notes)

These are the surprises and judgement calls captured while writing the
code. Fold into the real `<DataTable>` design when extracted.

1. **`activeCell.rowIndex` ties focus to the *visible* row position,
   not the underlying record.** When the user re-sorts the table, the
   focused cell stays at the same visual position and now points at a
   different record. AirTable keeps focus on the *record* across sort
   changes. Pragmatic for Phase 1; Phase 2+ should switch to
   `{rowId, colId}` indexing (rowId = stable record id once persistence
   lands). Worth doing in the real build from day one.
2. **The render-tree dependency from `cell` renderer → `editing` /
   `activeCell` state means the columns memo invalidates on every
   focus or edit change.** Acceptable at 405 rows; at 10k+ rows this
   may stutter. Real-build mitigation: pull focus and editing state
   *out* of the column def — do focus styling on the wrapping `<td>`
   (already done) and editing rendering via a separate cell-overlay
   component keyed by activeCell, so column defs are stable.
3. **Sticky positioning composes cleanly with TanStack-Virtual's
   `position: absolute` rows.** No special handling needed beyond
   `position: sticky; left: 0; z-index` on the frozen cell. The frozen
   header needed a higher z-index than non-frozen sticky headers so it
   layers correctly. Documented in the inline `<style>` block.
4. **HTML5 native `copy` event is the right hook for ⌘C.** A
   `keydown` handler matching ⌘C cannot synthesize a real
   `ClipboardEvent`; you'd have to use the async Clipboard API which
   is gated by user-activation rules. The `copy` event is the native
   path, fires synchronously, and gives `e.clipboardData`. The catch:
   we have to ignore it when there's a real text selection (otherwise
   we'd hijack the user's selection-copy intent). Guarded with
   `window.getSelection().toString().length > 0`.
5. **Tab key handling and the rest of the page.** Phase 1 captures Tab
   inside the table (preventDefault). This means the user cannot
   tab-out of the table without first pressing Esc. Acceptable for
   POC, marginal a11y issue for real build. Solution: when Tab would
   move past the last cell of the last row, *don't* preventDefault and
   let it escape to the next focusable element on the page.
6. **Container `tabIndex={0}` + `onKeyDown`** is a cleaner pattern
   than a `document` keydown listener. Keys only fire when the table
   region has focus; we don't have to filter by `e.target` against
   inputs elsewhere on the page. `onMouseDown` on the container also
   focuses the container, which means clicking any cell gives the
   container DOM focus and our state sets the visual focus.
7. **Hover and focus styling fight inline-style precedence.** Inline
   `style={{ background: rowBg }}` won out over `:hover` rules unless
   we used `!important` in the `<style>` block. Documented in the
   inline stylesheet. For the real `<DataTable>` extract, prefer
   either a stylesheet-only approach or CSS-in-JS to avoid this.
8. **No horizontal auto-scroll yet.** Vertical scroll-into-view via
   `rowVirtualizer.scrollToIndex` is one call. Horizontal needs to
   account for the frozen column's width and is annoying to do
   correctly. Deferred. If Ed's browser test reveals it's a problem,
   land it as a small follow-up before Phase 2.
9. **Existing spike features kept as-is.** Group-by-category toggle,
   category multi-select filter, column resize, HTML5 drag-reorder,
   conductivity-based row coloring, CSV export — all still work,
   untouched. Phase 5 will replace the filter / sort / group UI. Until
   then they're useful for testing focus + nav under real conditions.
10. **Build is clean.** CRA `npm run build` compiles with no new
    warnings beyond a pre-existing html2pdf.js source-map issue
    unrelated to this work.

### Browser-test findings (Ed) — first pass

- ✅ Active cell focus border, double-click to edit, keyboard nav, vertical
  scroll, hover highlight all good first-try.
- ❌ **Frozen `name` column header pinned but body cells scrolled with the
  rest of the table.** Cause: `styles.td` had `position: 'relative'` which
  inline-style-overrode the `position: sticky` from the `dt-frozen`
  className. Removed; sticky now wins. Real-build lesson: prefer a single
  source of truth for cell positioning — either an inline style flag or a
  className, not both. Mixing them creates these specificity traps.
- ❌ **Click-to-focus jumped to a "random" row.** Root cause was an
  index-namespace conflict. TanStack's `row.index` is the **original data
  index**, not the visual row position in the post-sort row model. The
  table is sorted by `conductivity_w_mk asc` by default, so the row at
  visual position 0 has `row.index = 287` (or whatever sorts first). The
  click handler captured `row.index` and stored it as `activeCell.rowIndex`;
  the auto-scroll effect then called `scrollToIndex(287)` which scrolled
  to whatever record happened to be at *visual position 287*. Same trap
  in `moveActive`, which incremented `rowIndex` arithmetically and clamped
  to `rowModel.length` — assuming visual semantics — but the click
  handler had populated rowIndex with data semantics.

  **Fix.** Standardize `activeCell.rowIndex` to mean **visual position in
  `rowModel`** (i.e. equivalent to `virtualRow.index`). Translate to data
  index only at the read/write boundary: `rowModel[visualIdx].original`
  for reads (clipboard, display), `rowModel[visualIdx].index` for writes
  (`setRows[dataIdx] = ...`).

  Side effect: had to hoist the editing `<input>` out of the column-def
  `cell` renderer (which only knows `row.index` = data index via TanStack's
  `info` argument) up to the `<td>` render loop (which knows `virtualRow.index`
  = visual position). That **also resolves finding #2** — the columns
  memo no longer needs to invalidate on every focus or edit change. The
  original concern is now an enforced architectural rule.

  **Real-build lesson** — the strongest one of Phase 1 so far:

  > **Decide a single source of truth for "which row" before writing any
  > cell-aware feature.** Visual position vs. data index vs. stable row-id
  > all look the same in code (`number`) but mean different things and
  > break differently under sort/filter/group. Pick one for state,
  > translate at the boundary. Stable row-id is the right long-run choice
  > once persistence is in (it survives sort *and* survives a re-fetch);
  > visual position is fine for in-memory POC; data index is a footgun.

### Browser-test findings (Ed) — re-test after fixes

✅ Frozen `name` column (header + body cells) stays pinned while the rest
scrolls horizontally. ✅ Click-to-focus lands on the clicked cell, no
jumping. ✅ ⌘C copies the focused cell value cleanly. **Demo passes.**

Phase 1 marked complete 2026-05-07. Load-bearing lessons consolidated to
`poc-lessons-for-real-build.md` for the eventual real build.

---


## How to resume if you got blocked / lost context

1. **Branch**: `poc/catalog` (pushed to `origin`).
2. **Read in this order**: this file's "Current state" section → plan
   §13 status checklist → `backend/features/catalog/README.md` for
   local-dev commands.
3. **Verify the local stack is alive**: `docker ps` should show
   `ph-navigator-postgres` healthy. From `backend/`:
   ```sh
   set -a && source .env && source .env.poc && set +a
   .venv/bin/python -c "
   import os, sqlalchemy as sa
   e = sa.create_engine(os.environ['CATALOG_POC_DATABASE_URL'])
   with e.connect() as c:
       print(c.execute(sa.text('SELECT current_database()')).scalar())
   "
   # → ph_navigator_catalog_poc
   ```
4. **Verify R2** still reachable — see "R2 smoke test" command at the
   bottom of this file.
5. **Verify the POC ping**: with `.env.poc` loaded, run uvicorn and hit
   `curl localhost:8000/api/catalog-poc/ping`. Expect 200.
6. **Open the next-action heading** in this file and continue from
   there.

## Current state — 2026-05-06 EOD

Week 0 mostly done. Branch `poc/catalog` is at commit `bb2e299` (pushed).

### What's in place

- **Branch** `poc/catalog` off `main` (pushed to GitHub).
- **Backend module** `backend/features/catalog/` — `routes.py` with
  `/api/catalog-poc/ping`, empty `models/` `schemas/` `migrations/` for
  later, `poc_seeds/airtable_export/` (gitignored, holds CSVs).
- **Flag-gated mount** in `backend/api.py` — catalog router only loaded
  when `settings.CATALOG_POC_ENABLED` is truthy. Lazy import inside the
  branch keeps the module out of the import graph when off. Verified
  flag-off → 404, flag-on → 200.
- **Cross-import lint** — `backend/tests/test_catalog_isolation.py` —
  AST walk that asserts (a) `features.catalog` does not import from
  any other `features.<x>`, (b) other features do not import from
  `features.catalog`, (c) `api.py` only references `features.catalog`
  inside the flag-gated block. Verified the test catches a deliberately
  injected violation.
- **Frontend route** `/catalog-poc` — placeholder component pinging the
  backend, not linked from main nav.
- **`.env.poc.example`** template + **`.env.poc`** real values
  (gitignored).
- **`backend/scripts/create_poc_db.sh`** — idempotent helper for the
  second Postgres DB.
- **`backend/features/catalog/README.md`** — local-dev setup guide.
- **AirTable CSVs** at `backend/features/catalog/poc_seeds/airtable_export/`:
  - `Material Data-Grid view.csv` (405 rows)
  - `Frame Data-ALL DATA.csv` (189 rows)
  - `Glazing Data-ALL DATA.csv` (40 rows)
- **Cloudflare account** activated under `phtools@bldgtyp.com`. Two R2
  buckets: `ph-data-poc` (POC scope) and `ph-data` (reserved). R2 API
  token scoped to `ph-data-poc` only. CORS on `ph-data-poc` allows
  `localhost:3000` PUT/GET/HEAD. Account ID:
  `f9d264cceb6b9b13ad80ff784318975f`.
- **POC Postgres DB** `ph_navigator_catalog_poc` exists on the
  `ph-navigator-postgres` container (server 15.13). SQLAlchemy
  round-trip verified.
- **`boto3==1.43.5`** added to `backend/requirements.txt`.

### Commits on this branch

```
bb2e299 Fix create_poc_db.sh psql connection target
928eacf Scaffold catalog POC behind CATALOG_POC_ENABLED flag
21df4a0 Add Native Catalog Manager PRD
```

### Next action — AG Grid Community spike (plan §3.3)

Sequential approach decided: full React+TS prototype each, not static
pages.

1. Add `ag-grid-react` + `ag-grid-community` to `frontend/package.json`.
2. Add a backend route `GET /api/catalog-poc/_spike/materials` that
   reads `poc_seeds/airtable_export/Material Data-Grid view.csv` and
   returns it as JSON. **DB-independent on purpose** — the spike does
   not need persistence; it is purely a UI feel test. Persistence
   lands in week 2.
3. Build `/catalog-poc/sandbox-aggrid` exercising the six §3.3
   behaviors against the 405-row Materials data:
   - Render all visible fields
   - Inline-edit a text cell + a number cell
   - Filter on a select column (`category`)
   - Sort on a numeric column (`conductivity_w_mk`)
   - Resize + reorder a column
   - Group by `category`
4. Capture findings in `docs/plans/2026-05-06/grid-spike-results.md`.
5. Repeat the equivalent for TanStack Table at
   `/catalog-poc/sandbox-tanstack`.
6. Pick one. Delete the loser's route + deps. Commit.

### Blocking nothing — Ed can pause and resume cleanly

Local stack survives a reboot (Docker auto-restarts the postgres
container). R2 credentials live in `.env.poc` which is gitignored
and Dropbox-synced. The only piece of state that is in-flight and
not-yet-in-git is the plan/notes files (gitignored under `docs/plans/`)
which Dropbox-syncs anyway.

---

## Lessons learned (2026-05-06)

Captured here so we don't repeat them when the real implementation
begins. Fold the load-bearing ones back into the PRD or this plan as
appropriate.

### `.env.poc.example` is committed; `.env.poc` is not

Both files were created from scratch this session. `.env.poc.example`
is the tracked template (intentionally) and `.env.poc` is the
gitignored real-credentials file (gitignored via line 34 of
`.gitignore`). On first credential entry the values went into
`.env.poc.example` and would have been pushed to the public repo if
not caught before commit. The template was restored to placeholders
and the R2 token was rotated as a precaution.

**Takeaway**: when migrating to the real implementation, keep this
two-file pattern but consider adding a pre-commit hook that flags any
non-empty value after `=` in any `*.example` file.

### `psql -U <user>` defaults the database to `<user>`

`docker exec ... psql -U ph_navigator_user` failed with
`database "ph_navigator_user" does not exist` — psql defaults the DB
to the username when `-d` is omitted. The `create_poc_db.sh` script
now passes `-d ${POSTGRES_DB:-postgres}` explicitly.

**Takeaway**: any future psql-against-container scripts must pass `-d`
even for "trivial" connectivity checks. Not a POC-specific lesson.

### The docker-compose `db` service uses a non-default user

`backend/.env` defines `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB` (non-default values) which docker-compose substitutes
into the `db` service. The POC DATABASE_URL must reuse those exact
credentials, not the conventional `postgres:postgres`.

**Takeaway**: the real-implementation `.env.example` should make this
explicit, and `create_poc_db.sh` reads `POSTGRES_USER` from the
environment for exactly this reason.

### Materials is NOT the attachment-heavy table

Plan §13.2 originally picked Materials as the POC table on the
assumption that it had "the most attachment activity." Empirically
(see plan §3.4.1), Materials has 6/405 attachments (~1.5%). Frames has
159/189 (~84%). Materials remains the right *primary* POC table
(highest field count, most categories, hardest UX case for table
behavior), but Frames is the table for the week-5 attachment work
(plan §8.3) and the week-6 second-table reusability check (plan §9.1).

**Takeaway**: when running the real migration in PRD §9, Frames is the
hardest real-data attachment case — plan accordingly.

### AirTable base/table IDs were swapped in the original plan §2

The original plan §2 had Materials and Apertures base IDs swapped vs.
`backend/config.py`. Corrected 2026-05-06. No downstream impact (CSVs
were pulled by the user manually, not by ID lookup).

**Takeaway**: when plans cite IDs that exist in code, cross-check
against the code at write time, not just at execution time.

### `docs/plans/` is gitignored

Project-level convention (older `.gitignore` rule) keeps planning docs
Dropbox-synced but not git-tracked. The PRD lives at `docs/features/`
which is tracked. This plan and these notes are local-only +
Dropbox-only. The `CLAUDE.md` line that says "ALL Planning documents
should be saved as Markdown files in `docs/plans/`" predates the
gitignore rule and is in mild conflict with it. Convention chosen
2026-05-06 was to honor the gitignore.

**Takeaway**: when doc that needs to be shared with a non-Dropbox
collaborator (CI, future contractor) becomes load-bearing, force-add
it explicitly. Don't change the global rule.

---

## Useful commands snapshot (2026-05-06)

### Run the backend with POC flag on

```sh
cd /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend
set -a && source .env && source .env.poc && set +a
.venv/bin/uvicorn main:app --reload
```

### Run the cross-import lint

```sh
cd /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend
.venv/bin/python -m pytest tests/test_catalog_isolation.py -v
```

### R2 smoke test

```sh
cd /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend
set -a && source .env.poc && set +a
.venv/bin/python -c "
import os, boto3
endpoint = f\"https://{os.environ['CATALOG_POC_R2_ACCOUNT_ID']}.r2.cloudflarestorage.com\"
s3 = boto3.client('s3', endpoint_url=endpoint,
    aws_access_key_id=os.environ['CATALOG_POC_R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['CATALOG_POC_R2_SECRET_ACCESS_KEY'],
    region_name='auto')
print('list ph-data-poc:', s3.list_objects_v2(Bucket='ph-data-poc').get('KeyCount', 0), 'objects')
"
```

### Recreate the POC DB if Docker volumes were wiped

```sh
cd /Users/em/Dropbox/bldgtyp-00/00_PH_Tools/ph-navigator/backend
docker compose -f docker-compose.yml up -d db
set -a && source .env && set +a
scripts/create_poc_db.sh
```
