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
import type { CustomFieldType } from "../hooks/useTableSchema";
import { createFieldOption, OPTION_COLOR_PALETTE } from "../lib";
import { MAX_DESCRIPTION, MAX_DISPLAY_NAME } from "../lib/customFieldMutations";
import { normalizeDisplayName } from "../lib/fieldDisplayNames";
import { DEFAULT_NUMBER_PRECISION } from "../lib/numberPrecision";
import { useElementAnchorRef } from "../lib/popoverAnchor";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";
import {
  SOURCE_LENGTH_MAX,
  astToJson,
  formatLocalFormulaError,
  parseFormulaSource,
  type FieldRegistryEntry,
  type LocalFormulaState,
} from "../lib/formula";
import { FormulaFieldPalette } from "./FormulaFieldPalette";
import { FieldConfigSectionNumber } from "./FieldConfigSectionNumber";
import { SingleSelectDefaultPicker } from "./SingleSelectDefaultPicker";
import type { FieldOption } from "../types";

const ENABLED_TYPES: ReadonlyArray<{ kind: CustomFieldType; label: string; hint: string }> = [
  { kind: "short_text", label: "Short text", hint: "Single-line text." },
  { kind: "long_text", label: "Long text", hint: "Multi-line text." },
  { kind: "number", label: "Number", hint: "Numeric value with optional precision." },
  { kind: "url", label: "URL", hint: "Link target (validated server-side)." },
  { kind: "single_select", label: "Single select", hint: "Pick one option from a defined list." },
  {
    kind: "formula",
    label: "Formula",
    hint: "Read-only value computed from other fields.",
  },
];
const DISABLED_TYPES: ReadonlyArray<{ kind: CustomFieldType; label: string; planned: string }> = [];

export type AddCustomFieldRequest = {
  displayName: string;
  fieldType: CustomFieldType;
  config: Record<string, unknown>;
  description: string | null;
  // Only set when `fieldType === "single_select"`. Carries the initial
  // option list so add-with-options is one atomic POST.
  initialOptions?: FieldOption[];
  // Visual anchor in `view.columnOrder` ("insert this new field right
  // after this fieldKey"). Null means "append at end". Any fieldKey is
  // accepted — the consumer decides what subset (custom-only) to
  // forward to the backend's `insert_after_field_id`.
  insertAfterFieldKey: string | null;
};

export type AddFieldPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  insertAfterFieldKey: string | null;
  // Used for case-insensitive trimmed duplicate-name preflight per
  // US-CF-12. Includes both core and custom display names.
  existingFieldNames: ReadonlyArray<string>;
  dispatchAddField: (request: AddCustomFieldRequest) => Promise<void>;
  // Required for the formula pill's parser + palette. When absent
  // the pill still appears but with no resolvable refs.
  formulaFieldRegistry?: ReadonlyArray<FieldRegistryEntry>;
};

type FormState = {
  displayName: string;
  fieldType: CustomFieldType;
  descriptionEnabled: boolean;
  description: string;
  numberPrecision: number;
  options: FieldOption[];
  defaultOptionId: string | null;
  formulaSource: string;
};

const INITIAL_STATE: FormState = {
  displayName: "",
  fieldType: "short_text",
  descriptionEnabled: false,
  description: "",
  numberPrecision: DEFAULT_NUMBER_PRECISION,
  options: [],
  defaultOptionId: null,
  formulaSource: "",
};

export function AddFieldPopover({
  open,
  onOpenChange,
  anchorElement,
  insertAfterFieldKey,
  existingFieldNames,
  dispatchAddField,
  formulaFieldRegistry,
}: AddFieldPopoverProps) {
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputId = useId();
  const descriptionId = useId();

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
    () => new Set(existingFieldNames.map(normalizeDisplayName)),
    [existingFieldNames],
  );
  const localNameError = useMemo(() => {
    if (!trimmedName) return null;
    if (trimmedName.length > MAX_DISPLAY_NAME) {
      return `Field name must be ${MAX_DISPLAY_NAME} characters or fewer.`;
    }
    if (normalizedNames.has(normalizeDisplayName(trimmedName))) {
      return `A field named "${trimmedName}" already exists in this table.`;
    }
    return null;
  }, [trimmedName, normalizedNames]);

  const optionsValid = useMemo(() => {
    if (state.fieldType !== "single_select") return true;
    if (state.options.length === 0) return false;
    const labels = new Set<string>();
    for (const option of state.options) {
      const trimmed = option.label.trim();
      if (!trimmed) return false;
      const normalized = trimmed.toLocaleLowerCase();
      if (labels.has(normalized)) return false;
      labels.add(normalized);
    }
    return true;
  }, [state.fieldType, state.options]);

  const formulaState = useMemo<LocalFormulaState>(() => {
    if (state.fieldType !== "formula") return { kind: "empty" };
    return parseFormulaSource(state.formulaSource, formulaFieldRegistry ?? []);
  }, [state.fieldType, state.formulaSource, formulaFieldRegistry]);
  const formulaError = useMemo(() => formatLocalFormulaError(formulaState), [formulaState]);
  const formulaValid = state.fieldType !== "formula" || formulaState.kind === "ok";

  const formulaSourceInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const handleInsertFormulaToken = (token: string) => {
    const el = formulaSourceInputRef.current;
    if (!el) {
      setState((prev) =>
        prev.formulaSource.length + token.length > SOURCE_LENGTH_MAX
          ? prev
          : { ...prev, formulaSource: `${prev.formulaSource}${token}` },
      );
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = `${el.value.slice(0, start)}${token}${el.value.slice(end)}`;
    if (next.length > SOURCE_LENGTH_MAX) return;
    setState((prev) => ({ ...prev, formulaSource: next }));
  };

  const canSubmit =
    Boolean(trimmedName) && !localNameError && optionsValid && formulaValid && !pending;

  const virtualAnchorRef = useElementAnchorRef(anchorElement);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    const description = state.descriptionEnabled ? state.description.trim() : "";
    let config: Record<string, unknown> = {};
    if (state.fieldType === "number") {
      config = { precision: state.numberPrecision };
    } else if (state.fieldType === "single_select") {
      config = { default_option_id: state.defaultOptionId };
    } else if (state.fieldType === "formula") {
      if (formulaState.kind !== "ok") return;
      config = {
        source: state.formulaSource,
        ast: astToJson(formulaState.ast),
        deps: [...formulaState.deps],
      };
    }
    const request: AddCustomFieldRequest = {
      displayName: trimmedName,
      fieldType: state.fieldType,
      config,
      description: description ? description : null,
      insertAfterFieldKey,
    };
    if (state.fieldType === "single_select") {
      request.initialOptions = state.options.map((option, index) => ({
        ...option,
        label: option.label.trim(),
        order: index + 1,
      }));
    }
    setPending(true);
    setSubmitError(null);
    try {
      await dispatchAddField(request);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(schemaMutationErrorMessage(error, "Could not add field."));
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {virtualAnchorRef ? <Popover.Anchor virtualRef={virtualAnchorRef} /> : null}
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
          <form
            className="data-table-add-field-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
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
              <div
                className="data-table-add-field-type-row"
                role="radiogroup"
                aria-label="Field type"
              >
                {ENABLED_TYPES.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={state.fieldType === option.kind}
                    className="data-table-add-field-type-pill"
                    data-active={state.fieldType === option.kind ? "true" : undefined}
                    title={option.hint}
                    onClick={() =>
                      setState((prev) => {
                        const isSelect = option.kind === "single_select";
                        const wasSelect = prev.fieldType === "single_select";
                        const nextOptions =
                          isSelect && !wasSelect && prev.options.length === 0
                            ? [createFieldOption("", [])]
                            : prev.options;
                        return {
                          ...prev,
                          fieldType: option.kind,
                          options: nextOptions,
                          defaultOptionId: isSelect ? prev.defaultOptionId : null,
                        };
                      })
                    }
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
              <FieldConfigSectionNumber
                className="data-table-add-field-config"
                precision={state.numberPrecision}
                onPrecisionChange={(numberPrecision) =>
                  setState((prev) => ({ ...prev, numberPrecision }))
                }
              />
            ) : null}

            {state.fieldType === "formula" ? (
              <div className="data-table-add-field-config">
                <label className="data-table-add-field-label" htmlFor={`${nameInputId}-formula`}>
                  Expression
                </label>
                <input
                  id={`${nameInputId}-formula`}
                  ref={(node) => {
                    formulaSourceInputRef.current = node;
                  }}
                  type="text"
                  className="data-table-add-field-input data-table-formula-editor-source"
                  value={state.formulaSource}
                  maxLength={SOURCE_LENGTH_MAX}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={formulaError ? true : undefined}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, formulaSource: event.target.value }))
                  }
                />
                <span className="data-table-add-field-counter" aria-hidden>
                  {state.formulaSource.length}/{SOURCE_LENGTH_MAX}
                </span>
                <FormulaFieldPalette
                  entries={formulaFieldRegistry ?? []}
                  disabled={state.formulaSource.length >= SOURCE_LENGTH_MAX}
                  onInsert={handleInsertFormulaToken}
                />
                {formulaError ? (
                  <p className="form-error data-table-add-field-inline-error" role="alert">
                    {formulaError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {state.fieldType === "single_select" ? (
              <div className="data-table-add-field-config">
                <span className="data-table-add-field-label">Options</span>
                <ul className="data-table-add-field-options" role="list">
                  {state.options.map((option, index) => (
                    <li key={option.id} className="data-table-add-field-option-row">
                      <select
                        className="data-table-add-field-option-color"
                        aria-label={`Option color ${index + 1}`}
                        value={option.color}
                        onChange={(event) => {
                          const next = event.target.value;
                          setState((prev) => ({
                            ...prev,
                            options: prev.options.map((opt) =>
                              opt.id === option.id ? { ...opt, color: next } : opt,
                            ),
                          }));
                        }}
                      >
                        {OPTION_COLOR_PALETTE.map((swatch) => (
                          <option key={swatch} value={swatch}>
                            {swatch}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="data-table-add-field-input"
                        aria-label={`Option label ${index + 1}`}
                        value={option.label}
                        maxLength={120}
                        onChange={(event) => {
                          const value = event.target.value;
                          setState((prev) => ({
                            ...prev,
                            options: prev.options.map((opt) =>
                              opt.id === option.id ? { ...opt, label: value } : opt,
                            ),
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={`Remove option ${index + 1}`}
                        disabled={state.options.length === 1}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            options: prev.options.filter((opt) => opt.id !== option.id),
                            defaultOptionId:
                              prev.defaultOptionId === option.id ? null : prev.defaultOptionId,
                          }))
                        }
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      options: [...prev.options, createFieldOption("", prev.options)],
                    }))
                  }
                >
                  + Add option
                </button>
                <SingleSelectDefaultPicker
                  options={state.options.filter((option) => option.label.trim())}
                  value={state.defaultOptionId}
                  onChange={(defaultOptionId) => setState((prev) => ({ ...prev, defaultOptionId }))}
                  disabled={pending}
                />
                {!optionsValid ? (
                  <p className="form-error data-table-add-field-inline-error" role="alert">
                    Each option needs a unique non-empty label.
                  </p>
                ) : null}
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
                onClick={() => onOpenChange(false)}
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
