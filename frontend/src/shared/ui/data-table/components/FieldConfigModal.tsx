// Unified field-config modal. Owns the concurrency guards (R-S1 field
// disappears, R-S2 external edit, R-S3 row mutation during preflight,
// R-S5 pending-save re-entrancy) so consumers wire only the dispatch
// callback.
import * as Dialog from "@radix-ui/react-dialog";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  CustomFieldType,
  EditCustomFieldBundleRequest,
  FieldDef,
  FieldOption,
} from "../types";
import type { FieldRegistryEntry } from "../lib/formula";
import { MAX_DESCRIPTION, MAX_DISPLAY_NAME } from "../lib/customFieldMutations";
import { findDuplicateDisplayName, type FieldDisplayName } from "../lib/fieldDisplayNames";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";
import { computeLocalPreflight, type PreflightSourceRow } from "../lib/coerceCustomFieldType";
import {
  conversionPolicy,
  isConversionAllowed,
  TEXT_TO_SINGLE_SELECT_OPTION_CAP,
} from "../lib/typeConversionMatrix";
import { deriveCandidateOptionsFromRows } from "../lib";
import { formulaSourceFromFieldDef } from "../lib/formulaFieldSource";
import {
  FieldConfigSectionTypeChange,
  type ServerPreflightPayload,
} from "./FieldConfigSectionTypeChange";
import { FieldConfigSectionOptions, type OptionSourceRow } from "./FieldConfigSectionOptions";
import { FieldConfigSectionNumber } from "./FieldConfigSectionNumber";
import { DEFAULT_NUMBER_PRECISION, clampNumberPrecision } from "../lib/numberPrecision";
import {
  FieldConfigSectionFormula,
  type FormulaDraftState,
  type FormulaPreviewRowSnapshot,
} from "./FieldConfigSectionFormula";
import { FIELD_TYPE_CHOICES } from "./fieldConfigChoices";

// Stable empty references. Inline `?? []` fallbacks force a fresh array
// identity on every render, which cascades through
// FieldConfigSectionOptions's reset effect (setDraftOptions →
// onDraftChange → parent setState → re-render → reset effect again) and
// produces "Maximum update depth exceeded" when a type change flips
// `source.options` from undefined to a real array mid-save.
const EMPTY_FIELD_OPTIONS: readonly FieldOption[] = [];
const EMPTY_OPTION_SOURCE_ROWS: readonly OptionSourceRow[] = [];

function optionListsEquivalent(a: readonly FieldOption[], b: readonly FieldOption[]): boolean {
  if (a.length !== b.length) return false;
  const normalize = (options: readonly FieldOption[]) =>
    options
      .map((option, index) => ({ ...option, order: index + 1 }))
      .sort((left, right) => left.order - right.order);
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

const EMPTY_FORMULA_FIELD_REGISTRY: ReadonlyArray<FieldRegistryEntry> = [];

export type FieldConfigFormulaPreviewContext = {
  fieldRegistry: ReadonlyArray<FieldRegistryEntry>;
  row: FormulaPreviewRowSnapshot | null;
  rowsRevision: unknown;
};

export type FieldConfigModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Resolved FieldDef being edited (the merged-schema view from
  // `useTableSchema`). `undefined` means the field no longer exists in
  // the merged schema (R-S1). Only custom fields should be passed in —
  // the caller is responsible for filtering out `read_only_schema`.
  fieldDef: FieldDef | undefined;
  // Every field in the table (core + custom). The uniqueness preflight
  // excludes the field being edited by `field_key`; callers pass the
  // same `existingFieldLabels` memo used by add-field validation.
  existingFieldLabels: ReadonlyArray<FieldDisplayName>;
  dispatchBundle: (request: EditCustomFieldBundleRequest) => Promise<void>;
  // Element to return focus to on close (the originating header <th>).
  // Stored at open time so a re-render of the header cell doesn't
  // invalidate the reference. Optional in tests.
  returnFocusTo?: HTMLElement | null;
  // R-S1 hook so the parent can mirror the toast on its own announce
  // surface. Falls back to a console warn when omitted (tests).
  onFieldRemoved?: (message: string) => void;
  // When omitted, the Type picker is hidden — used by tests that
  // pre-date the type-change wiring.
  sourceCustomFieldType?: CustomFieldType;
  // Pre-mapped {rowId, rawValue} pairs so the modal stays non-generic
  // over TRow. Drives the local change-type preflight.
  preflightRows?: ReadonlyArray<PreflightSourceRow>;
  optionRows?: ReadonlyArray<OptionSourceRow>;
  formulaPreview?: FieldConfigFormulaPreviewContext;
};

export function FieldConfigModal({
  open,
  onOpenChange,
  fieldDef,
  existingFieldLabels,
  dispatchBundle,
  returnFocusTo,
  onFieldRemoved,
  sourceCustomFieldType,
  preflightRows,
  optionRows,
  formulaPreview,
}: FieldConfigModalProps) {
  // Source-of-truth FieldDef captured at modal open. Used for the
  // change-detection diff and for R-S2 comparison against the live
  // fieldDef prop on subsequent renders.
  const [source, setSource] = useState<FieldDef | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // R-S2 — external edit detected while modal is open. The user
  // picks Keep (rebase draft onto new source, preserving the
  // user's diff property-by-property) or Discard (re-seed draft
  // from new source). Save is suspended until resolved.
  const [externalConflict, setExternalConflict] = useState<FieldDef | null>(null);
  const [draftType, setDraftType] = useState<CustomFieldType | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [optionsDraft, setOptionsDraft] = useState<{
    options: FieldOption[];
    colorCodeOptions: boolean;
    defaultOptionId: string | null;
    valid: boolean;
    dirty: boolean;
  } | null>(null);
  const [numberPrecision, setNumberPrecision] = useState(DEFAULT_NUMBER_PRECISION);
  const [formulaDraft, setFormulaDraft] = useState<FormulaDraftState | null>(null);
  const [formulaPreviewSnapshot, setFormulaPreviewSnapshot] =
    useState<FormulaPreviewRowSnapshot | null>(null);
  const [formulaPreviewStale, setFormulaPreviewStale] = useState(false);
  // Populated from the backend's `custom_field_coercion_preflight_required`
  // 422 envelope; overrides the local preflight in the sub-panel.
  const [serverPreflight, setServerPreflight] = useState<ServerPreflightPayload | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const formulaRowsRevisionAtOpenRef = useRef<unknown>(null);
  const nameId = useId();
  const descriptionId = useId();
  const errorId = useId();

  // Seed the draft + source when the modal opens. Avoid re-seeding
  // on every fieldDef render — only when transitioning to open or
  // when the user picks Discard on the R-S2 banner.
  useEffect(() => {
    if (!open) {
      setSource(null);
      setSubmitError(null);
      setPending(false);
      setExternalConflict(null);
      setDraftType(null);
      setAcknowledged(false);
      setOptionsDraft(null);
      setNumberPrecision(DEFAULT_NUMBER_PRECISION);
      setFormulaDraft(null);
      setFormulaPreviewSnapshot(null);
      setFormulaPreviewStale(false);
      setServerPreflight(null);
      return;
    }
    if (!fieldDef) return;
    const seededSource =
      fieldDef.custom_field_type === undefined && sourceCustomFieldType !== undefined
        ? { ...fieldDef, custom_field_type: sourceCustomFieldType }
        : fieldDef;
    setSource(seededSource);
    setDisplayName(fieldDef.display_name);
    setDescription(fieldDef.description ?? "");
    setSubmitError(null);
    setExternalConflict(null);
    setDraftType(seededSource.custom_field_type ?? null);
    setAcknowledged(false);
    setOptionsDraft(null);
    setNumberPrecision(clampNumberPrecision(seededSource.numberPrecision));
    setFormulaDraft(null);
    setFormulaPreviewSnapshot(cloneFormulaPreviewRow(formulaPreview?.row ?? null));
    setFormulaPreviewStale(false);
    formulaRowsRevisionAtOpenRef.current = formulaPreview?.rowsRevision;
    setServerPreflight(null);
  }, [open, fieldDef?.field_key]); // eslint-disable-line react-hooks/exhaustive-deps

  const formulaFieldRegistry = formulaPreview?.fieldRegistry ?? EMPTY_FORMULA_FIELD_REGISTRY;
  const initialFormulaSource = useMemo(() => {
    if (!source || draftType !== "formula") return "";
    return formulaSourceFromFieldDef(source, formulaFieldRegistry);
  }, [source, draftType, formulaFieldRegistry]);

  // Focus + select Name on open so rename stays a one-gesture-plus-
  // one-keystroke action.
  useEffect(() => {
    if (!open || !source) return;
    const handle = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open, source]);

  // R-S1 — field disappeared (deleted in another write). Close and
  // announce. Skip when no source was ever seeded (still opening).
  useEffect(() => {
    if (!open || !source) return;
    if (fieldDef) return;
    const message = "This field was removed in another edit. Your changes were discarded.";
    if (onFieldRemoved) onFieldRemoved(message);
    else if (typeof console !== "undefined") console.warn(message);
    onOpenChange(false);
  }, [open, source, fieldDef, onFieldRemoved, onOpenChange]);

  // R-S2 — external edit to the same field. Banner gates resolution
  // so don't re-fire while a conflict is already pending.
  useEffect(() => {
    if (!open || !source || !fieldDef || externalConflict) return;
    const currentCustomFieldType = fieldDef.custom_field_type ?? sourceCustomFieldType ?? null;
    const changed =
      fieldDef.display_name !== source.display_name ||
      (fieldDef.description ?? null) !== (source.description ?? null) ||
      currentCustomFieldType !== (source.custom_field_type ?? null) ||
      clampNumberPrecision(fieldDef.numberPrecision) !==
        clampNumberPrecision(source.numberPrecision) ||
      !optionListsEquivalent(fieldDef.options ?? [], source.options ?? []) ||
      (fieldDef.defaultOptionId ?? null) !== (source.defaultOptionId ?? null) ||
      (fieldDef.colorCodeOptions !== false) !== (source.colorCodeOptions !== false) ||
      formulaSourceFromFieldDef(fieldDef, formulaFieldRegistry) !==
        formulaSourceFromFieldDef(source, formulaFieldRegistry);
    if (changed) setExternalConflict(fieldDef);
  }, [open, source, fieldDef, sourceCustomFieldType, externalConflict, formulaFieldRegistry]);

  // R-S3 — row data changed while a type change is staged. Invalidate
  // the ack so the user re-confirms against the new preflight.
  useEffect(() => {
    if (!open || !source) return;
    if (draftType === null || draftType === sourceCustomFieldType) return;
    setAcknowledged(false);
    setServerPreflight(null);
  }, [preflightRows, draftType, sourceCustomFieldType, open, source]);

  // R-S4 — formula preview evaluates against a value-copied snapshot
  // captured at modal open. Any later row mutation marks it stale
  // without changing the preview values.
  useEffect(() => {
    if (!open || !source || draftType !== "formula") return;
    if (formulaPreviewStale) return;
    if (Object.is(formulaRowsRevisionAtOpenRef.current, formulaPreview?.rowsRevision)) return;
    setFormulaPreviewStale(true);
  }, [formulaPreview?.rowsRevision, formulaPreviewStale, open, source, draftType]);

  const trimmedName = displayName.trim();
  const initialName = source?.display_name ?? "";
  const initialDescription = source?.description ?? "";
  const trimmedDescription = description.trim();
  const normalizedDescription = trimmedDescription ? trimmedDescription : null;
  const normalizedInitialDescription = initialDescription.trim() ? initialDescription : null;

  const nameValidationError = useMemo<string | null>(() => {
    if (!source) return null;
    if (!trimmedName) return "Field name cannot be empty.";
    if (trimmedName.length > MAX_DISPLAY_NAME) {
      return `Field name must be ${MAX_DISPLAY_NAME} characters or fewer.`;
    }
    const duplicate = findDuplicateDisplayName(trimmedName, existingFieldLabels, source.field_key);
    if (duplicate) {
      return `A field named "${duplicate.displayName}" already exists in this table.`;
    }
    return null;
  }, [source, trimmedName, existingFieldLabels]);

  const typeChanged =
    sourceCustomFieldType !== undefined &&
    draftType !== null &&
    draftType !== sourceCustomFieldType;

  // One pass over preflight rows per render — shared with the sub-panel.
  const localPreflight = useMemo(() => {
    if (!typeChanged || draftType === null || sourceCustomFieldType === undefined) return null;
    return computeLocalPreflight(
      sourceCustomFieldType,
      draftType,
      preflightRows ?? [],
      undefined,
      source?.options,
    );
  }, [typeChanged, draftType, sourceCustomFieldType, preflightRows, source?.options]);

  // Airtable-parity preview: when the user picks single_select as the
  // new type for a text/number field, derive a candidate option list
  // from the existing row values and seed the options section with it.
  // The user can rename / recolor / remove before saving; the
  // (possibly edited) list is sent through as `nextOptions` and the
  // backend uses it as authoritative instead of re-materializing.
  // Frozen at the moment the user enters single_select mode so editing
  // options doesn't cause the section to reset.
  const derivedSourceOptionsRef = useRef<{
    fieldKey: string;
    draftType: CustomFieldType;
    options: FieldOption[];
  } | null>(null);
  const singleSelectSourceOptions = useMemo<readonly FieldOption[]>(() => {
    if (draftType !== "single_select" || !source) return EMPTY_FIELD_OPTIONS;
    const existing = source.options ?? EMPTY_FIELD_OPTIONS;
    if (existing.length > 0) return existing;
    if (sourceCustomFieldType === undefined) return EMPTY_FIELD_OPTIONS;
    if (sourceCustomFieldType === draftType) return EMPTY_FIELD_OPTIONS;
    if (conversionPolicy(sourceCustomFieldType, draftType) !== "create_options") {
      return EMPTY_FIELD_OPTIONS;
    }
    const cached = derivedSourceOptionsRef.current;
    if (
      cached &&
      cached.fieldKey === source.field_key &&
      cached.draftType === draftType
    ) {
      return cached.options;
    }
    const derived = deriveCandidateOptionsFromRows(
      preflightRows ?? [],
      TEXT_TO_SINGLE_SELECT_OPTION_CAP,
    );
    derivedSourceOptionsRef.current = {
      fieldKey: source.field_key,
      draftType,
      options: derived,
    };
    return derived;
  }, [draftType, source, sourceCustomFieldType, preflightRows]);

  const incompatibleCount =
    serverPreflight?.rows.length ?? localPreflight?.incompatible.length ?? 0;
  const needsAck = typeChanged && incompatibleCount > 0;
  const ackSatisfied = !needsAck || acknowledged;

  const numberDirty =
    draftType === "number" &&
    numberPrecision !== clampNumberPrecision(source?.numberPrecision ?? DEFAULT_NUMBER_PRECISION);

  const hasTypeSpecificDirty = Boolean(
    (draftType === "single_select" && optionsDraft?.dirty) ||
    numberDirty ||
    (draftType === "formula" && formulaDraft?.dirty),
  );

  const formDirty =
    !!source &&
    !nameValidationError &&
    (trimmedName !== initialName.trim() ||
      normalizedDescription !== normalizedInitialDescription ||
      typeChanged ||
      hasTypeSpecificDirty);

  const optionsValid = draftType !== "single_select" || optionsDraft?.valid !== false;
  const formulaValid = draftType !== "formula" || formulaDraft?.valid !== false;
  const canSave =
    formDirty && optionsValid && formulaValid && !pending && !externalConflict && ackSatisfied;

  const handleSave = useCallback(async () => {
    if (!source || !canSave) return;
    setPending(true);
    setSubmitError(null);
    try {
      await dispatchBundle({
        fieldKey: source.field_key,
        displayName: trimmedName,
        description: normalizedDescription,
        ...(typeChanged && draftType !== null ? { fieldType: draftType } : {}),
        ...(typeChanged && needsAck ? { acknowledgeDestructive: true } : {}),
        ...(draftType === "single_select" && optionsDraft
          ? {
              options: optionsDraft.options,
              defaultOptionId: optionsDraft.defaultOptionId,
              colorCodeOptions: optionsDraft.colorCodeOptions,
            }
          : {}),
        ...(draftType === "number" && (typeChanged || numberDirty) ? { numberPrecision } : {}),
        ...(draftType === "formula" && formulaDraft?.dirty
          ? { formulaSource: formulaDraft.source }
          : {}),
      });
      onOpenChange(false);
    } catch (error) {
      // If the backend returned a structured preflight envelope, swap
      // the inline panel to the server's authoritative payload so the
      // user can re-ack against the real incompatible rows.
      const maybeDetails = (
        error as
          | {
              details?: {
                incompatible_rows?: ServerPreflightPayload["rows"];
                total_row_count?: number;
              };
            }
          | undefined
      )?.details;
      if (maybeDetails?.incompatible_rows && typeChanged) {
        setServerPreflight({
          rows: maybeDetails.incompatible_rows,
          total: maybeDetails.total_row_count ?? preflightRows?.length ?? 0,
        });
        setAcknowledged(false);
      }
      setSubmitError(schemaMutationErrorMessage(error, "Could not save field changes."));
    } finally {
      setPending(false);
    }
  }, [
    canSave,
    source,
    trimmedName,
    normalizedDescription,
    typeChanged,
    numberDirty,
    draftType,
    needsAck,
    dispatchBundle,
    optionsDraft,
    numberPrecision,
    formulaDraft,
    onOpenChange,
    preflightRows,
  ]);

  // Esc handling — Radix Dialog's onEscapeKeyDown fires before the
  // open-change. Suppress dismissal while saving (R-S5) or while
  // the R-S2 banner is up.
  const handleEscape = (event: KeyboardEvent) => {
    if (pending) event.preventDefault();
  };
  const handleInteractOutside = (event: Event) => {
    if (pending) event.preventDefault();
  };
  const handleOpenChange = (next: boolean) => {
    if (pending && !next) return;
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSave();
  };

  const handleKeepConflict = useCallback(() => {
    if (!externalConflict) return;
    // Rebase: keep the user's pending draft values, just update the
    // captured source so the diff is recomputed against the new
    // baseline. The user's draft survives.
    setSource(externalConflict);
    setExternalConflict(null);
    setSubmitError(null);
  }, [externalConflict]);

  const handleDiscardConflict = useCallback(() => {
    if (!externalConflict) return;
    setSource(externalConflict);
    setDisplayName(externalConflict.display_name);
    setDescription(externalConflict.description ?? "");
    setDraftType(externalConflict.custom_field_type ?? sourceCustomFieldType ?? null);
    setAcknowledged(false);
    setOptionsDraft(null);
    setNumberPrecision(clampNumberPrecision(externalConflict.numberPrecision));
    setFormulaDraft(null);
    setFormulaPreviewSnapshot(cloneFormulaPreviewRow(formulaPreview?.row ?? null));
    setFormulaPreviewStale(false);
    setServerPreflight(null);
    setExternalConflict(null);
    setSubmitError(null);
  }, [externalConflict, formulaPreview, sourceCustomFieldType]);

  const handleCloseAutoFocus = (event: Event) => {
    if (!returnFocusTo) return;
    event.preventDefault();
    returnFocusTo.focus();
  };

  // Avoid mounting the dialog content (and running the open-time
  // effects) when there is nothing to render. Tests rely on this so
  // they can assert the modal is absent until opened.
  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="data-table-field-config-modal-overlay"
          data-pending={pending ? "true" : undefined}
        />
        <Dialog.Content
          className="data-table-field-config-modal"
          aria-describedby={submitError ? errorId : undefined}
          onEscapeKeyDown={handleEscape}
          onPointerDownOutside={handleInteractOutside}
          onInteractOutside={handleInteractOutside}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <Dialog.Title className="data-table-field-config-modal-title">
            {source ? `Edit field — ${source.display_name}` : "Edit field"}
          </Dialog.Title>
          {externalConflict ? (
            <div className="data-table-field-config-modal-conflict" role="alert" aria-live="polite">
              <p className="data-table-field-config-modal-conflict-text">
                This field changed elsewhere — review the new value to continue.
              </p>
              <div className="data-table-field-config-modal-conflict-actions">
                <button type="button" onClick={handleKeepConflict}>
                  Keep my changes
                </button>
                <button type="button" className="secondary-button" onClick={handleDiscardConflict}>
                  Discard my changes
                </button>
              </div>
            </div>
          ) : null}
          <form
            className="data-table-field-config-modal-form"
            onSubmit={handleSubmit}
            onKeyDown={(event: ReactKeyboardEvent<HTMLFormElement>) => {
              // Submit on Enter from the Name input — matches the
              // existing rename UX. Plain Enter inside the textarea
              // continues to insert a newline.
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                event.target instanceof HTMLInputElement
              ) {
                event.preventDefault();
                void handleSave();
              }
            }}
          >
            <div className="data-table-field-config-modal-section">
              <label className="data-table-add-field-label" htmlFor={nameId}>
                Name
              </label>
              <input
                id={nameId}
                ref={nameInputRef}
                className="data-table-add-field-input"
                type="text"
                value={displayName}
                onChange={(event) =>
                  setDisplayName(event.currentTarget.value.slice(0, MAX_DISPLAY_NAME))
                }
                disabled={pending}
                maxLength={MAX_DISPLAY_NAME}
                aria-invalid={nameValidationError ? "true" : undefined}
                aria-describedby={nameValidationError ? `${nameId}-error` : undefined}
              />
              {nameValidationError ? (
                <p
                  id={`${nameId}-error`}
                  className="form-error data-table-add-field-inline-error"
                  role="alert"
                >
                  {nameValidationError}
                </p>
              ) : null}
            </div>
            {sourceCustomFieldType !== undefined ? (
              <div
                className="data-table-field-config-modal-section data-table-field-config-type-section"
                role="group"
                aria-label="Field type"
              >
                <span className="data-table-add-field-label">Type</span>
                <div
                  className="data-table-add-field-type-row"
                  role="radiogroup"
                  aria-label="Field type"
                >
                  {FIELD_TYPE_CHOICES.map((candidate) => {
                    // Current type pill stays selectable so the user can
                    // revert a staged change.
                    const isCurrent = candidate.kind === sourceCustomFieldType;
                    const allowed =
                      isCurrent || isConversionAllowed(sourceCustomFieldType, candidate.kind);
                    const selected = draftType === candidate.kind;
                    return (
                      <button
                        key={candidate.kind}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-disabled={!allowed}
                        disabled={!allowed || pending}
                        data-active={selected ? "true" : undefined}
                        title={typeCandidateTitle(candidate, sourceCustomFieldType, allowed)}
                        className="data-table-add-field-type-pill"
                        onClick={() => {
                          setDraftType(candidate.kind);
                          setAcknowledged(false);
                          setServerPreflight(null);
                        }}
                      >
                        {candidate.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {typeChanged && draftType !== null && sourceCustomFieldType !== undefined ? (
              <FieldConfigSectionTypeChange
                fromType={sourceCustomFieldType}
                toType={draftType}
                localPreflight={localPreflight}
                serverPreflight={serverPreflight}
                acknowledged={acknowledged}
                onAcknowledgeChange={setAcknowledged}
                disabled={pending}
              />
            ) : null}
            {draftType === "single_select" && source ? (
              <FieldConfigSectionOptions
                fieldDisplayName={source.display_name}
                sourceOptions={singleSelectSourceOptions}
                sourceColorCodeOptions={source.colorCodeOptions !== false}
                sourceDefaultOptionId={source.defaultOptionId ?? null}
                rows={optionRows ?? EMPTY_OPTION_SOURCE_ROWS}
                disabled={pending}
                onDraftChange={setOptionsDraft}
              />
            ) : null}
            {draftType === "number" ? (
              <FieldConfigSectionNumber
                precision={numberPrecision}
                onPrecisionChange={setNumberPrecision}
                disabled={pending}
              />
            ) : null}
            {draftType === "formula" && source ? (
              <FieldConfigSectionFormula
                fieldId={source.field_key}
                initialSource={initialFormulaSource}
                fieldRegistry={formulaFieldRegistry}
                previewRow={formulaPreviewSnapshot}
                previewStale={formulaPreviewStale}
                disabled={pending}
                onDraftChange={setFormulaDraft}
              />
            ) : null}
            <div className="data-table-field-config-modal-section">
              <label className="data-table-add-field-label" htmlFor={descriptionId}>
                Description
              </label>
              <textarea
                id={descriptionId}
                className="data-table-add-field-textarea"
                value={description}
                onChange={(event) =>
                  setDescription(event.currentTarget.value.slice(0, MAX_DESCRIPTION))
                }
                rows={4}
                disabled={pending}
                maxLength={MAX_DESCRIPTION}
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
            <div className="data-table-field-config-modal-footer">
              <Dialog.Close asChild>
                <button type="button" className="secondary-button" disabled={pending}>
                  Cancel
                </button>
              </Dialog.Close>
              <button type="submit" disabled={!canSave}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function cloneFormulaPreviewRow(
  row: FormulaPreviewRowSnapshot | null,
): FormulaPreviewRowSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    values: cloneRecord(row.values),
  };
}

function cloneRecord(record: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === "function") {
    return structuredClone(record) as Record<string, unknown>;
  }
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
}

function typeCandidateTitle(
  candidate: (typeof FIELD_TYPE_CHOICES)[number],
  sourceCustomFieldType: CustomFieldType,
  allowed: boolean,
): string {
  if (allowed) return candidate.label;
  if (candidate.kind === "formula" || sourceCustomFieldType === "formula") {
    return "Formula fields cannot be converted to or from another type.";
  }
  return `Cannot convert ${sourceCustomFieldType} values to ${candidate.label.toLowerCase()}.`;
}
