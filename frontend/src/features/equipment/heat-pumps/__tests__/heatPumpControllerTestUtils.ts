import { vi } from "vitest";
import { emptyViewState, type FieldDef, type WriteOp } from "../../../../shared/ui/data-table";
import type { SliceTableController } from "../../../../shared/ui/data-table/feature";

export function heatPumpTestController<TSlice>({
  fieldDefs,
  onWrite = vi.fn(),
}: {
  fieldDefs: FieldDef[];
  onWrite?: (op: WriteOp) => Promise<void> | void;
}): SliceTableController<TSlice> {
  return {
    tableSchema: {
      fieldDefs,
      tableFields: [],
      customFields: [],
      coreFieldKeys: new Set(fieldDefs.map((fieldDef) => fieldDef.field_key)),
      schemaFingerprint: "test",
      mintCustomFieldId: () => "cf_test",
    },
    view: emptyViewState(),
    onViewChange: vi.fn(),
    onResetView: vi.fn(),
    viewLoading: false,
    onWrite: vi.fn(async (op: WriteOp) => {
      await onWrite(op);
    }),
    canEdit: true,
    isEditor: true,
    isLocked: false,
    editBlocker: null,
    setEditBlocker: vi.fn(),
    actionError: null,
    setActionError: vi.fn(),
    reloadDraft: vi.fn(),
    isReplacePending: false,
    runWithConflictHandling: vi.fn(),
    notifyRemoteSlice: vi.fn(),
    handleAddCustomField: vi.fn(),
    handleEditCustomFieldBundle: vi.fn(),
    handleDeleteCustomField: vi.fn(),
    handleDuplicateCustomField: vi.fn(),
  };
}
