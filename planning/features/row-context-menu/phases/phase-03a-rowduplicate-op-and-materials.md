---
DATE: 2026-06-04
TIME: 14:30
STATUS: Ready
AUTHOR: Ed May / Claude
SCOPE: `rowDuplicate` WriteOp shape; library `duplicateRowById`;
       Materials backend duplicate endpoint; `(copy)` suffix helper;
       materials controller wiring; pytest; Materials e2e.
RELATED:
  - planning/features/row-context-menu/PRD.md §6, §7
  - planning/features/row-context-menu/decisions.md D-1, D-2, D-6,
    D-10, D-11
  - frontend/src/shared/ui/data-table/types.ts (WriteOp)
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts
  - frontend/src/features/catalogs/materials/controller.ts
  - frontend/src/features/catalogs/materials/fieldDefs.ts
  - backend/features/catalogs/materials/routes.py
  - backend/features/catalogs/materials/service.py
  - backend/features/catalogs/materials/repository.py
  - backend/features/catalogs/_shared.py
---

# Phase 3a — `rowDuplicate` WriteOp + Materials backend + wiring

## P0. Why this slice

Phase 3a is the **keystone PR** for Duplicate. It ships:

- the new `WriteOp` variant `rowDuplicate` with full `sourceRow`
  snapshot (PRD §6, decision D-2);
- `duplicateRowById(rowId)` in `DataTable.tsx` and the new
  `Duplicate record` menu item;
- the Materials backend endpoint
  `POST /api/v1/catalogs/materials/{material_id}/duplicate`;
- the `next_copy_suffix` helper in
  `backend/features/catalogs/_shared.py`;
- the materials controller's `case "rowDuplicate"` switch arm and
  the new `duplicateMaterial` API client call;
- pytest + Playwright e2e for the materials happy path.

Phases 3b and 3c consume the WriteOp contract this phase lands; they
add no library code.

## P1. Acceptance — Phase 3a done when

1. Backend: `POST /api/v1/catalogs/materials/{material_id}/duplicate`
   returns `201 + CatalogMaterialPublic` on a valid source; `404`
   when `material_id` is missing or soft-deleted; the duplicate
   carries `name = source.name + " (copy)"` (or the next free
   suffix); the audit log gets a `catalog_record_create` row
   identifying the new record id.
2. `next_copy_suffix(base_name, sibling_names)` in `_shared.py`
   returns `"<base> (copy)"` when no collision, `"<base> (copy 2)"`
   when ` (copy)` is already taken, `"<base> (copy 3)"` when both
   are taken, and so on.
3. Frontend: `Duplicate record` menu item is present in the row
   menu (single-row branches per Phase 2). Clicking it dispatches
   `rowDuplicate` through `controller.onWrite`, which calls
   `POST /materials/{id}/duplicate` and invalidates the list query.
4. Inverse `rowDelete` is recorded on dispatch so the menu's announce
   text shows `"Row duplicated."` and ⌘Z attempts a deactivate.
   Note: the ⌘Z path on Materials has the pre-existing tmp-id ↔
   real-id reconcile gap (PRD §14); this phase does not fix it. The
   test asserts the announce text + that the new row appears, not
   that ⌘Z removes it cleanly across the invalidate.
5. Multi-row collapse rules from Phase 2 hide Duplicate in the
   collapsed branch (rule 1 shows only `Delete N records`).
6. `make ci` is green.

## P2. Files

### Backend

#### New

- Add `next_copy_suffix` to
  `backend/features/catalogs/_shared.py`.
- `backend/features/catalogs/materials/tests/test_duplicate.py`
  (path matches the repo's existing pytest layout — verify before
  writing).

#### Modified

- `backend/features/catalogs/materials/routes.py` — add the
  duplicate route.
- `backend/features/catalogs/materials/service.py` — add
  `duplicate_material(material_id, user, request)`.
- `backend/features/catalogs/materials/repository.py` — add
  `list_sibling_names(conn, exclude_id) -> list[str]` for the
  suffix probe.

### Frontend

#### Modified

- `frontend/src/shared/ui/data-table/types.ts` — add
  `RowDuplicatePayload` and the `rowDuplicate` variant on
  `WriteOp`.
- `frontend/src/shared/ui/data-table/DataTable.tsx`:
  - Add `duplicateRowById(rowId)` callback. Captures the source
    TRow snapshot from `visibleDataRows`; emits
    `rowDuplicate` + inverse `rowDelete`.
  - Wire `onDuplicate` on the menu to it.
- `frontend/src/shared/ui/data-table/components/RowContextMenu.tsx`
  — add the `Duplicate record` menu item between `Insert record`
  and `Expand record`, with the `Copy` lucide icon and no
  `shortcutHint`.
- `frontend/src/shared/ui/data-table/__tests__/RowContextMenu.test.tsx`
  — extend with Duplicate-item rendering + dispatch assertion.
- `frontend/src/shared/ui/data-table/__tests__/DataTable.test.tsx`
  (or a focused new file) — assert `duplicateRowById` emits the
  correct WriteOp shape with `sourceRow` populated.
- `frontend/src/features/catalogs/api.ts` — add
  `duplicateMaterial(materialId): Promise<CatalogMaterial>`.
- `frontend/src/features/catalogs/materials/controller.ts` — add
  `case "rowDuplicate"` to the `onWrite` switch.
- `frontend/tests/e2e/row-context-menu-duplicate-materials.spec.ts`
  — Materials Duplicate happy path.

## P3. WriteOp shape

In `types.ts`:

```ts
export type RowDuplicatePayload = {
  rowId: string;             // library tmp id (e.g. `tmp_<ulid>`)
  sourceRowId: string;       // existing row's id, from `getRowId(source)`
  sourceRow: unknown;        // full TRow snapshot, captured at op-emit
  anchorRowId: string | null;
};

// Add to the WriteOp discriminated union:
| { kind: "rowDuplicate"; rows: RowDuplicatePayload[] }
```

`unknown` matches the existing style (`RowDeletePayload.row: unknown`).
The consumer's `onWrite` casts at its boundary.

## P4. Library wiring

In `DataTable.tsx`:

```ts
const duplicateRowById = useCallback(
  async (rowId: string) => {
    if (readOnly || !onWrite) return;
    const sourceIndex = visibleDataRows.findIndex(
      (row) => getRowId(row) === rowId,
    );
    if (sourceIndex < 0) return;
    const sourceRow = visibleDataRows[sourceIndex];
    const tmpId = generateRowId?.() ?? `tmp_${generatedId("row")}`;
    const op: WriteOp = {
      kind: "rowDuplicate",
      rows: [{
        rowId: tmpId,
        sourceRowId: rowId,
        sourceRow,
        anchorRowId: rowId,
      }],
    };
    const inverse: WriteOp = {
      kind: "rowDelete",
      rows: [{ rowId: tmpId, row: sourceRow, anchorRowId: rowId }],
    };
    try {
      await dispatchWrite(op, inverse);
      setAnnounce("Row duplicated.");
    } catch (error) {
      setAnnounce(error instanceof Error ? error.message : "Row duplicate failed.");
    }
  },
  [readOnly, onWrite, visibleDataRows, getRowId, generateRowId, dispatchWrite],
);
```

Pass `duplicateRowById(rowId)` to the row menu's `onDuplicate`.

## P5. Materials backend

### Endpoint — `routes.py`

```python
@router.post(
    "/{material_id}/duplicate",
    response_model=CatalogMaterialPublic,
    status_code=status.HTTP_201_CREATED,
)
def post_material_duplicate(
    material_id: str,
    request: Request,
    auth: CurrentUser,
) -> CatalogMaterialPublic:
    user, _expires_at = auth
    return duplicate_material(material_id, user, request)
```

### Service — `service.py`

```python
def duplicate_material(
    material_id: str,
    user: UserPublic,
    request: Request,
) -> CatalogMaterialPublic:
    new_record_id = new_catalog_record_id()
    with transaction() as conn:
        source = repository.get_material(conn, material_id)
        if source is None:
            raise api_error(
                status.HTTP_404_NOT_FOUND,
                "catalog_material_not_found",
                "Catalog material not found.",
            )
        siblings = repository.list_sibling_names(conn, exclude_id=material_id)
        new_name = next_copy_suffix(source["name"], siblings)
        repository.insert_material(
            conn,
            record_id=new_record_id,
            name=new_name,
            category=source["category"],
            density_kg_m3=source["density_kg_m3"],
            specific_heat_j_kgk=source["specific_heat_j_kgk"],
            conductivity_w_mk=source["conductivity_w_mk"],
            emissivity=source["emissivity"],
            color=source["color"],
            source=source["source"],
            url=source["url"],
            comments=source["comments"],
            user_id=user.id,
        )
        row = repository.get_material(conn, new_record_id)
        log_catalog_action(
            conn,
            "catalog_record_create",
            user,
            request,
            catalog_table=CATALOG_TABLE,
            record_id=new_record_id,
        )
    assert row is not None
    return _to_public(row)
```

### Repository — `repository.py`

```python
def list_sibling_names(conn: Connection[Any], *, exclude_id: str) -> list[str]:
    rows = conn.execute(
        "SELECT name FROM catalog_materials "
        "WHERE deleted_at IS NULL AND id <> %(exclude_id)s",
        {"exclude_id": exclude_id},
    ).fetchall()
    return [row["name"] for row in rows]
```

(`exclude_id` skips the source row so the helper doesn't have to
filter it out — the source name itself is one possible base.)

### Helper — `_shared.py`

```python
import re
from collections.abc import Iterable

_COPY_RE = re.compile(r"^(.*?)\s*\(copy(?: (\d+))?\)$")


def next_copy_suffix(base_name: str, sibling_names: Iterable[str]) -> str:
    """Resolve the next free " (copy)" / " (copy N)" name (AirTable parity).

    `base_name` is the source row's display name. `sibling_names` is the
    set of names already present in the same scope (typically the active
    rows in the same table, excluding the source).

    Returns the first free name in the series:
        <root> (copy)
        <root> (copy 2)
        <root> (copy 3)
        …
    where <root> is `base_name` with any trailing " (copy)" /
    " (copy N)" stripped, so duplicating `Foo (copy)` produces
    `Foo (copy 2)` rather than `Foo (copy) (copy)`.
    """
    match = _COPY_RE.match(base_name)
    root = match.group(1) if match else base_name
    siblings = set(sibling_names)

    candidate = f"{root} (copy)"
    if candidate not in siblings:
        return candidate
    n = 2
    while True:
        candidate = f"{root} (copy {n})"
        if candidate not in siblings:
            return candidate
        n += 1
```

## P6. Frontend controller wiring

In `frontend/src/features/catalogs/api.ts`:

```ts
export async function duplicateMaterial(materialId: string): Promise<CatalogMaterial> {
  const response = await apiFetch(`/api/v1/catalogs/materials/${materialId}/duplicate`, {
    method: "POST",
  });
  return response.json();
}
```

In `controller.ts`:

```ts
import { duplicateMaterial } from "../api";

// inside the onWrite switch:
case "rowDuplicate": {
  if (op.rows.length === 0) return;
  await Promise.all(
    op.rows.map((row) => duplicateMaterial(row.sourceRowId)),
  );
  await invalidate();
  return;
}
```

`row.sourceRow` is unused here — Materials lets the backend rebuild
the full row from its own state. Slice-replace consumers (Phases 3b,
3c) use it.

## P7. Sequence

1. Backend: helper + tests; route + service + repository; pytest.
   This block is self-contained — land it as its own commit so the
   helper's test coverage is visible before the wiring.
2. Frontend types: add `RowDuplicatePayload` + `rowDuplicate`
   variant. Compiler errors will name every consumer's `onWrite`
   switch — that surface is the wiring checklist.
3. Library: `duplicateRowById` in `DataTable.tsx`; menu item in
   `RowContextMenu.tsx`.
4. Materials: API client + controller switch arm.
5. Tests: Vitest + e2e.
6. `make ci`.

## P8. Tests

### Backend pytest — `test_duplicate.py`

- Happy path: insert a material, hit
  `POST /materials/{id}/duplicate`, assert 201 + name + audit log.
- 404: hit the endpoint with a fake id; assert
  `catalog_material_not_found`.
- 404: insert + soft-delete, then duplicate; assert 404.
- Suffix `name → name (copy)` when no collision.
- Suffix `name (copy) → name (copy 2)` when ` (copy)` exists.
- Suffix `name (copy 2) → name (copy 3)` etc.
- `next_copy_suffix` is exercised both via the endpoint and via a
  direct unit test (cleaner failure messages for the algorithmic
  cases).

### Frontend Vitest

- `RowContextMenu.test.tsx` — Duplicate item renders, has the
  `Copy` icon, no danger tint, no shortcut hint.
- `DataTable.test.tsx` — calling `duplicateRowById('row-2')`
  dispatches a `rowDuplicate` op with `sourceRowId: 'row-2'`,
  `sourceRow: <the row object>`, `anchorRowId: 'row-2'`. Inverse
  is `rowDelete` with `rowId: <tmp>`, `row: <source>`.

### Playwright e2e — `row-context-menu-duplicate-materials.spec.ts`

- Right-click a material row, click `Duplicate record`. Assert a
  new row appears with `name = source + " (copy)"`. Assert the
  announce live region says `"Row duplicated."`.
- Right-click the same source again (it now has a sibling
  ` (copy)`). Assert the next duplicate becomes ` (copy 2)`.

## P9. Out of scope

- The ⌘Z-across-invalidate gap for Materials (PRD §14). Phase 3a
  ships the menu item, the dispatch, and the inverse op — but the
  Materials controller does not yet maintain a tmp-id ↔ real-id
  map, so a ⌘Z after duplicate currently deactivates a tmp id the
  backend never knew. Documented; not fixed here.
- Rooms / Pumps wiring — Phases 3b / 3c.
- `rowActions` slot — Phase 4.

## P10. Risks

- **Public WriteOp surface change.** Every consumer's `onWrite`
  switch is currently exhaustive (TS narrowing). Adding
  `rowDuplicate` will produce a TS error in every consumer until
  each adds a `case` (or a `default` that throws). Mitigation:
  the WriteOp change is the **first** step in the sequence so the
  compiler enumerates the consumer surface; each consumer either
  ships a real case in this phase (Materials) or in Phase 3b / 3c
  (Rooms / Pumps), or a `default` that throws with a clear
  "consumer does not yet support Duplicate" error.
- **`next_copy_suffix` regex on edge inputs.** Test against names
  containing parens, names already ending in `(copy)` with a
  trailing space, names that are themselves `(copy)`. The regex
  uses non-greedy `(.*?)` and a trailing `\s*\(copy(?: \d+)?\)$`
  anchor, but cover the edges with unit tests.
- **Audit log action kind.** This phase logs the new record as
  `catalog_record_create`, not `catalog_record_duplicate`. If
  product wants to distinguish them later, the model already
  carries enough info in `details` to filter, but the action kind
  is the cleanest discriminator. Tracked as a follow-up if
  needed; for now, "create" matches what the table sees.
