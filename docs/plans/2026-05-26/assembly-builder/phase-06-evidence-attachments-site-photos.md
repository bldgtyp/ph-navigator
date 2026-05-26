---
DATE: 2026-05-26
TIME: 18:21 EDT
STATUS: Proposed implementation plan.
AUTHOR: Codex
SCOPE: Datasheet and site-photo evidence workflows within Assembly
       Builder Specifications.
RELATED:
  - docs/features/assembly-builder-prd.md §§5.6, 7.11-7.12
  - docs/plans/2026-05-26/assembly-builder/phase-04-materials-picker-specifications.md
  - context/technical-requirements/attachments.md
  - context/user-stories/20-envelope.md US-ENV-13, US-ENV-15
---

# Phase 6 - Evidence Attachments And Site Photos

## Goal

Turn Specifications from a material QA scaffold into a usable evidence
workspace. Datasheets attach to project materials. Site photos attach to
specific segment use-sites, alongside the segment-owned use-site notes
introduced by the Specifications phase. The phase should reuse the
existing generic attachment backbone rather than inventing
feature-specific upload code.

## In Scope

- Datasheet attachment zones on project-material cards.
- Site-photo attachment zones on per-use-site rows.
- Preservation of segment use-site notes while site photos are
  attached, detached, or replaced.
- Preview/download/full-view modal integration.
- Viewer and locked-version preview/download behavior.
- Upload disabled when material `specification_status === "na"`.
- Delete/detach behavior that mutates only the active draft.
- Destructive assembly/layer/segment dialogs showing detached photo
  counts.
- Attachment edge-case coverage required by the canonical attachment
  contract.
- Minimal bridge points for the future Site Photos sub-tab.

## Out Of Scope

- Full Site Photos sub-tab implementation unless explicitly pulled in.
- Required-photo checklist.
- Bulk download of all datasheets or site photos.
- Attachment custom fields.
- New storage backend behavior.

## Dependencies

- Generic asset/upload endpoints and `<AttachmentCell>` or equivalent
  attachment primitives.
- Phase 4 material cards and use-site rows.
- Phase 3 destructive command confirmations.

## Backend Work

- Confirm registered attachment config for:
  - `tables.project_materials[*].datasheet_asset_ids[]`;
  - `tables.assemblies[*].layers[*].segments[*].photo_asset_ids[]`.
- Ensure attach/detach convenience routes accept both paths and enforce:
  - project ownership;
  - asset kind;
  - MIME/extension;
  - max count;
  - cross-project rejection;
  - version/draft ETags.
- Ensure asset reference checks protect older saved versions.

## Frontend Work

- Reuse shared upload coordinator and preview modal.
- Render datasheets on material cards.
- Render site photos on each use-site row.
- Keep use-site notes on the same row as the corresponding site-photo
  evidence.
- Keep attachment controls hidden in viewer/locked modes.
- Keep thumbnails visible/downloadable where the card itself is visible.
- Thread attachment state through command responses or table adapters
  without duplicating local source-of-truth.

## Verification Gates

Backend:

- attach/detach for datasheets;
- attach/detach for site photos;
- over-cap rejection;
- duplicate-within-cell handling;
- upload-after-discard leaves unreferenced asset;
- Save As preserves referenced asset ids;
- cross-project reference rejection;
- old saved version still resolves detached asset.

Frontend:

- material datasheet empty/populated/read-only states;
- site-photo empty/populated/read-only states;
- site-photo attach/detach does not alter use-site notes;
- preview modal for PDF/image as supported by current attachment
  implementation;
- upload disabled for `na` material status.

Browser:

1. Upload a datasheet to a material.
2. Upload two site photos to two different segment use-sites.
3. Save As; replace/detach one asset in the new version.
4. Switch back to prior version; verify old asset still resolves.
5. Open anonymous viewer; verify preview/download but no mutation
   controls.
6. Delete a segment with a photo and verify confirmation counts the
   detached photo reference.
7. Verify use-site notes remain attached to the expected segment after
   photo attach/detach.

Commands:

```bash
cd backend
uv run ruff check .
uv run ty check
uv run pytest tests/test_assets_service.py tests/test_assets_registry.py tests/test_project_document.py

cd ../frontend
pnpm run format
pnpm test -- --run src/features/envelope src/features/assets
pnpm run build
```

## Success Criteria

1. Evidence belongs to the correct data layer: datasheets on project
   material, photos on segment.
2. Detach never deletes asset bytes immediately.
3. Saved-version immutability is proven in tests and browser workflow.
4. The future Site Photos tab can read the same segment-photo data
   and use-site notes without another storage model.

## Risks

- **Attachment component assumes DataTable cell layout.** Mitigation:
  factor a shared attachment primitive usable inside cards/use-site rows.
- **Async upload completes after navigation.** Mitigation: follow the
  canonical attachment edge-case tests.
- **Evidence UI gets too card-heavy.** Mitigation: keep Specifications
  dense and scan-friendly.

## Lessons To Capture

Record lessons for:

- attachment primitive boundaries;
- version-reference bugs;
- `na` status friction;
- whether Site Photos should be pulled into this rollout or stay
  separate.
