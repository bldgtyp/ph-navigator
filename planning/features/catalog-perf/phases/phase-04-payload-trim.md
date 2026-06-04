---
DATE: 2026-06-04
TIME: 09:40 ET
STATUS: PENDING — implementation has not started.
AUTHOR: Claude (Opus 4.7)
SCOPE: Drop `created_by` and `updated_by` from the catalog list
       endpoints; keep them on per-row detail endpoints. Distinct
       Pydantic models for list vs detail responses.
RELATED:
  - ../PRD.md §P3 Phase 4
  - planning/code-reviews/2026-06-04/materials-catalog-performance-review.md §4
  - backend/features/catalogs/materials/models.py
  - backend/features/catalogs/materials/service.py
  - backend/features/catalogs/materials/routes.py
  - backend/features/catalogs/frame_types/ (mirror pattern)
  - backend/features/catalogs/glazing_types/ (mirror pattern)
  - frontend/src/features/catalogs/types.ts
---

# Phase 4 — List payload trim

## P0. Goal

The list endpoints for `materials`, `frame-types`, and
`glazing-types` should omit `created_by` and `updated_by` UUID
fields from each row. These fields are not displayed in any list
UI; they cost ~20% of the uncompressed payload. They remain
accessible via the per-row detail endpoint when needed.

## P1. Files touched

- `backend/features/catalogs/materials/models.py` — split
  `CatalogMaterialPublic` into list and detail variants.
- `backend/features/catalogs/materials/service.py` — list service
  emits the list variant.
- `backend/features/catalogs/materials/routes.py` —
  `response_model` on the list route uses the new list type.
- Same triple for `frame_types/` and `glazing_types/`.
- `frontend/src/features/catalogs/types.ts` — split the TS types
  to match.
- `frontend/src/features/catalogs/api.ts` — list response type
  reference.
- `frontend/src/features/catalogs/__tests__/` — adjust fixtures.

## P2. Implementation steps

1. In `backend/features/catalogs/materials/models.py`, define:
   ```python
   class CatalogMaterialListItem(BaseModel):
       id: UUID
       name: str
       category: str
       density_kg_m3: float | None
       specific_heat_j_kgk: float | None
       conductivity_w_mk: float | None
       emissivity: float | None
       color: str | None
       source: str | None
       url: str | None
       comments: str | None
       is_active: bool
       created_at: datetime
       updated_at: datetime
       model_config = ConfigDict(from_attributes=True)


   class CatalogMaterialPublic(CatalogMaterialListItem):
       """Per-row detail. Adds audit user references."""
       created_by: UUID | None
       updated_by: UUID | None
   ```
   The class hierarchy gives subclass-by-extension; the list
   service uses `model_validate` on `CatalogMaterialListItem` and
   the audit fields are simply not requested or are silently
   dropped on serialization.

2. Update the list response wrapper:
   ```python
   class CatalogMaterialListResponse(BaseModel):
       items: list[CatalogMaterialListItem]
   ```

3. In `service.py`, change the list service to construct
   `CatalogMaterialListItem` instead of `CatalogMaterialPublic`.
   The SQL query may also drop the `created_by` / `updated_by`
   columns to save server-side work — small win, ~1–2% — but
   not required.

4. In `routes.py`, set
   `response_model=CatalogMaterialListResponse` on the list route
   (likely already set; just confirm the type imports point at the
   new types).

5. Mirror the same split for `frame_types/` and `glazing_types/`.

6. In `frontend/src/features/catalogs/types.ts`, split the TS types
   to match:
   ```ts
   export type CatalogMaterialListItem = { /* ... no created_by, updated_by */ };
   export type CatalogMaterial = CatalogMaterialListItem & {
     created_by: string | null;
     updated_by: string | null;
   };
   export type CatalogMaterialListResponse = { items: CatalogMaterialListItem[] };
   ```

7. Audit the frontend for references to `created_by` / `updated_by`
   on the list type:
   ```bash
   grep -rn "created_by\|updated_by" frontend/src/features/catalogs
   ```
   The trigger review confirms `MaterialsCatalogPage.tsx` doesn't
   use them; double-check the import/export module and any
   `MaterialEditorModal` references.

8. Update fixtures in `frontend/src/features/catalogs/__tests__/`
   and the backend test fixtures to match the new list shape.

## P3. Acceptance criteria

- `GET /api/v1/catalogs/materials` returns items with no
  `created_by` or `updated_by` keys (verify with
  `python3 -c "import json,sys;d=json.load(sys.stdin);print(set(d['items'][0].keys()))" < response.json`).
- `GET /api/v1/catalogs/materials/{id}` (if a detail endpoint
  exists; if not, leave as documented future need) continues to
  return the full audit fields.
- Same for frame-types and glazing-types.
- Wire payload for the 410-row Materials fixture drops by ≥ 15%
  before gzip; ≥ 10% after gzip.
- `make ci` is green.
- No frontend type error referencing the dropped fields.

## P4. Verification commands

```bash
cd backend && uv run pytest tests/features/catalogs -v
cd frontend && pnpm test -- catalogs

# Wire size compared to baseline
curl -s -H "Cookie: phn_session=$SESSION" \
  http://127.0.0.1:8000/api/v1/catalogs/materials | wc -c
```

## P5. Risk

- **Hidden consumer of the audit fields.** The grep in step P2.7
  is the gate. If anything downstream (e.g. a future "last modified
  by" tooltip) needs them, fetch the detail endpoint instead.
- **Pydantic subclass serialization.** Verify that returning a
  `CatalogMaterialPublic` instance through a `CatalogMaterialListItem`
  `response_model` correctly drops the extra fields under Pydantic
  v2 + FastAPI's response model coercion. If it doesn't, construct
  the list-variant explicitly in the service.

## P6. Effort

~1 hour including the frame-types / glazing-types mirror and
fixture updates.

## P7. Hand-off notes

Order is flexible — this phase can land before or after Phase 3.
If shipping after Phase 1 (gzip), record the post-gzip payload
size in `../STATUS.md`.
