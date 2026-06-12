---
DATE: 2026-06-12
TIME: -
STATUS: Active — Phase 1 implemented 2026-06-12; Phase 2 next
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the Model Viewer feature.
RELATED: planning/features/model-viewer/README.md
---

# Model Viewer — Status

## Current state

`Active — implementing.` Feature folder authored 2026-06-12: PRD,
UI_SPEC (redesigned non-CAD composition), decisions ledger, 6-phase
plan. **Phase 1 (HBJSON file management) implemented 2026-06-12** —
`project_hbjson_files` table, `backend/features/model_viewer/`,
`frontend/src/features/model_viewer/` (Model tab live). Still absent:
three/R3F frontend deps and honeybee backend deps (arrive Phases 3
and 2 respectively).

Test fixtures (both in this folder, both copied to
`backend/tests/fixtures/` in Phase 2; coverage maps + remaining
synthetic-only gaps in PLAN.md):
- `ph_nav_v2_example.hbjson` (459 KB, Ed 2026-06-12) — primary
  canonical fixture. (Supersedes `my_example_project.hbjson`.)
- `Hillandale_Gateway_NAR_260402.hbjson` (51.99 MB, Ed 2026-06-12,
  review round 3) — scale fixture and D-15 perf canary: 583 rooms,
  6,178 faces, 1,024 apertures, 71 named constructions, 253 shades
  → 1 merged group, units **Inches**. Its size triggered D-17
  (100 MB cap).

Pre-existing groundwork already on main:
- `project_assets` backbone supports `asset_kind='hbjson'`
  (`backend/features/assets/registry.py`).
- Behavior contract complete in
  `context/user-stories/40-model-viewer.md` (all Q-VIEWs resolved).
- V1 reference complete in `research/v1-3d-model-viewer-reference.md`.

2026-06-12: V1 frontend parity audit completed from V1 source
(`reviews/2026-06-12-v1-parity-audit.md`) — full capability parity
confirmed; 3 findings folded back.

2026-06-12 (Ed review round 2): **D-02..D-12 confirmed by Ed.** All
decisions now accepted; none open. Same-pass docs sync completed:
`decisions.md` marked accepted; PRD/UI_SPEC/README status flipped;
`context/user-stories/40-model-viewer.md` gained a "V2 composition
amendments — accepted 2026-06-12" block and the amended US-VIEW-6
crit. 7 + crit. 5 construction rows (D-12); `context/UI_UX.md` §2.9
now points at UI_SPEC.md and UX-Q9 is resolved (D-05);
`context/GLOSSARY.md` gained the "Thermal performance" section
("-Factor = with films, -Value = without"; the section US-VIEW-6
cited had never actually been created — it exists now).

2026-06-12 (phase handoffs): detailed implementation plans for all
six phases authored under `phases/` (phase-01 … phase-06). Each is a
self-contained subagent handoff: required reading, work breakdown
with file paths, contracts, fixture golden counts, verification
gates, exit criteria. Notable corrections baked in from codebase
verification: `users.id` and `projects.id` are UUID and
`project_assets.id` is TEXT (US-VIEW-1's DDL sketch said INTEGER /
implied UUID — phase-01 §3.1 records the corrected column types);
the `model` tab already exists as a placeholder in `PROJECT_TABS`;
the asset upload-intent flow already captures `content_hash_sha256`
(dedup enforced at the hbjson-files link step); zustand ^5.0.2 is
already a frontend dep, three/R3F are not (added in Phase 3).

2026-06-12 (Ed review round 1): OQ-1 resolved — project location
becomes its own deferred feature
(`planning/features/project-location/`, requirements stub written);
Site & Sun sun path blocked on it. OQ-2 resolved → D-13 (schema
Phase 1, job Phase 2, Airtightness consumer marked FUTURE). OQ-4
researched (LBT forum #11790 + honeybee-energy source) → D-12
proposed: LBT-verbatim terminology, show U-Factor (films incl.) AND
U-Value (films excl.) rows. OQ-3 resolved → D-14: selection uses the
BLDGTYP branding `--highlight` token family (already loaded app-wide
from bldgtyp.github.io/bt-branding). No open questions remain.

2026-06-12 (review round 3 — plan-readiness critique): a
completeness review surfaced three decision items; Ed accepted all
three same-day, plus one follow-on:
- **D-15** `/model_data` precomputed at upload, served as an
  immutable R2 artifact (amends US-VIEW-7 crit. 9 — the prior
  "re-parse per request" plan had conflated caching the raw bytes
  with caching the derived payload).
- **D-16** broken-file lifecycle: "Failed to parse" badge driven by
  `extraction_status` + permanent/transient error taxonomy on
  `/model_data` (Retry is transient-only).
- **Scale fixture pulled forward**: Ed provided
  `Hillandale_Gateway_NAR_260402.hbjson` (51.99 MB multifamily);
  exercised from Phase 2 on, not deferred to Phase 6 acceptance.
- **D-17** upload cap 50 → 100 MB (the fixture itself exceeded the
  old cap).
Same-pass docs sync: decisions.md (D-15/D-16/D-17), PRD (§2 matrix,
§3, new §4.6, §5, §7, §8), UI_SPEC (§2 badge + cap, §8 typed
errors), PLAN (Phases 1–3 + fixture section), phase-01/02/03/06
handoffs, and `context/user-stories/40-model-viewer.md` (amendments
block + crit. 3 cap + crit. 9 in place). The round-3 editorial
items (implementer-level, no decision needed) were applied same-day:
`window.__phnModelViewer` scene-ready test-hook contract defined in
phase-03 §4.8 and referenced from phases 4–5; WebGL/SwiftShader CI
caveat (phase-03 §6.2); GPU-memory/disposal acceptance check
(phase-03 §4.9); dedup made race-proof via a denormalized
`content_hash_sha256` column + partial unique index (phase-01
§3.1/§3.3); phase-04 §1 Site & Sun goal paragraph rewritten to
state the §3.1 rule plainly; drei Z-up caveat broadened to all
scene helpers (phase-03 §4.1).

## Next step

**Start Phase 2** — handoff doc:
`phases/phase-02-extraction-backend.md` (honeybee deps, extraction
job, `/model_data` artifact). Phase 1 shipped 2026-06-12; details
below.

## Phase 1 — implemented 2026-06-12

Backend:
- Migration `20260612_0022_project_hbjson_files` (UUID PK, TEXT
  asset_id, partial unique `(project_id, content_hash_sha256)` dedup
  backstop, `(project_id, uploaded_at DESC)` list index).
- `backend/features/model_viewer/` (routes/models/service/repository)
  registered in `main.py`. Link step implements two-layer dedup
  (SELECT for the friendly 409 + unique-index backstop), restore-on-
  relink for soft-deleted rows (asset-layer hash dedup returns the
  same `asset_id`, which is UNIQUE on the link table), and orphan-
  asset discard on rejected duplicates.
- hbjson kind-level upload policy added in `assets/registry.py` +
  intent validation (`.hbjson`/`.json`, JSON/octet-stream content
  type; the 100 MB cap is the existing service hard cap = D-17).
  Without this, hbjson intents fell through to the thermal-bridge
  attachment config and its 25 MB cap.
- Download route does its own linked-file check and bypasses the
  asset layer's anonymous document-reference gate (hbjson assets are
  never document-referenced).
- MCP tools in `features/mcp/tools_model_viewer.py` (list/create/
  rename/delete/download-url) re-exported via `tools.py`, stubs in
  `server.py`.
- `backend/tests/test_model_viewer_files.py` — 11 tests green
  (round-trip, ordering, rename/notes validation, soft delete,
  dedup 409 + backstop + orphan discard, restore-on-relink, viewer
  401s, anonymous download, intent constraint rejections, >8 KB
  magic-check regression).
- Latent asset-layer bug found and fixed: `_validate_magic` ran
  `json.loads` on only the first 8 KB, so ANY real `.hbjson` over
  8 KB failed complete-upload (`hbjson_parse_failed`). Now: full
  parse only when the prefix holds the whole file, JSON-object sniff
  otherwise. Regression test included.

Frontend:
- `frontend/src/features/model_viewer/` (api/hooks/lib/store/
  query-keys/types + components FileChip, FilePopover, FileRow,
  UploadDropZone, UploadNoticeLine, ModelEmptyState,
  DeleteFileDialog + routes/ModelTab + model_viewer.css). Wired in
  `ProjectTabContent`; `TAB_COPY.model` updated.
- Active file ⇆ `?file=` via `useSearchParams` (newest fallback);
  `store.ts` zustand groundwork holds `activeFileId`.
- Upload flow: local validation → SHA-256 (shared
  `shared/lib/sha256.ts:sha256HexOfFile`) → intent → XHR PUT with
  progress (shared `assets/api.ts:putToSignedUrlWithProgress`) →
  complete → link; dedup 409 surfaces inline with [Switch] (D-06:
  no toasts).
- Vitest: 11 tests green (`lib.test.ts`, `FilePopover.test.tsx` —
  validation, sort, viewer-role hiding, failed badge, dedup notice).
- Playwright e2e green: `frontend/tests/e2e/model-viewer-files.spec.ts`
  (codex@example.com, real fixture upload → rename → notes →
  `?file=` → delete → empty state). Requires `make seed-agent-user`
  and `make object-store-init` (the MinIO bucket was missing on this
  machine — that's the dev-stack step that creates it).

Closeout gate (`make format` + `make ci`) run at end of session —
see ledger.

## Blockers

None. Phase 6's sun path remains blocked on the deferred
`project-location` feature (the lens itself still ships with a
location hint) — it does not gate Phases 1–5. The scale fixture is
in hand (round 3); the former "waiting on multifamily HBJSON"
blocker is cleared.

## Verification ledger

| Phase | State | Evidence |
|---|---|---|
| Planning docs | Done 2026-06-12 | this folder |
| Phase handoff plans (01–06) | Done 2026-06-12 | `phases/` |
| Phase 1 — file management | **Done 2026-06-12** | migration `20260612_0022`; `backend/features/model_viewer/`; `frontend/src/features/model_viewer/`; pytest ×11 + Vitest ×11 + e2e green; `make ci` green (this session) |
| Phase 2 — extraction backend | Not started | — |
| Phase 3 — canvas + Building lens | Not started | — |
| Phase 4 — remaining lenses | Not started | — |
| Phase 5 — themes + legend | Not started | — |
| Phase 6 — measure, Site & Sun, polish | Not started | — |
