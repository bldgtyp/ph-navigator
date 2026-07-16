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
import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createFieldOption, nonEmptyFieldOptions } from "../lib/options/create";
import { hasDuplicateFieldOptionLabels, missingOptionReferences } from "../lib/options/references";
import { normalizeOptionOrders } from "../lib/options/normalize";
import type { FieldOption } from "../types";
import { ConfirmDeleteOptionDialog, type CascadeChoice } from "./ConfirmDeleteOptionDialog";
import { OptionColorPicker } from "./OptionColorPicker";
import { SingleSelectDefaultPicker } from "./SingleSelectDefaultPicker";

export type OptionSourceRow = { rowId: string; rawValue: unknown };

export type FieldConfigSectionOptionsProps = {
  fieldDisplayName: string;
  sourceOptions: readonly FieldOption[];
  sourceColorCodeOptions: boolean;
  sourceDefaultOptionId: string | null;
  rows: readonly OptionSourceRow[];
  required: boolean;
  disabled: boolean;
  onDraftChange: (draft: {
    options: FieldOption[];
    colorCodeOptions: boolean;
    defaultOptionId: string | null;
    optionReplacements: Record<string, string>;
    valid: boolean;
    dirty: boolean;
  }) => void;
};

export function FieldConfigSectionOptions({
  fieldDisplayName,
  sourceOptions,
  sourceColorCodeOptions,
  sourceDefaultOptionId,
  rows,
  required,
  disabled,
  onDraftChange,
}: FieldConfigSectionOptionsProps) {
  const [draftOptions, setDraftOptions] = useState<FieldOption[]>(() => [...sourceOptions]);
  const [draftColorCodeOptions, setDraftColorCodeOptions] = useState(sourceColorCodeOptions);
  const [draftDefaultOptionId, setDraftDefaultOptionId] = useState<string | null>(
    sourceDefaultOptionId,
  );
  const [confirmingOptionId, setConfirmingOptionId] = useState<string | null>(null);
  const [optionReplacements, setOptionReplacements] = useState<Record<string, string>>({});
  const focusOnMountIdRef = useRef<string | null>(null);

  useEffect(() => {
    setDraftOptions([...sourceOptions]);
    setDraftColorCodeOptions(sourceColorCodeOptions);
    setDraftDefaultOptionId(sourceDefaultOptionId);
    setConfirmingOptionId(null);
    setOptionReplacements({});
    focusOnMountIdRef.current = null;
  }, [sourceOptions, sourceColorCodeOptions, sourceDefaultOptionId]);

  const referenceCounts = useMemo(() => optionReferenceCounts(rows), [rows]);
  const missingRefs = useMemo(
    () => missingOptionReferences(rows, sourceOptions, (row) => row.rawValue),
    [rows, sourceOptions],
  );
  // A blank row is the "new option" affordance, not an error: it never
  // blocks Save and is dropped from the saved set (Airtable parity), so the
  // modal no longer yells "needs a label" the instant a row is added. Only
  // real conflicts surface — duplicate labels, or an *in-use* option that was
  // blanked (which would strand the rows still referencing it).
  const nonEmptyOptions = useMemo(() => nonEmptyFieldOptions(draftOptions), [draftOptions]);
  const duplicateLabels = hasDuplicateFieldOptionLabels(draftOptions);
  const referencedBlankLabel = draftOptions.some(
    (option) => !option.label.trim() && (referenceCounts[option.id] ?? 0) > 0,
  );
  const valid = !duplicateLabels && !referencedBlankLabel;
  const normalizedDraftOptions = useMemo(
    () => normalizeOptionOrders(nonEmptyOptions),
    [nonEmptyOptions],
  );
  const dirty =
    !optionListsEquivalent(sourceOptions, nonEmptyOptions) ||
    draftColorCodeOptions !== sourceColorCodeOptions ||
    draftDefaultOptionId !== sourceDefaultOptionId;

  useEffect(() => {
    const ids = new Set(draftOptions.map((option) => option.id));
    if (draftDefaultOptionId !== null && !ids.has(draftDefaultOptionId)) {
      setDraftDefaultOptionId(null);
    }
  }, [draftDefaultOptionId, draftOptions]);

  useEffect(() => {
    onDraftChange({
      options: normalizedDraftOptions,
      colorCodeOptions: draftColorCodeOptions,
      defaultOptionId: draftDefaultOptionId,
      optionReplacements,
      valid,
      dirty,
    });
  }, [
    dirty,
    draftColorCodeOptions,
    draftDefaultOptionId,
    optionReplacements,
    normalizedDraftOptions,
    onDraftChange,
    valid,
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateOption = useCallback((id: string, patch: Partial<FieldOption>) => {
    setDraftOptions((prev) =>
      prev.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    );
  }, []);

  const removeOptionFromDraft = useCallback((id: string) => {
    setDraftOptions((prev) => prev.filter((option) => option.id !== id));
    setDraftDefaultOptionId((current) => (current === id ? null : current));
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      if ((referenceCounts[id] ?? 0) === 0) {
        removeOptionFromDraft(id);
        setOptionReplacements((current) => withoutKey(current, id));
        return;
      }
      setConfirmingOptionId(id);
    },
    [referenceCounts, removeOptionFromDraft],
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

  const itemIds = useMemo(() => draftOptions.map((option) => option.id), [draftOptions]);
  const confirmingOption = confirmingOptionId
    ? (draftOptions.find((option) => option.id === confirmingOptionId) ?? null)
    : null;
  const replacementOptions = useMemo(
    () =>
      confirmingOptionId
        ? draftOptions.filter((option) => option.id !== confirmingOptionId && option.label.trim())
        : [],
    [confirmingOptionId, draftOptions],
  );

  const handleConfirmDelete = useCallback(
    (choice: CascadeChoice) => {
      if (!confirmingOptionId) return;
      if (choice.kind === "replace") {
        setOptionReplacements((current) => ({
          ...current,
          [confirmingOptionId]: choice.replacementId,
        }));
      } else {
        setOptionReplacements((current) => withoutKey(current, confirmingOptionId));
      }
      removeOptionFromDraft(confirmingOptionId);
      setConfirmingOptionId(null);
    },
    [confirmingOptionId, removeOptionFromDraft],
  );

  return (
    <>
      <div className="data-table-field-config-modal-section">
        <div className="data-table-field-editor-options-header">
          <span className="data-table-field-config-label">Options</span>
          <label className="data-table-field-editor-toggle">
            <input
              type="checkbox"
              checked={draftColorCodeOptions}
              disabled={disabled}
              onChange={(event) => setDraftColorCodeOptions(event.target.checked)}
            />
            <span>Color-code options</span>
          </label>
          <button
            type="button"
            className="data-table-view-popover-add data-table-field-editor-alphabetize"
            onClick={alphabetize}
            disabled={disabled || draftOptions.length < 2}
          >
            ↕ Alphabetize
          </button>
        </div>
        {draftOptions.length === 0 ? (
          <div className="data-table-view-popover-empty">No options yet.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <ul className="data-table-field-editor-list" role="list">
                {draftOptions.map((option) => (
                  <OptionRow
                    key={option.id}
                    option={option}
                    referenceCount={referenceCounts[option.id] ?? 0}
                    autofocus={focusOnMountIdRef.current === option.id}
                    disabled={disabled}
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
          disabled={disabled}
        >
          ⊕ Add option
        </button>
        <SingleSelectDefaultPicker
          options={nonEmptyOptions}
          value={draftDefaultOptionId}
          onChange={setDraftDefaultOptionId}
          disabled={disabled}
        />
        {duplicateLabels ? (
          <p className="form-error data-table-field-editor-error">Option labels must be unique.</p>
        ) : null}
        {referencedBlankLabel ? (
          <p className="form-error data-table-field-editor-error">
            An option that rows still use can’t have an empty label.
          </p>
        ) : null}
        {missingRefs.length > 0 ? (
          <p className="form-note data-table-field-editor-warning">
            {missingRefs.length} row{missingRefs.length === 1 ? "" : "s"} reference
            {missingRefs.length === 1 ? "s" : ""} an unknown option.
          </p>
        ) : null}
      </div>
      <ConfirmDeleteOptionDialog
        open={confirmingOptionId !== null}
        option={confirmingOption}
        referenceCount={confirmingOptionId ? (referenceCounts[confirmingOptionId] ?? 0) : 0}
        required={required}
        fieldDisplayName={fieldDisplayName}
        replacementOptions={replacementOptions}
        allowReplacement
        onCancel={() => setConfirmingOptionId(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

type OptionRowProps = {
  option: FieldOption;
  referenceCount: number;
  autofocus: boolean;
  disabled: boolean;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onRemove: () => void;
};

function OptionRow({
  option,
  referenceCount,
  autofocus,
  disabled,
  onLabelChange,
  onColorChange,
  onRemove,
}: OptionRowProps) {
  const sortable = useSortable({ id: option.id, disabled });
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
        className="data-table-view-popover-drag data-table-field-editor-drag"
        aria-label={`Reorder ${option.label || "option"}`}
        ref={sortable.setActivatorNodeRef}
        disabled={disabled}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical aria-hidden />
      </button>
      <OptionColorPicker
        color={option.color}
        label={option.label}
        disabled={disabled}
        onColorChange={onColorChange}
      />
      <input
        ref={inputRef}
        aria-label={`Option label for ${option.label || "new option"}`}
        className="data-table-field-editor-label-input"
        value={option.label}
        disabled={disabled}
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
        disabled={disabled}
        onClick={onRemove}
      >
        ×
      </button>
    </li>
  );
}

function optionReferenceCounts(rows: readonly OptionSourceRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (typeof row.rawValue !== "string" || !row.rawValue) continue;
    counts[row.rawValue] = (counts[row.rawValue] ?? 0) + 1;
  }
  return counts;
}

function withoutKey(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function optionListsEquivalent(a: readonly FieldOption[], b: readonly FieldOption[]): boolean {
  if (a.length !== b.length) return false;
  return JSON.stringify(normalizeOptionOrders(a)) === JSON.stringify(normalizeOptionOrders(b));
}
