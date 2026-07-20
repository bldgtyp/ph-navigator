import * as Dialog from "@radix-ui/react-dialog";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useCallback,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { AddCustomFieldRequest, CustomFieldType } from "../types";
import { MAX_DESCRIPTION, MAX_DISPLAY_NAME } from "../lib/customFieldMutations";
import { findDuplicateDisplayName, type FieldDisplayName } from "../lib/fieldDisplayNames";
import { DEFAULT_NUMBER_PRECISION } from "../lib/numberPrecision";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";
import { astToJson, parseFormulaSource, type FieldRegistryEntry } from "../lib/formula";
import { FieldConfigSectionFormula, type FormulaDraftState } from "./FieldConfigSectionFormula";
import {
  FieldConfigSectionCreateOptions,
  type CreateOptionsDraft,
} from "./FieldConfigSectionCreateOptions";
import { FieldConfigSectionNumber } from "./FieldConfigSectionNumber";
import {
  FieldConfigSectionLinkedRecord,
  type LinkedRecordTargetTableOption,
} from "./FieldConfigSectionLinkedRecord";
import { FIELD_TYPE_CHOICES } from "./fieldConfigChoices";
import { FieldTypeSelect } from "./FieldTypeSelect";

const EMPTY_FORMULA_FIELD_REGISTRY: ReadonlyArray<FieldRegistryEntry> = [];
const EMPTY_LINKED_RECORD_TARGETS: ReadonlyArray<LinkedRecordTargetTableOption> = [];

export type CreateFieldConfigModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  insertAfterFieldKey: string | null;
  existingFieldLabels: ReadonlyArray<FieldDisplayName>;
  dispatchAddField: (request: AddCustomFieldRequest) => Promise<void>;
  returnFocusTo?: HTMLElement | null;
  formulaFieldRegistry?: ReadonlyArray<FieldRegistryEntry>;
  // Available link-target tables for the "Linked record" type. The
  // consumer supplies this from the document's TableContract manifest
  // (`link_targetable === true`, minus the current table). When the
  // list is empty, Save stays disabled while the user has linked_record
  // selected — there is nothing valid to point at.
  linkedRecordTargets?: ReadonlyArray<LinkedRecordTargetTableOption>;
};

export function CreateFieldConfigModal({
  open,
  onOpenChange,
  insertAfterFieldKey,
  existingFieldLabels,
  dispatchAddField,
  returnFocusTo,
  formulaFieldRegistry = EMPTY_FORMULA_FIELD_REGISTRY,
  linkedRecordTargets = EMPTY_LINKED_RECORD_TARGETS,
}: CreateFieldConfigModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("short_text");
  const [description, setDescription] = useState("");
  const [numberPrecision, setNumberPrecision] = useState(DEFAULT_NUMBER_PRECISION);
  const [optionsDraft, setOptionsDraft] = useState<CreateOptionsDraft | null>(null);
  const [formulaDraft, setFormulaDraft] = useState<FormulaDraftState | null>(null);
  const [linkedRecordTargetPath, setLinkedRecordTargetPath] = useState<string[] | null>(null);
  // PRD Q3 — single-link is the default for new linked_record fields.
  const [linkedRecordMaxLinks, setLinkedRecordMaxLinks] = useState<number | null>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [formulaSuggestionPanelOpen, setFormulaSuggestionPanelOpen] = useState(false);
  const [dismissFormulaSuggestionsSignal, setDismissFormulaSuggestionsSignal] = useState(0);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const nameId = useId();
  const descriptionId = useId();
  const errorId = useId();

  const resetDraft = useCallback(() => {
    setDisplayName("");
    setFieldType("short_text");
    setDescription("");
    setNumberPrecision(DEFAULT_NUMBER_PRECISION);
    setOptionsDraft(null);
    setFormulaDraft(null);
    setLinkedRecordTargetPath(null);
    setLinkedRecordMaxLinks(1);
    setSubmitError(null);
    setPending(false);
    setFormulaSuggestionPanelOpen(false);
  }, []);

  useEffect(() => {
    resetDraft();
  }, [open, resetDraft]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  const trimmedName = displayName.trim();
  const nameValidationError = useMemo(() => {
    if (!trimmedName) return "Field name cannot be empty.";
    if (trimmedName.length > MAX_DISPLAY_NAME) {
      return `Field name must be ${MAX_DISPLAY_NAME} characters or fewer.`;
    }
    const duplicate = findDuplicateDisplayName(trimmedName, existingFieldLabels);
    if (duplicate) {
      return `A field named "${duplicate.displayName}" already exists in this table.`;
    }
    return null;
  }, [existingFieldLabels, trimmedName]);

  const optionsValid = fieldType !== "single_select" || optionsDraft?.valid === true;
  const formulaValid =
    fieldType !== "formula" ||
    (formulaDraft?.valid === true && formulaDraft.source.trim().length > 0);
  // PRD Q13 — creating a linked_record field requires a target table.
  // Save stays disabled until the user picks one from the dropdown.
  const linkedRecordValid =
    fieldType !== "linked_record" ||
    (linkedRecordTargetPath !== null && linkedRecordTargetPath.length > 0);
  const canSubmit =
    !nameValidationError && optionsValid && formulaValid && linkedRecordValid && !pending;
  const fieldTypeOptions = useMemo(
    () =>
      FIELD_TYPE_CHOICES.map((option) => ({
        kind: option.kind,
        label: option.label,
        description: option.hint,
      })),
    [],
  );

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) return;
    const request = buildRequest();
    if (!request) return;
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

  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };
  const handleEscape = (event: KeyboardEvent) => {
    if (pending) {
      event.preventDefault();
      return;
    }
    if (formulaSuggestionPanelOpen) {
      event.preventDefault();
      setDismissFormulaSuggestionsSignal((current) => current + 1);
    }
  };
  const handleInteractOutside = (event: Event) => {
    if (pending) event.preventDefault();
  };
  const handleCloseAutoFocus = (event: Event) => {
    if (!returnFocusTo) return;
    event.preventDefault();
    returnFocusTo.focus();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="data-table-field-config-modal-overlay"
          data-pending={pending ? "true" : undefined}
        />
        <Dialog.Content
          className={`data-table-field-config-modal${
            fieldType === "formula" ? " data-table-field-config-modal-formula" : ""
          }`}
          aria-describedby={submitError ? errorId : undefined}
          onEscapeKeyDown={handleEscape}
          onPointerDownOutside={handleInteractOutside}
          onInteractOutside={handleInteractOutside}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <Dialog.Title className="sr-only">Add field</Dialog.Title>
          <form
            className="data-table-field-config-modal-form"
            onSubmit={(event) => void handleSubmit(event)}
            onKeyDown={(event: ReactKeyboardEvent<HTMLFormElement>) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                event.target instanceof HTMLInputElement
              ) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          >
            <div className="data-table-field-config-modal-section">
              <label className="sr-only" htmlFor={nameId}>
                Name
              </label>
              <input
                id={nameId}
                ref={nameInputRef}
                type="text"
                className="data-table-add-field-input"
                value={displayName}
                maxLength={MAX_DISPLAY_NAME}
                autoComplete="off"
                disabled={pending}
                aria-invalid={nameValidationError ? "true" : undefined}
                aria-describedby={nameValidationError ? `${nameId}-error` : undefined}
                onChange={(event) =>
                  setDisplayName(event.currentTarget.value.slice(0, MAX_DISPLAY_NAME))
                }
              />
              {nameValidationError && trimmedName ? (
                <p
                  id={`${nameId}-error`}
                  className="form-error data-table-add-field-inline-error"
                  role="alert"
                >
                  {nameValidationError}
                </p>
              ) : null}
            </div>

            <div
              className="data-table-field-config-modal-section data-table-field-config-type-section"
              role="group"
              aria-label="Field type"
            >
              <FieldTypeSelect
                value={fieldType}
                options={fieldTypeOptions}
                disabled={pending}
                onChange={setFieldType}
              />
            </div>

            {fieldType === "single_select" ? (
              <FieldConfigSectionCreateOptions disabled={pending} onDraftChange={setOptionsDraft} />
            ) : null}
            {fieldType === "number" ? (
              <FieldConfigSectionNumber
                precision={numberPrecision}
                onPrecisionChange={setNumberPrecision}
                disabled={pending}
              />
            ) : null}
            {fieldType === "linked_record" ? (
              <FieldConfigSectionLinkedRecord
                targetPath={linkedRecordTargetPath}
                targets={linkedRecordTargets}
                onTargetPathChange={setLinkedRecordTargetPath}
                maxLinks={linkedRecordMaxLinks}
                onMaxLinksChange={setLinkedRecordMaxLinks}
                // Greenfield draft: target is editable until Save.
                targetLocked={false}
                disabled={pending}
              />
            ) : null}
            {fieldType === "formula" ? (
              <FieldConfigSectionFormula
                fieldId="__new_custom_field__"
                initialSource=""
                fieldRegistry={formulaFieldRegistry}
                previewRow={null}
                previewStale={false}
                disabled={pending}
                onDraftChange={setFormulaDraft}
                onSuggestionPanelOpenChange={setFormulaSuggestionPanelOpen}
                dismissSuggestionsSignal={dismissFormulaSuggestionsSignal}
              />
            ) : null}

            <div className="data-table-field-config-modal-section">
              <label className="sr-only" htmlFor={descriptionId}>
                Description
              </label>
              <textarea
                id={descriptionId}
                className="data-table-add-field-textarea"
                value={description}
                maxLength={MAX_DESCRIPTION}
                rows={4}
                disabled={pending}
                onChange={(event) =>
                  setDescription(event.currentTarget.value.slice(0, MAX_DESCRIPTION))
                }
              />
              <span className="data-table-add-field-counter" aria-hidden>
                {description.trim().length}/{MAX_DESCRIPTION}
              </span>
            </div>

            {submitError ? (
              <p id={errorId} className="form-error data-table-add-field-error" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={pending}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </button>
              <button type="submit" className="primary-button" disabled={!canSubmit}>
                {pending ? "Adding…" : "Add field"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  function buildRequest(): AddCustomFieldRequest | null {
    const normalizedDescription = description.trim();
    const base = {
      displayName: trimmedName,
      fieldType,
      description: normalizedDescription ? normalizedDescription : null,
      insertAfterFieldKey,
    };
    switch (fieldType) {
      case "number":
        return { ...base, fieldType, config: { precision: numberPrecision } };
      case "single_select": {
        if (!optionsDraft?.valid) return null;
        return {
          ...base,
          fieldType,
          config: { default_option_id: optionsDraft.defaultOptionId },
          initialOptions: optionsDraft.options.map((option, index) => ({
            ...option,
            label: option.label.trim(),
            order: index + 1,
          })),
        };
      }
      case "linked_record": {
        if (!linkedRecordTargetPath || linkedRecordTargetPath.length === 0) return null;
        return {
          ...base,
          fieldType,
          config: {
            target_table_path: [...linkedRecordTargetPath],
            max_links: linkedRecordMaxLinks,
          },
        };
      }
      case "formula": {
        if (formulaDraft?.valid !== true || !formulaDraft.source.trim()) return null;
        const formulaState = parseFormulaSource(formulaDraft.source, formulaFieldRegistry);
        if (formulaState.kind !== "ok") return null;
        return {
          ...base,
          fieldType,
          config: {
            source: formulaDraft.source,
            ast: astToJson(formulaState.ast),
            deps: [...formulaState.deps],
          },
        };
      }
      default:
        return { ...base, fieldType, config: {} };
    }
  }
}
