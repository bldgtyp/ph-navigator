---
DATE: 2026-06-04
TIME: 17:00
STATUS: Done — landed 2026-06-04 on main
AUTHOR: Ed May / Claude
SCOPE: Pumps `rowDuplicate` via slice-replace. Mirrors Phase 3b for
       Rooms. No backend endpoint. ERV / Fan placeholders are not
       wired (their real tables don't exist yet).
RELATED:
  - planning/features/row-context-menu/PRD.md §8
  - planning/features/row-context-menu/decisions.md D-1, D-2, D-10
  - planning/features/row-context-menu/phases/phase-03b-rooms-slice-replace-duplicate.md
  - frontend/src/features/equipment/lib.ts
    (pumpsPayloadFromRowInsert / pumpsPayloadFromRowDelete)
  - frontend/src/features/equipment/routes/EquipmentPage.tsx
  - frontend/src/features/equipment/components/PumpsTable.tsx
---

# Phase 3c — Pumps slice-replace Duplicate

## P0. Why this slice

Phase 3c repeats the Phase 3b pattern for Pumps. It is structurally
identical: a `pumpsPayloadFromRowDuplicate` helper next to the
existing `pumpsPayloadFromRowInsert`, plus a `case "rowDuplicate"`
switch arm in `EquipmentPage.tsx`. The `nextCopySuffix` helper from
Phase 3b is reused.

ERV and Fan tabs are still `PlaceholderEquipmentTable` (see
`frontend/src/features/equipment/routes/EquipmentPage.tsx`); they
pick up the same pattern when their real tables land. PRD §14
documents this explicitly.

## P1. Acceptance — Phase 3c done when

1. Right-clicking any data row in the Pumps table opens the row
   menu with all four built-ins and Phase 2 multi-row collapse.
2. `Duplicate record` clones the source row directly below it
   with `name → name (copy)` / `name (copy) → name (copy 2)`
   suffix resolution via the shared `nextCopySuffix`.
3. ⌘Z removes the cloned row cleanly.
4. ERV and Fan placeholder tabs are **not** wired (no row context
   menu surface — they're not real tables).
5. `make ci` is green; Playwright e2e covers the Pumps duplicate
   happy path.

## P2. Files

### Modified

- `frontend/src/features/equipment/lib.ts` — add
  `pumpsPayloadFromRowDuplicate(current, duplicates)`.
- `frontend/src/features/equipment/routes/EquipmentPage.tsx` —
  add the `case "rowDuplicate"` switch arm to the Pumps
  controller's `onWrite`.
- `frontend/src/features/equipment/__tests__/lib.test.ts` (or the
  Pumps-specific test file) — unit tests for
  `pumpsPayloadFromRowDuplicate`.
- `frontend/tests/e2e/row-context-menu-duplicate-pumps.spec.ts` —
  Pumps duplicate happy path.

## P3. Helper shape

```ts
import type { RowDuplicatePayload } from "../../shared/ui/data-table/types";

export function pumpsPayloadFromRowDuplicate(
  current: PumpsSlice,
  duplicates: RowDuplicatePayload[],
): PumpsReplacePayload {
  const pumps = [...current.pumps];
  const liveNames = new Set(pumps.map((p) => p.name));
  for (const dup of duplicates) {
    const source = dup.sourceRow as PumpRow;
    const newName = nextCopySuffix(source.name, liveNames);
    liveNames.add(newName);
    const clone: PumpRow = {
      ...source,
      id: dup.rowId,
      name: newName,
    };
    pumps.push(normalizePumpForPayload(clone));
  }
  return {
    pumps: sortedPumps(pumps),
    single_select_options: clonePumpOptions(current),
    field_defs: [...current.field_defs],
  };
}
```

Pumps' existing `pumpsPayloadFromRowInsert` appends + sorts rather
than splice-inserting at the anchor (because Pumps maintains its
own sort order). The duplicate helper follows the same pattern;
`anchorRowId` is informational here.

`EquipmentPage.tsx` switch arm:

```ts
case "rowDuplicate": {
  const payload = pumpsPayloadFromRowDuplicate(current, op.rows);
  await replacePumpsSlice(payload);
  return;
}
```

## P4. Sequence

1. Add `pumpsPayloadFromRowDuplicate` + unit test.
2. Add the switch arm to Pumps' `onWrite`.
3. e2e.

## P5. Tests

### Vitest

- `pumpsPayloadFromRowDuplicate`:
  - Single duplicate produces a clone with the suffix and
    Pumps-style sort order.
  - Custom field values survive.
  - Multi-duplicate produces distinct suffixes (parity with
    Rooms).

### Playwright e2e — `row-context-menu-duplicate-pumps.spec.ts`

- Open a project's Equipment > Pumps table. Right-click a pump,
  click `Duplicate record`. Assert the clone appears with the
  suffix.
- ⌘Z removes it.

## P6. Out of scope

- ERV / Fan wiring — their tables are not real (today they render
  `PlaceholderEquipmentTable`). They pick up the slice-replace
  duplicate helper pattern (`ervsPayloadFromRowDuplicate`,
  `fansPayloadFromRowDuplicate`) and the matching switch arm when
  their real tables land. The PRD does not commit to backend
  endpoints for them.
- Promoting `nextCopySuffix` to a shared util. Today it lives next
  to its two consumers in `equipment/lib.ts`; once a third TS
  consumer needs it, promote to `frontend/src/shared/lib/copySuffix.ts`.

## P7. Risks

- **Pumps sort order vs anchor position.** Pumps re-sorts after
  insert/duplicate, so the user sees the clone where the sort puts
  it, not necessarily directly below the source. This matches the
  existing Insert behavior and is consistent with the rest of the
  Pumps table; document it in the e2e test's expectation.
- **`nextCopySuffix` shared across two consumers in `lib.ts`.**
  Rooms and Pumps both import it from
  `equipment/lib.ts`. Acceptable for now; if Materials' frontend
  ever needs a TS twin (it does not today — the backend resolves
  the suffix), promote then.
