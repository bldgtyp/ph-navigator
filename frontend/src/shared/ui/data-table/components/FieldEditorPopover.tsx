import * as Popover from "@radix-ui/react-popover";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  OPTION_COLOR_PALETTE,
  createFieldOption,
  hasDuplicateFieldOptionLabels,
  missingOptionReferences,
  normalizeOptionOrders,
  optionReferenceCounts,
} from "../lib";
import type { CellWrite, FieldDef, FieldOption, WriteOp } from "../types";
import { ConfirmDeleteOptionDialog, type CascadeChoice } from "./ConfirmDeleteOptionDialog";

export type FieldEditorPopoverProps<TRow> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldDef: FieldDef;
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  accessor: (row: TRow) => unknown;
  anchorElement: HTMLElement | null;
  dispatchWrite: (forward: WriteOp, inverse: WriteOp) => Promise<unknown> | void;
};

type DraftOption = FieldOption;
type CascadeEntry = { removedOptionId: string; newValue: string | null };

export function FieldEditorPopover<TRow>({
  open,
  onOpenChange,
  fieldDef,
  rows,
  getRowId,
  accessor,
  anchorElement,
  dispatchWrite,
}: FieldEditorPopoverProps<TRow>) {
  const sourceOptions = useMemo(() => fieldDef.options ?? [], [fieldDef.options]);
  const sourceColorCodeOptions = fieldDef.colorCodeOptions !== false;

  const [draftOptions, setDraftOptions] = useState<DraftOption[]>(() => [...sourceOptions]);
  const [draftColorCodeOptions, setDraftColorCodeOptions] = useState(sourceColorCodeOptions);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stagedCascades, setStagedCascades] = useState<CascadeEntry[]>([]);
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);
  const focusOnMountIdRef = useRef<string | null>(null);
  // Snapshot of per-row option values at open time. Kept in a ref so
  // the inverse cell-write capture is lossless across multiple chained
  // cascade decisions without triggering re-renders.
  const originalRowValuesRef = useRef<Map<string, string | null>>(new Map());

  // Re-seed the draft only on open transitions, not on rows / accessor
  // / source-options reidentification — otherwise a parent refetch
  // mid-edit would wipe the user's in-progress draft.
  useEffect(() => {
    if (!open) return;
    setDraftOptions([...sourceOptions]);
    setDraftColorCodeOptions(sourceColorCodeOptions);
    setSaveError(null);
    setStagedCascades([]);
    setConfirmingOptionId(null);
    focusOnMountIdRef.current = null;
    const snapshot = new Map<string, string | null>();
    for (const row of rows) {
      const value = accessor(row);
      snapshot.set(getRowId(row), typeof value === "string" && value ? value : null);
    }
    originalRowValuesRef.current = snapshot;
    // Re-seed is keyed solely on open transition (and fieldDef identity
    // when the parent swaps the editor between fields without closing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fieldDef]);

  const referenceCounts = useMemo(() => optionReferenceCounts(rows, accessor), [accessor, rows]);
  const missingRefs = useMemo(
    () => missingOptionReferences(rows, sourceOptions, accessor),
    [accessor, rows, sourceOptions],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateOption = useCallback((id: string, patch: Partial<DraftOption>) => {
    setDraftOptions((prev) =>
      prev.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    );
  }, []);

  const removeOptionFromDraft = useCallback((id: string) => {
    setDraftOptions((prev) => prev.filter((option) => option.id !== id));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if ((referenceCounts[id] ?? 0) === 0) {
        removeOptionFromDraft(id);
        return;
      }
      setConfirmingOptionId(id);
    },
    [referenceCounts, removeOptionFromDraft],
  );

  const handleCascadeConfirm = useCallback(
    (choice: CascadeChoice) => {
      const targetId = confirmingOptionId;
      if (!targetId) return;
      const newValue = choice.kind === "clear" ? null : choice.replacementId;
      setStagedCascades((prev) => [
        ...prev.filter((entry) => entry.removedOptionId !== targetId),
        { removedOptionId: targetId, newValue },
      ]);
      removeOptionFromDraft(targetId);
      setConfirmingOptionId(null);
    },
    [confirmingOptionId, removeOptionFromDraft],
  );

  const addOption = useCallback(() => {
    setDraftOptions((prev) => {
      const next = createFieldOption("", prev);
      focusOnMountIdRef.current = next.id;
      return [...prev, next];
    });
  }, []);

  const alphabetize = useCallback(() => {
    setDraftOptions((prev) =>
      [...prev].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    );
  }, []);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraftOptions((prev) => {
      const fromIndex = prev.findIndex((option) => option.id === active.id);
      const toIndex = prev.findIndex((option) => option.id === over.id);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return prev;
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const duplicateLabels = hasDuplicateFieldOptionLabels(draftOptions);
  const hasEmptyLabel = draftOptions.some((option) => !option.label.trim());
  const optionsChanged = !optionListsEquivalent(sourceOptions, draftOptions);
  const colorCodeChanged = draftColorCodeOptions !== sourceColorCodeOptions;
  const canSave = (optionsChanged || colorCodeChanged) && !duplicateLabels && !hasEmptyLabel;

  const handleCancel = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const before: FieldDef = fieldDef;
    const after: FieldDef = {
      ...fieldDef,
      options: normalizeOptionOrders(draftOptions),
      colorCodeOptions: draftColorCodeOptions,
    };
    const cascadeByRemovedId = new Map(
      stagedCascades.map((entry) => [entry.removedOptionId, entry.newValue]),
    );
    const originalRowValues = originalRowValuesRef.current;
    const forwardCellWrites: CellWrite[] = [];
    const inverseCellWrites: CellWrite[] = [];
    for (const row of rows) {
      const rowId = getRowId(row);
      const originalValue = originalRowValues.get(rowId) ?? null;
      if (!originalValue || !cascadeByRemovedId.has(originalValue)) continue;
      const newValue = cascadeByRemovedId.get(originalValue) ?? null;
      forwardCellWrites.push({ rowId, fieldKey: fieldDef.field_key, value: newValue });
      inverseCellWrites.push({ rowId, fieldKey: fieldDef.field_key, value: originalValue });
    }
    const forward: WriteOp = {
      kind: "schemaMutation",
      variant: "legacyOptions",
      before,
      after,
      ...(forwardCellWrites.length > 0 ? { cellWrites: forwardCellWrites } : {}),
    };
    const inverse: WriteOp = {
      kind: "schemaMutation",
      variant: "legacyOptions",
      before: after,
      after: before,
      ...(inverseCellWrites.length > 0 ? { cellWrites: inverseCellWrites } : {}),
    };
    try {
      await dispatchWrite(forward, inverse);
      onOpenChange(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed.");
    }
  }, [
    canSave,
    dispatchWrite,
    draftColorCodeOptions,
    draftOptions,
    fieldDef,
    getRowId,
    onOpenChange,
    rows,
    stagedCascades,
  ]);

  const itemIds = useMemo(() => draftOptions.map((option) => option.id), [draftOptions]);
  const confirmingOption = confirmingOptionId
    ? (draftOptions.find((option) => option.id === confirmingOptionId) ?? null)
    : null;
  const replacementOptions = useMemo(
    () =>
      confirmingOptionId ? draftOptions.filter((option) => option.id !== confirmingOptionId) : [],
    [confirmingOptionId, draftOptions],
  );

  const handleOutsideInteraction = (event: {
    target: EventTarget | null;
    preventDefault: () => void;
  }) => {
    // Keep the popover open when interaction lands inside the nested
    // confirm sub-dialog (its own Portal sits outside the popover tree).
    const target = event.target as Element | null;
    if (target?.closest('[role="alertdialog"]')) event.preventDefault();
  };

  return (
    <>
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        {anchorElement ? <FieldEditorAnchor anchor={anchorElement} /> : null}
        <Popover.Portal>
          <Popover.Content
            className="data-table-view-popover data-table-field-editor"
            align="start"
            side="bottom"
            sideOffset={6}
            collisionPadding={8}
            aria-label={`Edit ${fieldDef.display_name} options`}
            onPointerDownOutside={handleOutsideInteraction}
            onInteractOutside={handleOutsideInteraction}
          >
            <div className="data-table-view-popover-heading">{fieldDef.display_name}</div>
            <div className="data-table-field-editor-options-header">
              <span className="data-table-view-popover-subheading">Options</span>
              <label className="data-table-field-editor-toggle">
                <input
                  type="checkbox"
                  checked={draftColorCodeOptions}
                  onChange={(event) => setDraftColorCodeOptions(event.target.checked)}
                />
                <span>Color-code options</span>
              </label>
              <button
                type="button"
                className="data-table-view-popover-add data-table-field-editor-alphabetize"
                onClick={alphabetize}
                disabled={draftOptions.length < 2}
              >
                ↕ Alphabetize
              </button>
            </div>
            {draftOptions.length === 0 ? (
              <div className="data-table-view-popover-empty">No options yet.</div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  <ul className="data-table-field-editor-list" role="list">
                    {draftOptions.map((option) => (
                      <FieldEditorOptionRow
                        key={option.id}
                        option={option}
                        referenceCount={referenceCounts[option.id] ?? 0}
                        autofocus={focusOnMountIdRef.current === option.id}
                        onLabelChange={(label) => updateOption(option.id, { label })}
                        onColorChange={(color) => updateOption(option.id, { color })}
                        onRemove={() => handleDelete(option.id)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
            <button
              type="button"
              className="data-table-view-popover-add data-table-field-editor-add"
              onClick={addOption}
            >
              ⊕ Add option
            </button>
            {duplicateLabels ? (
              <p className="form-error data-table-field-editor-error">
                Option labels must be unique.
              </p>
            ) : null}
            {hasEmptyLabel ? (
              <p className="form-error data-table-field-editor-error">
                Every option needs a label.
              </p>
            ) : null}
            {missingRefs.length > 0 ? (
              <p className="form-note data-table-field-editor-warning">
                {missingRefs.length} row{missingRefs.length === 1 ? "" : "s"} reference
                {missingRefs.length === 1 ? "s" : ""} an unknown option.
              </p>
            ) : null}
            {saveError ? (
              <p className="form-error data-table-field-editor-error" role="alert">
                {saveError}
              </p>
            ) : null}
            <div className="data-table-field-editor-footer">
              <button type="button" className="secondary-button" onClick={handleCancel}>
                Cancel
              </button>
              <button type="button" disabled={!canSave} onClick={() => void handleSave()}>
                Save
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <ConfirmDeleteOptionDialog
        open={confirmingOptionId !== null}
        option={confirmingOption}
        referenceCount={confirmingOptionId ? (referenceCounts[confirmingOptionId] ?? 0) : 0}
        required={Boolean(fieldDef.required)}
        fieldDisplayName={fieldDef.display_name}
        replacementOptions={replacementOptions}
        onCancel={() => setConfirmingOptionId(null)}
        onConfirm={handleCascadeConfirm}
      />
    </>
  );
}

function FieldEditorAnchor({ anchor }: { anchor: HTMLElement }) {
  const virtualRef = useMemo(
    () => ({ current: { getBoundingClientRect: () => anchor.getBoundingClientRect() } }),
    [anchor],
  );
  return <Popover.Anchor virtualRef={virtualRef} />;
}

type OptionRowProps = {
  option: DraftOption;
  referenceCount: number;
  autofocus: boolean;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onRemove: () => void;
};

function FieldEditorOptionRow({
  option,
  referenceCount,
  autofocus,
  onLabelChange,
  onColorChange,
  onRemove,
}: OptionRowProps) {
  const sortable = useSortable({ id: option.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autofocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [autofocus]);

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="data-table-field-editor-row"
      data-dragging={sortable.isDragging ? "true" : undefined}
    >
      <button
        type="button"
        className="data-table-view-popover-drag"
        aria-label={`Reorder ${option.label || "option"}`}
        ref={sortable.setActivatorNodeRef}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        ⋮⋮
      </button>
      <ColorCirclePopover color={option.color} label={option.label} onColorChange={onColorChange} />
      <input
        ref={inputRef}
        aria-label={`Option label for ${option.label || "new option"}`}
        className="data-table-field-editor-label-input"
        value={option.label}
        onChange={(event) => onLabelChange(event.target.value)}
      />
      {referenceCount > 0 ? (
        <span className="data-table-field-editor-refcount">
          {referenceCount} row{referenceCount === 1 ? "" : "s"}
        </span>
      ) : (
        <span aria-hidden />
      )}
      <button
        type="button"
        className="data-table-view-popover-remove"
        aria-label={`Delete option ${option.label || "new option"}`}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  );
}

function ColorCirclePopover({
  color,
  label,
  onColorChange,
}: {
  color: string;
  label: string;
  onColorChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="data-table-field-editor-color-circle"
          aria-label={`Color for ${label || "option"}`}
          style={{ "--option-color": color } as CSSProperties}
        >
          <span aria-hidden className="data-table-field-editor-color-chevron">
            ▾
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-field-editor-color-picker"
          align="start"
          sideOffset={4}
          aria-label="Pick option color"
        >
          {OPTION_COLOR_PALETTE.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="data-table-field-editor-color-swatch"
              aria-label={swatch}
              aria-pressed={swatch === color}
              style={{ "--option-color": swatch } as CSSProperties}
              onClick={() => {
                onColorChange(swatch);
                setOpen(false);
              }}
            />
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function optionListsEquivalent(a: readonly FieldOption[], b: readonly FieldOption[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(normalizeOptionOrders(a)) === JSON.stringify(normalizeOptionOrders(b));
}
