import * as Popover from "@radix-ui/react-popover";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ApiRequestError } from "../../../api/client";
import type { CustomFieldType } from "../hooks/useTableSchema";

// Phase-2 surface. `single_select` (Phase 3) and `formula` (Phase 4)
// appear as disabled pills so the eventual full set is visible — see
// US-CF-2. Order matches plan-15 §P2.6.
const ENABLED_TYPES: ReadonlyArray<{ kind: CustomFieldType; label: string; hint: string }> = [
  { kind: "short_text", label: "Short text", hint: "Single-line text." },
  { kind: "long_text", label: "Long text", hint: "Multi-line text." },
  { kind: "number", label: "Number", hint: "Numeric value with optional precision." },
  { kind: "url", label: "URL", hint: "Link target (validated server-side)." },
];
const DISABLED_TYPES: ReadonlyArray<{ kind: CustomFieldType; label: string; planned: string }> = [
  { kind: "single_select", label: "Single select", planned: "Phase 3" },
  { kind: "formula", label: "Formula", planned: "Phase 4" },
];

const MAX_DISPLAY_NAME = 120;
const MAX_DESCRIPTION = 280;
const MIN_PRECISION = 0;
const MAX_PRECISION = 10;
const DEFAULT_PRECISION = 2;

export type AddCustomFieldRequest = {
  displayName: string;
  fieldType: CustomFieldType;
  config: Record<string, unknown>;
  description: string | null;
  insertAfterFieldKey: string | null;
};

export type AddFieldPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  // Visual anchor in `view.columnOrder` ("insert this new field right
  // after this fieldKey"). Null means "append at end". Any fieldKey is
  // accepted — the consumer decides what subset (custom-only) to
  // forward to the backend's `insert_after_field_id`.
  insertAfterFieldKey: string | null;
  // Used for case-insensitive trimmed duplicate-name preflight per
  // US-CF-12. Includes both core and custom display names.
  existingFieldNames: ReadonlyArray<string>;
  dispatchAddField: (request: AddCustomFieldRequest) => Promise<void>;
};

type FormState = {
  displayName: string;
  fieldType: CustomFieldType;
  descriptionEnabled: boolean;
  description: string;
  numberPrecision: number;
};

const INITIAL_STATE: FormState = {
  displayName: "",
  fieldType: "short_text",
  descriptionEnabled: false,
  description: "",
  numberPrecision: DEFAULT_PRECISION,
};

export function AddFieldPopover({
  open,
  onOpenChange,
  anchorElement,
  insertAfterFieldKey,
  existingFieldNames,
  dispatchAddField,
}: AddFieldPopoverProps) {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputId = useId();
  const descriptionId = useId();
  const precisionId = useId();

  // Re-seed only on open transitions so a parent refetch mid-edit can't
  // wipe the user's in-progress draft.
  useEffect(() => {
    if (!open) return;
    setState(INITIAL_STATE);
    setSubmitError(null);
    setPending(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Defer focus until Radix has mounted the popover content.
    const handle = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  const trimmedName = state.displayName.trim();
  const normalizedNames = useMemo(
    () => new Set(existingFieldNames.map((name) => name.trim().toLowerCase())),
    [existingFieldNames],
  );
  const localNameError = useMemo(() => {
    if (!trimmedName) return null;
    if (trimmedName.length > MAX_DISPLAY_NAME) {
      return `Field name must be ${MAX_DISPLAY_NAME} characters or fewer.`;
    }
    if (normalizedNames.has(trimmedName.toLowerCase())) {
      return `A field named "${trimmedName}" already exists in this table.`;
    }
    return null;
  }, [trimmedName, normalizedNames]);

  const canSubmit = Boolean(trimmedName) && !localNameError && !pending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const description = state.descriptionEnabled ? state.description.trim() : "";
    const config: Record<string, unknown> =
      state.fieldType === "number" ? { precision: state.numberPrecision } : {};
    const request: AddCustomFieldRequest = {
      displayName: trimmedName,
      fieldType: state.fieldType,
      config,
      description: description ? description : null,
      insertAfterFieldKey,
    };
    setPending(true);
    setSubmitError(null);
    try {
      await dispatchAddField(request);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(messageForError(error));
    } finally {
      setPending(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {anchorElement ? <AddFieldAnchor anchor={anchorElement} /> : null}
      <Popover.Portal>
        <Popover.Content
          className="data-table-add-field-popover"
          side="bottom"
          align="start"
          sideOffset={6}
          role="dialog"
          aria-label="Add field"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onKeyDown={handleKeyDown}
        >
          <form className="data-table-add-field-form" onSubmit={(event) => void handleSubmit(event)}>
            <label className="data-table-add-field-label" htmlFor={nameInputId}>
              Field name
            </label>
            <input
              id={nameInputId}
              ref={nameInputRef}
              type="text"
              className="data-table-add-field-input"
              value={state.displayName}
              maxLength={MAX_DISPLAY_NAME}
              autoComplete="off"
              aria-invalid={localNameError ? true : undefined}
              aria-describedby={localNameError ? `${nameInputId}-error` : undefined}
              onChange={(event) =>
                setState((prev) => ({ ...prev, displayName: event.target.value }))
              }
            />
            {localNameError ? (
              <p
                id={`${nameInputId}-error`}
                className="form-error data-table-add-field-inline-error"
                role="alert"
              >
                {localNameError}
              </p>
            ) : null}

            <fieldset className="data-table-add-field-types">
              <legend className="data-table-add-field-label">Field type</legend>
              <div className="data-table-add-field-type-row" role="radiogroup" aria-label="Field type">
                {ENABLED_TYPES.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={state.fieldType === option.kind}
                    className="data-table-add-field-type-pill"
                    data-active={state.fieldType === option.kind ? "true" : undefined}
                    title={option.hint}
                    onClick={() => setState((prev) => ({ ...prev, fieldType: option.kind }))}
                  >
                    {option.label}
                  </button>
                ))}
                {DISABLED_TYPES.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={false}
                    aria-disabled
                    disabled
                    className="data-table-add-field-type-pill"
                    data-disabled="true"
                    title={`Coming in ${option.planned}.`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {state.fieldType === "number" ? (
              <div className="data-table-add-field-config">
                <label className="data-table-add-field-label" htmlFor={precisionId}>
                  Decimal precision
                </label>
                <input
                  id={precisionId}
                  type="number"
                  className="data-table-add-field-input"
                  min={MIN_PRECISION}
                  max={MAX_PRECISION}
                  step={1}
                  value={state.numberPrecision}
                  onChange={(event) => {
                    const raw = Number.parseInt(event.target.value, 10);
                    const next = Number.isFinite(raw)
                      ? Math.min(Math.max(raw, MIN_PRECISION), MAX_PRECISION)
                      : DEFAULT_PRECISION;
                    setState((prev) => ({ ...prev, numberPrecision: next }));
                  }}
                />
              </div>
            ) : null}

            <div className="data-table-add-field-description-row">
              <label className="data-table-add-field-toggle">
                <input
                  type="checkbox"
                  checked={state.descriptionEnabled}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, descriptionEnabled: event.target.checked }))
                  }
                />
                Add description
              </label>
              {state.descriptionEnabled ? (
                <>
                  <label className="sr-only" htmlFor={descriptionId}>
                    Field description
                  </label>
                  <textarea
                    id={descriptionId}
                    className="data-table-add-field-textarea"
                    value={state.description}
                    maxLength={MAX_DESCRIPTION}
                    rows={3}
                    onChange={(event) =>
                      setState((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                  <span className="data-table-add-field-counter" aria-hidden>
                    {state.description.trim().length}/{MAX_DESCRIPTION}
                  </span>
                </>
              ) : null}
            </div>

            {submitError ? (
              <p className="form-error data-table-add-field-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="data-table-add-field-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={handleCancel}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit}>
                {pending ? "Adding…" : "Add field"}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AddFieldAnchor({ anchor }: { anchor: HTMLElement }) {
  const virtualRef = useMemo(
    () => ({ current: { getBoundingClientRect: () => anchor.getBoundingClientRect() } }),
    [anchor],
  );
  return <Popover.Anchor virtualRef={virtualRef} />;
}

// `custom_field_*` codes from the P2.0 ADR. The inline error band names
// the offending field when the server reports a dup, and tells the user
// to refresh when the schema fingerprint went stale.
function messageForError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const code = error.errorCode;
    if (code === "custom_field_duplicate_name") {
      const colliding = typeof error.details.field_name === "string" ? error.details.field_name : null;
      return colliding
        ? `A field named "${colliding}" already exists in this table.`
        : "A field with that name already exists in this table.";
    }
    if (code === "custom_field_stale_schema_fingerprint") {
      return "Someone else added or changed a field on this table. Refresh and try again.";
    }
    if (code === "version_locked") {
      return "This version is locked. Save As to start an editable copy and try again.";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Could not add field.";
}
