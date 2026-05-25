import { flexRender, type Header, type Table } from "@tanstack/react-table";
import { Lock } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { GridColumnDragKeyboard } from "../hooks/useGridColumnDragKeyboard";
import type { GridColumnResize } from "../hooks/useGridColumnResize";
import type { AxisRoleSubset, DataTableColumnDef, FieldDef } from "../types";
import { AddFieldTailCell } from "./AddFieldTailCell";
import { ColumnHeaderMenu } from "./ColumnHeaderMenu";
import { ColumnResizeHandle } from "./ColumnResizeHandle";
import { CustomFieldDescriptionTooltip } from "./CustomFieldDescriptionTooltip";
import { HeaderContextMenu } from "./HeaderContextMenu";
import { SortableHeaderCell } from "./SortableHeaderCell";
import { findDuplicateDisplayName, type FieldDisplayName } from "../lib/fieldDisplayNames";

// Header onMouseDown owns column-select; double-click on editable
// single_select headers opens the field editor via `onEditField`.
// Header `<th>` refs are captured into `headerCellRefByFieldKey` so
// the popover can anchor to them. `<ColumnHeaderMenu>` owns the
// show/hide decision for the `⋯` trigger internally.
//
// Plan 08: every non-primary header `<th>` is wrapped in
// `<SortableHeaderCell>`. The `DndContext` + `SortableContext` live
// at the `DataTable` level (outside `<table>` — dnd-kit injects
// accessibility `<div>`s next to its children, which would be
// invalid nested inside `<thead>`).
//
// Per-cell state (the `triggerRef` for `HeaderContextMenu`) lives in
// the `<DataTableHeaderCell>` subcomponent so each cell can hold its
// own ref without bending React's rules-of-hooks inside a loop.
export type HeaderActionHandlers = {
  onSortAsc: (fieldKey: string) => void;
  onSortDesc: (fieldKey: string) => void;
  onFilterBy: (fieldKey: string) => void;
  onGroupBy: (fieldKey: string) => void;
  onHide: (fieldKey: string) => void;
  onRenameCustomField?: (fieldKey: string) => void;
  onDeleteCustomField?: (fieldKey: string) => void;
  onDuplicateCustomField?: (fieldKey: string) => void;
  onEditCustomFieldDescription?: (fieldKey: string) => void;
  // Custom formula fields only. The anchor element rides along so
  // the DataTable can mount the formula-editor popover against the
  // clicked header.
  onEditCustomFieldFormula?: (fieldKey: string, anchorElement: HTMLElement | null) => void;
  // The anchor is the clicked `<th>` (captured by the menu's triggerRef)
  // so the DataTable can mount the add-field popover against it.
  onInsertFieldLeft?: (fieldKey: string, anchorElement: HTMLElement | null) => void;
  onInsertFieldRight?: (fieldKey: string, anchorElement: HTMLElement | null) => void;
};

export type GridHeaderProps<TRow> = {
  table: Table<TRow>;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  fieldDefByKey: Map<string, FieldDef>;
  axisRolesByFieldKey: Map<string, AxisRoleSubset>;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  readOnly: boolean;
  hasWriteHandler: boolean;
  onEditField?: (fieldKey: string) => void;
  openFieldKey?: string | null;
  renamingFieldKey?: string | null;
  existingFieldLabels?: ReadonlyArray<FieldDisplayName>;
  onRenameCustomFieldSubmit?: (fieldKey: string, displayName: string) => Promise<void>;
  onRenameCustomFieldCancel?: () => void;
  headerCellRefByFieldKey?: Map<string, HTMLTableCellElement>;
  // Plan 08 §4.3 — Space/Arrow/Esc on a focused non-primary header
  // routes here. When omitted, header keyboard reorder is disabled.
  columnDragKeyboard?: GridColumnDragKeyboard;
  // When omitted, no resize handle is rendered on any column.
  columnResize?: GridColumnResize;
  headerActions: HeaderActionHandlers;
  // When set, the tail `+` cell becomes a focusable button that opens
  // the add-field popover; otherwise it renders as a disabled preview.
  onAddFieldFromTail?: () => void;
  tailCellRef?: { current: HTMLTableCellElement | null };
};

export function GridHeader<TRow>({
  table,
  visibleColumnDefs,
  fieldDefByKey,
  axisRolesByFieldKey,
  onColumnMouseDown,
  readOnly,
  hasWriteHandler,
  onEditField,
  openFieldKey,
  renamingFieldKey,
  existingFieldLabels = [],
  onRenameCustomFieldSubmit,
  onRenameCustomFieldCancel,
  headerCellRefByFieldKey,
  columnDragKeyboard,
  columnResize,
  headerActions,
  onAddFieldFromTail,
  tailCellRef,
}: GridHeaderProps<TRow>) {
  const pickedUpColumnIndex = columnDragKeyboard?.pickedUpColumnIndex ?? null;
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} role="row" aria-rowindex={1}>
          <th className="data-table-gutter" aria-label="Row number" />
          {headerGroup.headers.map((header, columnIndex) => {
            const column = visibleColumnDefs[columnIndex];
            if (!column) return null;
            const fieldDef = fieldDefByKey.get(column.fieldKey);
            return (
              <DataTableHeaderCell
                key={header.id}
                header={header}
                column={column}
                columnIndex={columnIndex}
                fieldDef={fieldDef}
                axisTint={axisRolesByFieldKey.get(column.fieldKey)}
                isPrimary={columnIndex === 0}
                readOnly={readOnly}
                hasWriteHandler={hasWriteHandler}
                onEditField={onEditField}
                openFieldKey={openFieldKey ?? null}
                renamingFieldKey={renamingFieldKey ?? null}
                existingFieldLabels={existingFieldLabels}
                onRenameCustomFieldSubmit={onRenameCustomFieldSubmit}
                onRenameCustomFieldCancel={onRenameCustomFieldCancel}
                headerCellRefByFieldKey={headerCellRefByFieldKey}
                columnDragKeyboard={columnDragKeyboard}
                pickedUp={pickedUpColumnIndex === columnIndex}
                columnResize={columnResize}
                onColumnMouseDown={onColumnMouseDown}
                headerActions={headerActions}
              />
            );
          })}
          <AddFieldTailCell variant="th" onClick={onAddFieldFromTail} ref={tailCellRef} />
        </tr>
      ))}
    </thead>
  );
}

type DataTableHeaderCellProps<TRow> = {
  header: Header<TRow, unknown>;
  column: DataTableColumnDef<TRow>;
  columnIndex: number;
  fieldDef: FieldDef | undefined;
  axisTint: AxisRoleSubset | undefined;
  isPrimary: boolean;
  readOnly: boolean;
  hasWriteHandler: boolean;
  onEditField?: (fieldKey: string) => void;
  openFieldKey: string | null;
  renamingFieldKey: string | null;
  existingFieldLabels: ReadonlyArray<FieldDisplayName>;
  onRenameCustomFieldSubmit?: (fieldKey: string, displayName: string) => Promise<void>;
  onRenameCustomFieldCancel?: () => void;
  headerCellRefByFieldKey?: Map<string, HTMLTableCellElement>;
  columnDragKeyboard?: GridColumnDragKeyboard;
  pickedUp: boolean;
  columnResize?: GridColumnResize;
  onColumnMouseDown?: (event: ReactMouseEvent<HTMLElement>, fieldKey: string) => void;
  headerActions: HeaderActionHandlers;
};

function DataTableHeaderCell<TRow>({
  header,
  column,
  columnIndex,
  fieldDef,
  axisTint,
  isPrimary,
  readOnly,
  hasWriteHandler,
  onEditField,
  openFieldKey,
  renamingFieldKey,
  existingFieldLabels,
  onRenameCustomFieldSubmit,
  onRenameCustomFieldCancel,
  headerCellRefByFieldKey,
  columnDragKeyboard,
  pickedUp,
  columnResize,
  onColumnMouseDown,
  headerActions,
}: DataTableHeaderCellProps<TRow>) {
  const triggerRef = useRef<HTMLTableCellElement | null>(null);
  const isEditableSingleSelect =
    fieldDef?.field_type === "single_select" && !readOnly && hasWriteHandler && !!onEditField;
  const isCustomField = fieldDef ? fieldDef.read_only_schema !== true : false;
  const canRenameCustomField =
    isCustomField && !readOnly && hasWriteHandler && !!onRenameCustomFieldSubmit;
  const isEditorOpen = openFieldKey !== null && openFieldKey === column.fieldKey;
  const isRenaming = renamingFieldKey !== null && renamingFieldKey === column.fieldKey;
  const className = ["data-table-th", isPrimary ? "data-table-frozen" : ""]
    .filter(Boolean)
    .join(" ");
  const headerKeyDown =
    columnDragKeyboard && !isPrimary
      ? buildHeaderKeyDown(columnIndex, columnDragKeyboard)
      : undefined;
  const schemaLocked = fieldDef?.read_only_schema === true;
  const description = fieldDef?.description?.trim() ?? "";
  const onRenameCustomField =
    canRenameCustomField && headerActions.onRenameCustomField
      ? () => headerActions.onRenameCustomField?.(column.fieldKey)
      : undefined;
  const onDeleteCustomField =
    isCustomField && headerActions.onDeleteCustomField
      ? () => headerActions.onDeleteCustomField?.(column.fieldKey)
      : undefined;
  const onDuplicateCustomField =
    isCustomField && isDuplicableCustomField(fieldDef) && headerActions.onDuplicateCustomField
      ? () => headerActions.onDuplicateCustomField?.(column.fieldKey)
      : undefined;
  const onEditCustomFieldDescription =
    isCustomField && headerActions.onEditCustomFieldDescription
      ? () => headerActions.onEditCustomFieldDescription?.(column.fieldKey)
      : undefined;
  // Custom formula fields only. `useTableSchema` synthesises formula
  // CustomFieldDefs as `field_type === "computed"`; this gate ignores
  // core computed columns (which set `read_only_schema`).
  const onEditCustomFieldFormula =
    isCustomField && fieldDef?.field_type === "computed" && headerActions.onEditCustomFieldFormula
      ? () => headerActions.onEditCustomFieldFormula?.(column.fieldKey, triggerRef.current)
      : undefined;
  const onInsertFieldLeft = headerActions.onInsertFieldLeft
    ? () => headerActions.onInsertFieldLeft?.(column.fieldKey, triggerRef.current)
    : undefined;
  const onInsertFieldRight = headerActions.onInsertFieldRight
    ? () => headerActions.onInsertFieldRight?.(column.fieldKey, triggerRef.current)
    : undefined;
  const doubleClickAction = isEditableSingleSelect
    ? () => onEditField?.(column.fieldKey)
    : canRenameCustomField
      ? onRenameCustomField
      : undefined;
  return (
    <SortableHeaderCell
      id={column.id}
      isPrimary={isPrimary}
      ariaColIndex={columnIndex + 1}
      className={className}
      axisTint={axisTint}
      fieldEditable={isEditableSingleSelect}
      fieldEditorOpen={isEditorOpen}
      isPickedUp={pickedUp}
      schemaLocked={schemaLocked}
      cellRef={(node) => {
        triggerRef.current = node;
        if (!headerCellRefByFieldKey) return;
        if (node) headerCellRefByFieldKey.set(column.fieldKey, node);
        else headerCellRefByFieldKey.delete(column.fieldKey);
      }}
      onKeyDown={headerKeyDown}
      onMouseDown={
        onColumnMouseDown ? (event) => onColumnMouseDown(event, column.fieldKey) : undefined
      }
      onDoubleClick={
        doubleClickAction
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              doubleClickAction();
            }
          : undefined
      }
    >
      <div className="data-table-header-row">
        {schemaLocked ? (
          <span
            className="data-table-header-lock"
            data-testid="data-table-header-lock"
            title="This field is part of the table's built-in schema."
          >
            <Lock aria-hidden size={12} />
          </span>
        ) : null}
        {isRenaming && fieldDef ? (
          <HeaderRenameEditor
            fieldKey={column.fieldKey}
            initialName={fieldDef.display_name}
            existingFieldLabels={existingFieldLabels}
            onSubmit={onRenameCustomFieldSubmit}
            onCancel={onRenameCustomFieldCancel}
          />
        ) : (
          <span className="data-table-header-label">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </span>
        )}
        {isEditableSingleSelect ? (
          <span aria-hidden className="data-table-header-edit-chevron">
            ▾
          </span>
        ) : null}
        {description && fieldDef ? (
          <CustomFieldDescriptionTooltip
            description={description}
            fieldDisplayName={fieldDef.display_name}
          />
        ) : null}
        {fieldDef ? (
          <ColumnHeaderMenu
            fieldDef={fieldDef}
            canEditOptions={isEditableSingleSelect}
            onEditOptions={() => onEditField?.(column.fieldKey)}
          />
        ) : null}
      </div>
      {fieldDef ? (
        <HeaderContextMenu
          fieldDef={fieldDef}
          triggerRef={triggerRef}
          isViewer={readOnly}
          onSortAsc={() => headerActions.onSortAsc(column.fieldKey)}
          onSortDesc={() => headerActions.onSortDesc(column.fieldKey)}
          onFilterBy={() => headerActions.onFilterBy(column.fieldKey)}
          onGroupBy={() => headerActions.onGroupBy(column.fieldKey)}
          onHide={() => headerActions.onHide(column.fieldKey)}
          onRenameField={onRenameCustomField}
          onDeleteField={onDeleteCustomField}
          onDuplicateField={onDuplicateCustomField}
          onEditDescription={onEditCustomFieldDescription}
          onEditFieldFormula={onEditCustomFieldFormula}
          onInsertFieldLeft={onInsertFieldLeft}
          onInsertFieldRight={onInsertFieldRight}
        />
      ) : null}
      {columnResize && column.resizable !== false ? (
        <ColumnResizeHandle
          columnId={column.id}
          active={columnResize.activeColumnId === column.id}
          onPointerDown={(event) => columnResize.onHandlePointerDown(column.id, event)}
          onDoubleClick={() => columnResize.onHandleDoubleClick(column.id)}
        />
      ) : null}
    </SortableHeaderCell>
  );
}

function HeaderRenameEditor({
  fieldKey,
  initialName,
  existingFieldLabels,
  onSubmit,
  onCancel,
}: {
  fieldKey: string;
  initialName: string;
  existingFieldLabels: ReadonlyArray<FieldDisplayName>;
  onSubmit?: (fieldKey: string, displayName: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setValue(initialName);
    setError(null);
    setPending(false);
    const handle = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [initialName]);

  const submit = async () => {
    if (pending || !onSubmit) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError("Field name cannot be empty.");
      return;
    }
    if (trimmed === initialName.trim()) {
      onCancel?.();
      return;
    }
    const duplicate = findDuplicateDisplayName(trimmed, existingFieldLabels, fieldKey);
    if (duplicate) {
      setError(`A field named "${trimmed}" already exists in this table.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(fieldKey, trimmed);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message ? caught.message : "Could not rename field.",
      );
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form className="data-table-header-rename" onSubmit={handleSubmit}>
      <input
        ref={inputRef}
        className="data-table-header-rename-input"
        aria-label={`Rename ${initialName}`}
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !pending) {
            event.preventDefault();
            void submit();
            return;
          }
          if (event.key === "Escape" && !pending) {
            event.preventDefault();
            onCancel?.();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      />
      {error ? (
        <span className="data-table-header-rename-error" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}

function isDuplicableCustomField(fieldDef: FieldDef | undefined): boolean {
  return (
    fieldDef?.field_type === "text" ||
    fieldDef?.field_type === "number" ||
    fieldDef?.field_type === "computed"
  );
}

// Routes Space / ←→ / Esc on a focused non-primary header to the
// keyboard-drag state machine. `preventDefault` keeps the keystroke
// from bubbling into the wrapper's grid-navigation handler (which
// would otherwise interpret Space as type-to-edit on the active cell
// and arrows as cell-selection moves). Once any column is picked up
// every header's Space / ←→ / Esc map to commit / move / cancel —
// the keyboard focus stays on the cell the user originally pressed
// Space on, while the pickup target visually slides; routing the
// keystroke through the originally-focused cell is what lets the
// gesture complete without a focus jump.
function buildHeaderKeyDown(
  columnIndex: number,
  handlers: GridColumnDragKeyboard,
): (event: ReactKeyboardEvent<HTMLTableCellElement>) => void {
  return (event) => {
    const pickupActive = handlers.pickedUpColumnIndex !== null;
    if (event.key === "Escape" && pickupActive) {
      event.preventDefault();
      handlers.onCancel();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      if (pickupActive) handlers.onCommit();
      else handlers.onPickup(columnIndex);
      return;
    }
    if (pickupActive && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      handlers.onMove(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
  };
}
