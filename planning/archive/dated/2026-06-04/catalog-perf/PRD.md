---
DATE: 2026-06-04
TIME: 09:00 ET
STATUS: PRD — requirements locked. Per-phase implementation plans live
        under `phases/phase-NN-short-title.md`. Implementation has not
        started.
AUTHOR: Claude (Opus 4.7)
SCOPE: Reduce the perceived sluggishness on the Materials Catalog
       page, surfaced in the 2026-06-04 performance review, by
       fixing the underlying cross-cutting causes: uncompressed JSON
       payloads, an unvirtualized `DataTable` body, an unnecessary
       round-trip on the "Show deactivated" toggle, an over-broad
       list payload, and the lack of a pagination contract. Each
       phase is independently shippable.
NON-GOALS:
  - Auth pipeline optimization (separate review track; see trigger
    review §5).
  - Replacing or rewriting `DataTable`. Virtualization integrates
    with the existing component; no fork, no parallel grid.
  - Switching JSON encoder to `orjson`. Worth doing globally; not
    needed to fix this perceived problem.
  - Backend response cache for catalog GETs. Premature once gzip +
    virtualization land.
  - Server-side filter/sort/group. Client-side is sufficient at
    current row counts; pagination phase reopens this only if
    needed.
RELATED:
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md
  - context/CODING_STANDARDS.md
  - context/PRD.md §11.3 (Data Tables)
  - context/technical-requirements/data-table.md
  - backend/main.py
  - backend/features/catalogs/materials/routes.py
  - backend/features/catalogs/materials/service.py
  - backend/features/catalogs/materials/repository.py
  - backend/features/catalogs/materials/models.py
  - frontend/src/features/catalogs/routes/MaterialsCatalogPage.tsx
  - frontend/src/features/catalogs/hooks.ts
  - frontend/src/features/catalogs/api.ts
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/features/equipment/components/RoomsTable.tsx (DataTable consumer)
  - frontend/src/features/equipment/components/PumpsTable.tsx (DataTable consumer)
  - frontend/src/features/assets/components/AttachmentRowsTable.tsx (DataTable consumer)
---

# Catalog Performance Pass — PRD

## P0. Intent

The Materials Catalog page (`/catalog/materials`) is sluggish under a
real catalog (~410 active rows). Measured symptoms:

- Toggling **"Show deactivated"** takes **~1,970 ms** of perceived
  freeze.
- Clicking a mid-table cell takes **130–360 ms** to update active
  state.
- The materials GET ships **197 KB uncompressed** JSON every time
  (gzip would shrink it to 12 KB).
- The DOM holds **4,510 `<td>` elements** for the table body while
  only ~21 rows are in the viewport — a 19× over-render.
- Backend turnaround itself is **18–32 ms** — the server is not the
  bottleneck.

This feature ships five small, independent fixes that, together,
remove the sluggishness and set a saner default shape for every
table-backed page in the app — not just Materials. Each phase is
self-contained and lands as its own PR.

## P1. Triggering evidence

See `planning/code-reviews/2026-06-04/materials-catalog-performance-review.md`
for full measurements, file:line references, and the rejected
alternatives. The PRD assumes those findings; it does not re-derive
them.

## P2. Scope

In scope:

1. Gzip compression on every API response (Phase 1).
2. Filter `is_active` client-side instead of refetching when the
   "Show deactivated" checkbox toggles (Phase 2).
3. Row virtualization in the shared `DataTable` body, with frozen
   columns, group headers, selection, fill, and keyboard nav
   preserved (Phase 3).
4. Trim audit fields from the list payload; keep them on per-row
   detail endpoints (Phase 4).
5. Optional pagination on the catalog list endpoints, with a
   threshold-driven frontend opt-in (Phase 5).

Out of scope:

- The five "Non-goals" listed in the front matter.
- Visual / interaction polish unrelated to perceived performance.
- New catalog features (filters in the UI, bulk edit beyond what
  exists, etc.).
- Other DataTable performance work that doesn't trace back to a
  measured problem in the trigger review.

## P3. Requirements

### Per phase

Each phase has its own implementation plan under `phases/`. The PRD
captures only the contract / acceptance criteria each phase must
meet.

#### Phase 1 — gzip middleware

- After this phase: any response > 1 KB on any API route under
  `/api/v1/*` is sent with `content-encoding: gzip` when the client
  sends `Accept-Encoding: gzip`. The decoded JSON shape is
  byte-identical to today.
- The Materials Catalog GET drops from **~197 KB** to **~12 KB** on
  the wire for the test fixture.
- No new dependency required (`fastapi.middleware.gzip.GZipMiddleware`
  ships with Starlette).
- The streaming MCP mount at `/mcp` must continue to work — gzip
  must not break streaming responses. Configure middleware ordering
  accordingly.

#### Phase 2 — client-side `is_active` filter

- After this phase: toggling "Show deactivated" does **not** trigger
  a network request. The frontend fetches `include_inactive=true`
  once on page load and filters in memory by `is_active`.
- `useMaterialsQuery` no longer keys on `includeInactive`. The query
  key is stable across the checkbox.
- Reactivate / deactivate mutations continue to invalidate the
  query.
- The empty-state copy still distinguishes loading from "no inactive
  materials".

#### Phase 3 — DataTable row virtualization

- After this phase: `DataTable` renders only the rows intersecting
  (or close to) the viewport, plus a small overscan. With 410 rows,
  rendered `<tr>` count is ≤ ~50.
- Re-render budget on `rows` identity change is ≤ 200 ms on the
  reference dataset (vs. ~1,970 ms today).
- Selection, range fill, paste, keyboard navigation (Tab, Enter,
  arrow keys, Shift+arrow ranges, PageUp/PageDown), and active-cell
  scroll-into-view all continue to work across the virtual boundary.
- Frozen columns / group headers / aggregates / sticky headers
  continue to render correctly.
- Row-level a11y (`role="row"`, `aria-rowindex`) is preserved.
- All existing `DataTable` consumers continue to pass their tests:
  Materials, Pumps, Rooms, Attachments, EquipmentPage.

#### Phase 4 — payload trim

- After this phase: the list endpoints
  (`/catalogs/materials`, `/catalogs/frame-types`,
  `/catalogs/glazing-types`) omit `created_by` and `updated_by` from
  the list response. `created_at` / `updated_at` are retained
  (useful for "last modified" display).
- The per-row detail endpoints (`GET /catalogs/materials/{id}`,
  etc.) continue to return the full audit fields.
- The Pydantic public model for the list response is a distinct
  type from the per-row detail model — the boundary is explicit.
- Frontend types regenerate; no UI references the dropped fields.

#### Phase 5 — pagination

- After this phase: list endpoints accept optional `?limit` and
  `?offset` (or cursor — phase plan decides). Default behavior with
  no params is unchanged (returns everything) so the change is
  backwards-compatible.
- Response shape adds a `total` count (or `has_more` cursor flag —
  phase plan decides) so the client can render a paging UI.
- Frontend continues to use `useQuery` for small catalogs; phase
  plan describes the threshold and switch to `useInfiniteQuery`.
- Phase 5 is the only phase that is **optional to merge now**. It
  ships when row growth warrants it; phases 1–4 ship regardless.

## P4. Verification

Every phase must pass `make ci` from the repo root before review.
Specific verification per phase lives in the phase doc.

Performance verification:

- Repeat the measurement protocol in
  `planning/code-reviews/2026-06-04/materials-catalog-performance-review.md`
  after Phase 1 + Phase 2 + Phase 3 land, against the same 410-row
  fixture. Record the new numbers in `STATUS.md`.
- Targets: payload ≤ 15 KB on the wire; "Show deactivated" toggle
  ≤ 150 ms perceived; cell click ≤ 50 ms perceived; rendered
  `<tr>` count ≤ 50 with 410-row dataset.

## P5. Risk / mitigations

- **Phase 3 is the only risky change.** `DataTable` is shared by
  five+ consumers; a regression hurts everyone. Mitigation: lock the
  existing test suites (Materials, Pumps, Rooms, Attachments,
  EquipmentPage) and require them to pass unchanged; add explicit
  Playwright coverage for the keyboard-nav + selection-fill paths
  before merging.
- **Phase 1 + streaming `/mcp` interaction.** GZipMiddleware can
  buffer streaming responses if applied too broadly. Mitigation:
  scope or order middleware so the MCP streamable HTTP app is
  excluded.
- **Phase 4 contract change.** Anything consuming `created_by` /
  `updated_by` from the list response breaks. Mitigation: grep for
  consumers across `frontend/src` and `backend/scripts` before
  merging; update or delete uses. The trigger review confirms the
  page itself does not use them.
- **Phase 5 is dormant.** Held back until row count warrants. Avoid
  building speculative paging UI now.

## P6. Sequencing

Recommended merge order:

1. Phase 1 — gzip. One-line. Immediate wire-size win.
2. Phase 2 — client-side filter. Small, removes the second 197 KB
   request on the toggle.
3. Phase 3 — virtualization. Big win on perceived snappiness.
4. Phase 4 — payload trim. Smaller wire payload + cleaner API
   contract.
5. Phase 5 — pagination. Land when the catalog grows past ~1,000
   rows or when a stakeholder asks.

Phases 1, 2, 4, 5 can ship in any order; only Phase 3 has cost-of-
review reasons to wait until Phases 1–2 are in to avoid mixing
signals during performance verification.

## P7. Done definition

All of:

- Phases 1–4 merged to `main`, each with `make ci` green and a
  performance measurement entry in `STATUS.md`.
- `STATUS.md` shows the new measurements vs. the baseline in the
  trigger review.
- Phase 5 is documented but explicitly marked **Deferred** in
  `STATUS.md` until row growth triggers it.
- Trigger review's findings 1, 2, 3, 4, 6 are crossed off (auth
  finding 5 remains open under its own track).
