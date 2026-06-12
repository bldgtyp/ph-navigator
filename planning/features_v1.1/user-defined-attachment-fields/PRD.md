---
DATE: 2026-06-12
TIME: 17:05 EDT
STATUS: Deferred
AUTHOR: Codex
SCOPE: PRD outline for allowing user-defined attachment fields in DataTables.
RELATED:
  - STATUS.md
  - context/technical-requirements/data-table.md
  - context/technical-requirements/attachments.md
  - planning/features/attachments/STATUS.md
  - planning/features/attachments/phases/phase-05-polish-v11-candidates.md
---

# User-Defined Attachment Fields - PRD Outline

## 1. Summary

Allow editors to create DataTable fields whose value is an ordered list
of project asset ids, rendered by the shared `<AttachmentCell>` and
configured per field.

This is a v1.1 candidate. It is intentionally deferred from v1.

## 2. Problem

PH-Navigator v1 supports attachment cells only where PHN has declared a
core field, such as equipment datasheets or thermal bridge PDF reports.
Some project workflows may need an additional ad hoc attachment column:
for example an AHRI certificate, commissioning photo set, supplemental
specification, or review-round evidence file that is not part of the
fixed roster.

Today users can add custom DataTable fields, but `attachment` is not a
valid user-created field type.

## 3. Non-Goals For v1

- Do not add this to the current v1 implementation scope.
- Do not loosen the fixed v1 attachment roster.
- Do not store attachment arrays in scalar `custom_values`.
- Do not expose a frontend-only field type without backend asset
  lifecycle support.

## 4. User Stories

- As an editor, I can add a custom Attachment field to an eligible
  DataTable.
- As an editor, I can configure allowed file classes, max files per cell,
  and max file size within system caps.
- As an editor, I can upload, preview, detach, replace, and reorder files
  in a custom attachment cell using the same UX as PHN core attachment
  fields.
- As a viewer, I can preview and download files in custom attachment
  cells without edit affordances.
- As an MCP client, I can discover, attach, detach, list, resolve URLs
  for, and bulk-download assets from custom attachment fields.

## 5. Proposed Behavior

### 5.1 Field Type

Add `attachment` to the persisted custom-field type set.

Persist field config with at least:

- `asset_kind`: default likely `other` or `datasheet`;
- `allowed_content_types`: constrained allow-list;
- `allowed_extensions`: optional constrained allow-list for formats like
  `.hbjson`;
- `max_count`: user-configured but below a backend hard cap;
- `max_file_size_mb`: user-configured but below a backend hard cap.

### 5.2 Row Storage

Use a dedicated attachment-value lane, likely:

```jsonc
"custom_attachments": {
  "cf_...": ["asset_...", "asset_..."]
}
```

This keeps the current storage model clear:

- `custom_values`: scalar values;
- `custom_links`: linked-record id arrays;
- `custom_attachments`: asset id arrays.

### 5.3 Asset Registry

Generalize attachment-field discovery so asset services combine:

- the fixed PHN roster from `backend/features/assets/registry.py`;
- dynamic attachment FieldDefs discovered from the active project
  document.

The dynamic registry must feed:

- upload validation;
- attach/detach validation;
- document-reference scanning;
- orphan protection and GC;
- bulk download;
- MCP `list_assets`, `resolve_asset_urls`, `bulk_attach`,
  `bulk_detach`, and bulk download flows.

### 5.4 DataTable UX

Frontend DataTable already has an `attachment` render type. The v1.1
work should make custom attachment fields generic:

- field picker exposes `Attachment`;
- field config modal edits attachment config;
- generated columns render `<AttachmentCell>`;
- writes land in the dedicated attachment bag;
- sort/filter/copy/fill semantics are explicit and conservative.

Recommended initial rule:

- disable clipboard paste into attachment cells;
- allow fill only within the same attachment field, copying the asset-id
  array by value;
- filter by empty/not empty and count thresholds;
- sort by attachment count only if the existing table-sort contract can
  support it cleanly.

## 6. Backend Scope

- Extend `CustomFieldType` and JSON schema.
- Add attachment config validation on `TableFieldDef`.
- Add row model support for `custom_attachments`.
- Add document validators for attachment field/value consistency.
- Add schema-mutation support for add, rename, duplicate, delete, and
  change-type behavior.
- Add asset-reference scanning for dynamic fields across saved versions
  and drafts.
- Update attach/detach to resolve dynamic field config from the target
  document before mutating the row.
- Add tests proving that dynamic attachment references are protected from
  orphan GC.

## 7. Frontend Scope

- Add `attachment` to the user-authorable field type choices.
- Add a field-config section for allowed file classes and caps.
- Map persisted attachment fields to DataTable `FieldDef.field_type =
  "attachment"`.
- Add generic custom attachment column rendering.
- Add row write normalization for `custom_attachments`.
- Add focused Vitest coverage for add field, upload/detach write shape,
  read-only rendering, and delete-field cleanup.

## 8. Open Questions

- Which asset kind should custom attachment fields default to:
  `datasheet`, `other`, or a user-selectable kind?
- Should custom attachment fields be allowed on every FieldDef-capable
  table or only selected equipment/material/TB tables?
- Should type conversion to or from `attachment` be forbidden, or allowed
  only as a destructive wipe?
- Should duplicate-field copy attachment values, copy config only, or
  create an empty field with the same config?
- Should custom attachment fields participate in report tables or remain
  editable-table only for the first v1.1 slice?

## 9. Acceptance Criteria

- A custom attachment field can be created, renamed, duplicated, deleted,
  saved, reloaded, and viewed on a supported DataTable.
- Attachment values persist as ordered `asset_id[]` lists and never enter
  scalar `custom_values`.
- Upload, preview, detach, replace, reorder, and read-only states match
  the fixed attachment-cell UX.
- Backend validation rejects unknown asset ids, cross-project assets,
  invalid MIME/extensions, over-count cells, and oversized files.
- Asset reference scanning includes custom attachment fields in saved
  versions and drafts.
- Bulk download and MCP tools work for dynamic attachment fields.
- Tests cover backend validation, asset lifecycle, schema mutation, and
  frontend rendering/write shape.

