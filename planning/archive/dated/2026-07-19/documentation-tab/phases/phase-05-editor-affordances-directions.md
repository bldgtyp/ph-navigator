---
DATE: 2026-07-19
TIME: 00:49
STATUS: Complete / archived
AUTHOR: Ed May (with Claude)
SCOPE: Editor write affordances on the Documentation page + directions content
RELATED: ../PRD.md §D2/§D5/§D6, ../assets/wireframe.html,
         frontend/src/features/envelope/hooks.ts (attach/detach diff pattern)
---

# Phase 05 — Frontend: editor affordances + directions

## Implementation summary

- Editor Documentation rows now render `Specification Status` selects,
  `Not required` waiver checkboxes for Photos/Datasheet axes, and the real
  `AttachmentCell` for Photos.
- Photo writes use attach/detach endpoints and chain draft etags; envelope
  material/assembly rows fan out photo writes and photo waivers across the
  segment ids provided by the documentation summary.
- Spec/waiver scalar writes use the owning write path: envelope commands for
  project materials and aperture products, guarded draft-table replaces for
  equipment, heat-pump leaves, and thermal bridges.
- Directions content now lives under
  `frontend/src/features/documentation/directions/` with placeholder example
  image slots until BLDGTYP-owned photos are selected.
- Viewer and locked-version surfaces remain read-only.

## Part A — writes on the Documentation page (editors only)

1. **Photo upload/delete per row:** mount the real `AttachmentCell`
   (cell variant) in the Photos column. Equipment/apertures/TB rows write
   whole-array via the generic document-write path OR the attach/detach
   endpoints — pick ONE path and use it for all Documentation-page writes
   (recommend attach/detach endpoints: diff-based, used by
   envelope/apertures hooks, and etag-chained). Envelope rows fan out to
   `segment_ids[]` from the summary (port `buildUseSitePhotoChanges`
   grouping).
2. **Spec-status select** per row: writes the same `status` /
   `specification_status` field as the owning table (single JSON-Patch to
   the draft; optimistic update + summary invalidation).
3. **Waiver checkboxes** ("not required") on Photos + Datasheet cells:
   write the Phase-01 fields; envelope photo waiver fans out to segments
   like photos; datasheet waiver hits the material / row field once.
   Immediate visual flip to "not required ✓" + rollup update.
4. **Unsaved-changes hint** on the rollup line when the draft differs from
   the selected saved version (reuse the draft-state signal the workspace
   shell already has); links/scrolls to the standard Save control.
5. **Failure UX:** per-file Sonner toasts on upload failure (Materials
   parity); etag-conflict path surfaces the standard concurrency dialog.

## Part B — directions content (static, in-repo)

1. Content module `frontend/src/features/documentation/directions/` — one
   entry per category: Walls, Floors, Roofs, (Other), Ventilators,
   Heat Pumps, Pumps, Fans, Hot Water, Electric Heaters, Appliances,
   Windows/Apertures, Thermal Bridges. Entry = ordered shot list
   (title + explicit bullets) + example image.
2. **Copy source:** V0's site-photos page text (see research.md §V0) is
   the starting point for envelope; equipment lists drafted fresh
   (nameplate / installed-in-place / connections pattern) — **Ed reviews
   all copy before merge** (flag in PR).
3. **Images:** BLDGTYP-owned example photos only (public repo — verify
   provenance of every image; licensed/manufacturer imagery is
   prohibited). Optimize to ≤~150 KB each; lazy-load in the modal.
   Placeholder-box fallback where no example exists yet.
4. Wire the 📖 modals; a "📖 Photo instructions" line item also appears in
   each record modal's photos section header (small, optional).

## Verification

- Phase 05 automated coverage:
  - `uv run pytest tests/test_project_document_aperture_documentation_commands.py tests/envelope/test_envelope_document_contracts.py -q` → 8 passed.
  - `pnpm exec vitest run src/features/documentation/__tests__/DocumentationSummaryView.test.tsx` → 3 passed.
  - `pnpm run format:check`, `pnpm run lint`, `pnpm run check:all`, `pnpm run build` → passed; lint/build retain existing warning classes only.
  - Targeted backend `ruff format --check`, `ruff check`, and `uv run ty check` → passed.
- Full gate: `make ci` → backend 1419 passed, 7 skipped, 1 existing
  asset-service deprecation warning; frontend 242 test files / 2238 tests
  passed; build passed with existing Vite chunk-size warnings.
- `graphify update .` completed after code changes; graph HTML viz was skipped
  because the graph exceeds the visualization node limit.
- Live browser upload/save/anonymous-viewer checks move to Phase 06, where the
  seeded end-to-end verification packet owns the PRD §5 acceptance matrix.

- Agent browser (editor fixture): upload → thumbnail → reload persists →
  Save → anonymous view shows photo. Waiver toggle round-trips and
  updates rollup instantly. Spec select on the page and on the owning
  DataTable show the same value after either changes (query invalidation
  both directions).
- Envelope fan-out: upload on "Cellulose · WALL-C3" writes every cellulose
  segment in WALL-C3 (inspect draft JSON); datasheet chip updates on a
  second assembly using the same material without reload.
- Viewer mode shows none of Part A's controls.
- Closeout gate: simplify + docs-pass skills, `make format`, `make ci`.
