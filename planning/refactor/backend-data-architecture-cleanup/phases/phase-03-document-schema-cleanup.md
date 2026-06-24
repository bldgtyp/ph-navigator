---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Blocked (aperture v12 WIP must land; confirm D2)
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 3 — document-model schema cleanup using the no-backcompat window.
RELATED: ../decisions.md (D2), ../PLAN.md,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-1, DOC-5, DOC-6, §4),
         context/technical-requirements/llm-mcp-schema.md §10.5
DEPENDS_ON: aperture v12 WIP merged to main; decision D2 resolved.
---

# Phase 3 — Document Schema Cleanup

## Goal

Make the document-model schema story honest and minimal: one current-schema
validator, no accreted read-time shims, a meaningful `schema_version`, a guarded
body size, and a single serialization per save. This is the headline use of the
no-backcompat window — we **delete** the migration cruft rather than chain it.

## Why this is safe now
There are no saved bodies. The only consumers of the document shape are the dev
seed and the test fixtures, which we regenerate. After a deploy, none of the
below would be possible without a shim chain (Phase 7).

## Changes

### 3.1 Delete the read-time migration shims (DOC-5, §4)
`document.py:291,371` define `_migrate_legacy_manufacturer_filters` and
`_migrate_v11_aperture_refs` as `mode="before"` validators that blanket-stamp
`schema_version` on *any* dict and only transform v11→v12. Remove them and the
blanket-stamp. Reads of a body that doesn't match the current schema fall to the
existing read-safe envelope (`store.py:249`) — which is the correct, intended
failure mode.

### 3.2 Collapse to one current-schema validator + reset version (D2)
- Per D2 (recommended): set `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1`
  (`document.py:208`). If D2 lands on "keep 12", skip the renumber but still do
  3.1.
- `schema_version` field becomes `Literal[<chosen>]`; validation is
  current-only. No `mode="before"` upgraders remain.

### 3.3 Body-size guard (DOC-1)
Add a `MAX_BODY_BYTES` setting and enforce it (→ HTTP 413
`project_document_too_large`) at every write boundary that persists a body:
`drafts.py` save/save-as/upsert, and any path that bypasses
`replace_table_slice` (the heat-pump/aperture/envelope write entry points —
note Phase 4 collapses these to one boundary, so re-check coverage there). The
size helper already exists (`validation.py:28` `body_size_bytes`); reuse it.

### 3.4 Single canonical serialization (DOC-6)
`validation.py:18-29` computes `document_etag` (`json.dumps(..., sort_keys=True)`)
and `body_size_bytes` (`model_dump_json()`) independently — 2–3 full
serializations per save. Compute the canonical JSON once per request and derive
both etag and size from it.

### 3.5 Extract the cross-table validator (the `document.py` split)
Move `validate_document_references` and its `_validate_*` helpers (~330 lines,
`document.py:402+`) into `document_validation.py`. `document.py` keeps the
Pydantic models + the (now single) current-schema entry point. Re-export for
existing callers.

### 3.6 Reseed + regenerate fixtures
Regenerate the dev seed and the document fixtures at the new baseline; update any
`schema_version`-asserting tests. CI's fixture-validation proves the corpus
validates against the single validator.

## Step sequence
1. 3.5 split first (mechanical, makes the rest legible).
2. 3.1 delete shims → 3.2 collapse/renumber.
3. 3.6 reseed/regenerate; fix tests.
4. 3.3 size guard, 3.4 serialization (independent, can be either order).

## Acceptance criteria
- No `mode="before"` migrators remain in `document.py`; `grep` for the deleted
  function names is clean.
- `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` matches D2; the field is a single
  `Literal`.
- A write that exceeds `MAX_BODY_BYTES` returns 413 with a structured error;
  test covers it (incl. an MCP-path write).
- One serialization per save (assert via a spy/counter test or code inspection).
- `document.py` < ~600 lines; validator lives in `document_validation.py`.
- Dev reseed + `make ci` green.

## Risks
- **WIP collision** — `document.py` and the aperture v11→v12 transform are owned
  by the in-flight WIP. This phase MUST start after that lands; the shim it
  deletes (`_migrate_v11_aperture_refs`) is exactly the WIP's transform, so
  confirm the WIP's final shape persists v12 natively before deleting.
- Deleting a shim could hide a still-needed transform. Mitigation: no data
  exists; reseed + corpus validation is the proof.
