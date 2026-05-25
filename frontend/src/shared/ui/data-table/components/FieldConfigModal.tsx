// Unified field-config modal (plan-21 P5a.1).
//
// Replaces the inline-rename + EditFieldDescriptionPopover entry paths
// for editing a custom field's name and description. Later sub-phases
// extend the form with Type / Options+Default / Number-precision /
// Formula / Description sections; the wire shape (`editFieldBundle`)
// stays the same so each sub-phase is a hard cut-over for the
// property it covers (plan-21 R4).
//
// Concurrency guards live in this component, not the consumer:
//   R-S1 — source field disappears (deleted in another write) →
//     close + announce a toast.
//   R-S2 — external edit to the same field while open → suspend Save,
//     show a banner with "Keep my changes" / "Discard my changes".
//   R-S5 — pending Save suppresses Esc / backdrop / Cancel and disables
//     re-submit until the dispatch promise resolves.
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
import type { EditCustomFieldBundleRequest, FieldDef } from "../types";
import { MAX_DESCRIPTION, MAX_DISPLAY_NAME } from "../lib/customFieldMutations";
import { findDuplicateDisplayName, type FieldDisplayName } from "../lib/fieldDisplayNames";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";

export type FieldConfigModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Resolved FieldDef being edited (the merged-schema view from
  // `useTableSchema`). `undefined` means the field no longer exists in
  // the merged schema (R-S1). Only custom fields should be passed in —
  // the caller is responsible for filtering out `read_only_schema`.
  fieldDef: FieldDef | undefined;
  // Every field in the table (core + custom). The uniqueness preflight
  // excludes the field being edited by `field_key`; same shape the
  // inline-rename editor consumes so callers can pass the existing
  // `existingFieldLabels` memo verbatim.
  existingFieldLabels: ReadonlyArray<FieldDisplayName>;
  dispatchBundle: (request: EditCustomFieldBundleRequest) => Promise<void>;
  // Element to return focus to on close (the originating header <th>).
  // Stored at open time so a re-render of the header cell doesn't
  // invalidate the reference. Optional in tests.
  returnFocusTo?: HTMLElement | null;
  // R-S1 hook so the parent can mirror the toast on its own announce
  // surface. Falls back to a console warn when omitted (tests).
  onFieldRemoved?: (message: string) => void;
};

export function FieldConfigModal({
  open,
  onOpenChange,
  fieldDef,
  existingFieldLabels,
  dispatchBundle,
  returnFocusTo,
  onFieldRemoved,
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

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
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
      return;
    }
    if (!fieldDef) return;
    setSource(fieldDef);
    setDisplayName(fieldDef.display_name);
    setDescription(fieldDef.description ?? "");
    setSubmitError(null);
    setExternalConflict(null);
  }, [open, fieldDef?.field_key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus + select Name on open so rename stays a one-gesture-plus-
  // one-keystroke action (plan-21 Q4 resolution).
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

  // R-S2 — external edit to the same field. Detect by comparing
  // the live fieldDef against the captured source on the editable
  // properties P5a.1 ships (display_name, description); later
  // sub-phases extend this comparator. Don't re-fire while a
  // conflict is already pending — the banner gates resolution.
  useEffect(() => {
    if (!open || !source || !fieldDef || externalConflict) return;
    const changed =
      fieldDef.display_name !== source.display_name ||
      (fieldDef.description ?? null) !== (source.description ?? null);
    if (changed) setExternalConflict(fieldDef);
  }, [open, source, fieldDef, externalConflict]);

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

  const dirty =
    !!source &&
    !nameValidationError &&
    (trimmedName !== initialName.trim() || normalizedDescription !== normalizedInitialDescription);

  const canSave = dirty && !pending && !externalConflict;

  const handleSave = useCallback(async () => {
    if (!source || !canSave) return;
    setPending(true);
    setSubmitError(null);
    try {
      await dispatchBundle({
        fieldKey: source.field_key,
        displayName: trimmedName,
        description: normalizedDescription,
      });
      onOpenChange(false);
    } catch (error) {
      setSubmitError(schemaMutationErrorMessage(error, "Could not save field changes."));
    } finally {
      setPending(false);
    }
  }, [canSave, source, trimmedName, normalizedDescription, dispatchBundle, onOpenChange]);

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
    setExternalConflict(null);
    setSubmitError(null);
  }, [externalConflict]);

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
          aria-labelledby={titleId}
          aria-describedby={submitError ? errorId : undefined}
          onEscapeKeyDown={handleEscape}
          onPointerDownOutside={handleInteractOutside}
          onInteractOutside={handleInteractOutside}
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          <Dialog.Title id={titleId} className="data-table-field-config-modal-title">
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
