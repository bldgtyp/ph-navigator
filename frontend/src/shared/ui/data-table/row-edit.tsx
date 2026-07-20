import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { parseNumberInput } from "../../../lib/units/format";
import { AutocompleteSelect } from "../AutocompleteSelect";
import { DialogActions } from "../DialogActions";
import { ModalDialog } from "../ModalDialog";
import { LinkedRecordPicker, type LinkedRecordPickerCandidate } from "./fields/linkedRecord/Picker";

export function RowEditModal({
  title,
  titleId,
  onCancel,
  onSubmit,
  error,
  isSaving,
  readOnly = false,
  frozenReason,
  onFrozenReload,
  submitLabel,
  cancelLabel = readOnly ? "Close" : "Cancel",
  deleteLabel,
  onDelete,
  deleteDisabled = false,
  children,
}: {
  title: string;
  titleId: string;
  onCancel: () => void;
  onSubmit: () => void;
  error?: string | null;
  isSaving: boolean;
  readOnly?: boolean;
  frozenReason?: string | null;
  onFrozenReload?: () => void;
  submitLabel: string;
  cancelLabel?: string;
  deleteLabel?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  children: ReactNode;
}) {
  const isFrozen = Boolean(frozenReason);
  const submitDisabled = readOnly || isSaving || isFrozen;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitDisabled) onSubmit();
  };

  return (
    <ModalDialog
      title={title}
      titleId={titleId}
      onClose={onCancel}
      // Read-only mode is a viewer: click-away dismiss is expected. Edit mode
      // is a form: no backdrop dismiss so unsaved input can't be lost.
      dismissOnBackdrop={readOnly}
      resizable
    >
      <form className="project-form table-row-modal-form" noValidate onSubmit={handleSubmit}>
        {frozenReason ? (
          <div className="draft-banner draft-conflict-banner" role="alert">
            <span>{frozenReason}</span>
            {onFrozenReload ? (
              <button type="button" className="secondary-button" onClick={onFrozenReload}>
                Reload draft
              </button>
            ) : null}
          </div>
        ) : null}
        {children}
        {readOnly ? (
          // View-only: the single dismiss reads "Close" (contract exception).
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              {cancelLabel}
            </button>
          </div>
        ) : (
          <DialogActions
            busy={isSaving}
            error={error ?? null}
            submitLabel={submitLabel}
            onClose={onCancel}
            submitDisabled={submitDisabled}
            extraActions={
              onDelete ? (
                <button
                  type="button"
                  className="danger-button"
                  onClick={onDelete}
                  disabled={deleteDisabled}
                >
                  {deleteLabel ?? "Delete"}
                </button>
              ) : undefined
            }
          />
        )}
      </form>
    </ModalDialog>
  );
}

export function RowEditSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="table-row-modal-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function RowEditGrid({ children }: { children: ReactNode }) {
  return <div className="table-row-modal-grid">{children}</div>;
}

export function TextField({
  label,
  value,
  disabled,
  className,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className={className}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  disabled,
  rows = 4,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  rows?: number;
  onChange: (value: string | null) => void;
}) {
  return (
    <label>
      {label}
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  disabled,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | null;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  onChange: (value: number | null) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(parseNumberInput(event.target.value))}
        disabled={disabled}
      />
    </label>
  );
}

type ModalSingleSelectOption = {
  id: string;
  label: string;
  color?: string | null;
};

export function ModalSingleSelectField({
  label,
  value,
  options,
  disabled,
  placeholder = "Not set",
  onCreate,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly ModalSingleSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  onCreate?: (label: string) => Promise<string>;
  onChange: (value: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteOptions = useMemo(
    () => [
      { value: "", label: placeholder },
      ...options.map((option) => ({
        value: option.id,
        label: option.label,
        color: option.color ?? undefined,
      })),
    ],
    [options, placeholder],
  );

  const submitNew = async () => {
    if (!onCreate) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Option label is required.");
      return;
    }
    if (
      options.some(
        (option) => option.label.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      )
    ) {
      setError("That option already exists; pick it from the list.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const optionId = await onCreate(trimmed);
      onChange(optionId);
      setDraft("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add option.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div>
      <AutocompleteSelect
        className="data-table-modal-single-select"
        label={label}
        value={value ?? ""}
        disabled={disabled}
        placeholder={placeholder}
        options={autocompleteOptions}
        onChange={(next) => onChange(next || null)}
      />
      {!disabled && onCreate ? (
        adding ? (
          <span className="data-table-modal-option-add-inline">
            <input
              autoFocus
              value={draft}
              placeholder="New option label"
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitNew();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setAdding(false);
                  setDraft("");
                  setError(null);
                }
              }}
              disabled={pending}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => void submitNew()}
              disabled={pending}
            >
              Add
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setAdding(false);
                setDraft("");
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="link-button data-table-modal-option-add-trigger"
            onClick={() => setAdding(true)}
          >
            + Add option
          </button>
        )
      ) : null}
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ModalLinkedRecordField({
  label,
  value,
  candidates,
  disabled,
  placeholder = "None",
  emptyMessage = "No records available.",
  onChange,
}: {
  label: string;
  value: string | null;
  candidates: readonly LinkedRecordPickerCandidate[];
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  onChange: (value: string | null) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const selected = value ? candidates.find((candidate) => candidate.rowId === value) : null;
  const selectedLabel = selected?.recordId || selected?.rowId || placeholder;

  return (
    <label>
      {label}
      <span className="data-table-modal-linked-record-field">
        <button
          type="button"
          className="secondary-button data-table-modal-linked-record-button"
          aria-label={`${label}: ${selectedLabel}`}
          disabled={disabled || candidates.length === 0}
          onClick={() => setPickerOpen(true)}
        >
          {candidates.length === 0 ? emptyMessage : selectedLabel}
        </button>
        {!disabled && value ? (
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            Clear
          </button>
        ) : null}
      </span>
      {pickerOpen ? (
        <LinkedRecordPicker
          open
          mode="single"
          selectedIds={value ? [value] : []}
          candidates={candidates}
          title={label}
          onCancel={() => setPickerOpen(false)}
          onConfirm={(nextIds) => {
            onChange(nextIds[0] ?? null);
            setPickerOpen(false);
          }}
        />
      ) : null}
    </label>
  );
}
