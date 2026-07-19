---
DATE: 2026-07-18
TIME: 19:45
STATUS: Done (implemented 2026-07-18 on feature/documentation-tab)
AUTHOR: Ed May (with Claude)
SCOPE: HEIC convert-on-upload + documentation-summary endpoints
RELATED: ../PRD.md §D5, phase-01-backend-schema-registry.md,
         backend/features/assets/service.py, backend/features/project_document/status_summary.py
---

# Phase 02 — Backend: HEIC + documentation summary

## Part A — HEIC accept + convert

Decision (decisions.md session 1): accept HEIC/HEIF, convert server-side
to JPEG. Conversion happens at **complete-upload**, before the asset flips
to `uploaded` (bytes are immutable once uploaded — never convert later).

1. Add `image/heic`, `image/heif` (+ `.heic`/`.heif` extensions) to
   `SITE_PHOTO`-kind attachment configs and the magic-byte sniffer
   (`ftyp` brands `heic`/`heix`/`mif1`).
2. In `complete_upload`: when content sniffs HEIC → fetch object, convert
   to JPEG (`pillow-heif` via `uv add pillow-heif`; preserve EXIF
   orientation), write `file.jpg` object, update the asset row
   (content_type `image/jpeg`, size, sha256, r2_etag, object_key), delete
   the original HEIC object, then queue the thumbnailer on the JPEG.
   Conversion failure → asset `failed` with a distinct error code
   (`asset_conversion_failed`), not a silent fallback.
3. Timeout/size guard: run conversion in the same worker pattern as the
   thumbnailer (bounded executor + timeout); 25 MB cap already applies.
4. Dedup note: content-hash dedup keys on the *uploaded* bytes; two
   different HEICs of the same shot won't dedup — acceptable, document it.

## Implementation Notes

- `backend/features/assets/heic_types.py` owns the HEIC MIME / extension /
  `ftyp` brand constants used by both the registry and conversion path.
- `backend/features/assets/heic_conversion.py` converts HEIC/HEIF bytes to
  JPEG through `pillow-heif` + Pillow in a bounded executor. The asset row is
  rewritten to the JPEG object (`content_type=image/jpeg`, new size/hash/etag,
  new object key), and the original HEIC object key is retained only in
  metadata for audit/debugging before the source object is deleted.
- Conversion failure marks the asset `failed` with
  `failure_reason=asset_conversion_failed` and returns API error code
  `asset_conversion_failed`.
- `site_photo` registry fields now accept `image/heic`, `image/heif`, and
  `.heic`/`.heif` octet-stream uploads. Misleading `text/plain` + `.heic`
  uploads remain rejected.

## Part B — `documentation-summary` endpoints

Model on `status_summary.py` (same saved/draft pairing, same access
gating):

- `GET .../document/documentation-summary` (saved, viewer-allowed) and
  `GET .../draft/documentation-summary` (editor draft).
- Response: ordered sections per PRD §D2 →
  `section { key, title, anchor, counts {spec_done, spec_total, ds_done,
  ds_total, photo_done, photo_total}, groups? (HP leaves / envelope
  assemblies), records[] }`.
  Envelope section: one record per unique material per assembly
  (reuse/port the Materials use-site grouping server-side), with
  `segment_ids[]` for fan-out writes, material-level
  `datasheet_asset_ids`, per-use `photo_asset_ids`.
  All other sections: one record per row —
  `{ record_id, display_name, sub_label (mfr/model where available),
  spec_status, datasheet_asset_ids, photo_asset_ids,
  photo_not_required, datasheet_not_required, table_path (deep-link) }`.
- **Derivation rules (backend-owned, PRD §D5):** axis done =
  `count > 0 OR not_required OR spec_status == na`; totals exclude
  nothing (na records stay in M with all axes done) — match the wireframe
  counts style `12 of 31`. Page-level counts = sum of sections.
- Whole-page rollup object at top level (the three chips).
- Query invalidation contract: accepted writes to any in-scope table
  invalidate the summary (mirror status-summary's key strategy:
  project + version + source).

## Implementation Notes

- `backend/features/project_document/documentation_summary.py` defines the
  response DTOs, table registry, backend-owned axis derivation, envelope
  material-per-assembly grouping, heat-pump leaf groups, and saved/draft
  loaders.
- Routes added:
  - `GET /api/v1/projects/{project_id}/versions/{version_id}/document/documentation-summary`
  - `GET /api/v1/projects/{project_id}/versions/{version_id}/draft/documentation-summary`
- Counts use PRD §D5 rules: a datasheet/photo axis is done when it has at
  least one asset, is waived, or the spec axis is `na`. `na` rows still count
  in totals and satisfy all three axes.

## Verification

- Unit tests: derivation truth-table (photos/waiver/na permutations);
  envelope dedup (material in 3 segments of one assembly → 1 record,
  3 segment_ids; same material in 2 assemblies → 2 records sharing the
  datasheet array); HP leaf grouping.
- HEIC: upload a real .heic fixture end-to-end against MinIO — asset ends
  `uploaded` as JPEG, thumbnail ready, EXIF orientation correct; corrupt
  HEIC → `asset_conversion_failed`.
- Anonymous request to saved summary succeeds; draft summary 401s
  when signed out.
- `make ci` green.

## Evidence

- Focused backend tests:
  `uv run pytest tests/test_assets_registry.py tests/test_assets_service.py tests/test_project_documentation_summary.py`
  → 25 passed.
- Changed-slice lint/type:
  `uv run ruff check features/assets/heic_types.py features/assets/heic_conversion.py features/assets/service.py features/assets/registry.py features/assets/repository.py features/project_document/documentation_summary.py features/project_document/routes.py tests/test_assets_registry.py tests/test_assets_service.py tests/test_project_documentation_summary.py`
  → passed.
- Changed-slice type check:
  `uv run ty check features/assets/heic_types.py features/assets/heic_conversion.py features/assets/service.py features/assets/registry.py features/assets/repository.py features/project_document/documentation_summary.py features/project_document/routes.py tests/test_assets_registry.py tests/test_assets_service.py tests/test_project_documentation_summary.py`
  → passed.
- HEIC tests generate real HEIC bytes with Pillow/pillow-heif and exercise the
  full `upload-intent` → fake-R2 PUT → `complete-upload` path. The dedicated
  MinIO smoke / thumbnail-ready assertion was not run in this phase slice;
  full CI coverage is still required before commit.
