// Change-type popover for custom fields. Renders a target-type picker
// with disabled-with-tooltip pills for forbidden pairs, a live
// in-browser preflight panel (advisory only — backend is authoritative
// on commit), and an acknowledgement checkbox gating the destructive
// "Convert anyway" path. Submits a typed `ChangeTypeMutation`; on
// `custom_field_coercion_preflight_required` the panel re-renders from
// the server's `details` payload.

import * as Popover from "@radix-ui/react-popover";
import { useId, useMemo, useState, type FormEvent } from "react";
import type { CustomFieldType } from "../hooks/useTableSchema";
import { coerceCustomValue } from "../lib/coerceCustomFieldType";
import { useElementAnchorRef } from "../lib/popoverAnchor";
import { schemaMutationErrorMessage } from "../lib/schemaMutationErrors";
import {
  CONVERSION_MATRIX,
  conversionPolicy,
  isConversionAllowed,
  type ConversionPolicy,
} from "../lib/typeConversionMatrix";
import type { FieldDef, FieldOption } from "../types";

type TargetCandidate = {
  kind: CustomFieldType;
  label: string;
};

const TARGET_CANDIDATES: ReadonlyArray<TargetCandidate> = [
  { kind: "short_text", label: "Short text" },
  { kind: "long_text", label: "Long text" },
  { kind: "number", label: "Number" },
  { kind: "url", label: "URL" },
  { kind: "single_select", label: "Single select" },
];

export type ChangeTypeRequest = {
  fieldKey: string;
  fromType: CustomFieldType;
  toType: CustomFieldType;
  acknowledgeDestructive: boolean;
};

export type ChangeTypePopoverProps<TRow> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorElement: HTMLElement | null;
  fieldDef: FieldDef;
  fromType: CustomFieldType;
  rows: ReadonlyArray<TRow>;
  getRowId: (row: TRow) => string;
  accessor: (row: TRow) => unknown;
  // Optional: needed when target = "single_select" (advisory preflight).
  targetOptionList?: ReadonlyArray<FieldOption>;
  dispatchChangeType: (request: ChangeTypeRequest) => Promise<void>;
};

type PreflightRow = { rowId: string; rawValue: unknown; reason: string };

export function ChangeTypePopover<TRow>({
  open,
  onOpenChange,
  anchorElement,
  fieldDef,
  fromType,
  rows,
  getRowId,
  accessor,
  targetOptionList,
  dispatchChangeType,
}: ChangeTypePopoverProps<TRow>) {
  const ackId = useId();
  const allowedTargets = useMemo(
    () => TARGET_CANDIDATES.filter((candidate) => candidate.kind !== fromType),
    [fromType],
  );
  const firstAllowed = allowedTargets.find((candidate) =>
    isConversionAllowed(fromType, candidate.kind),
  );
  const [toType, setToType] = useState<CustomFieldType | null>(firstAllowed?.kind ?? null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverPreflight, setServerPreflight] = useState<{
    rows: PreflightRow[];
    total: number;
  } | null>(null);
  const [pending, setPending] = useState(false);

  const policy: ConversionPolicy | null = toType ? conversionPolicy(fromType, toType) : null;

  const localPreflight = useMemo<{ incompatible: PreflightRow[]; total: number } | null>(() => {
    if (!toType || policy === null) return null;
    // The `create_options` path materializes options server-side; the
    // local preview just counts non-empty distinct values.
    if (policy === "create_options") {
      const total = rows.length;
      return { incompatible: [], total };
    }
    const incompatible: PreflightRow[] = [];
    for (const row of rows) {
      const rowId = getRowId(row);
      const raw = accessor(row);
      const result = coerceCustomValue(raw, toType, { optionList: targetOptionList ?? [] });
      if (!result.ok) {
        incompatible.push({ rowId, rawValue: raw, reason: result.reason });
      }
    }
    return { incompatible, total: rows.length };
  }, [accessor, getRowId, policy, rows, targetOptionList, toType]);

  const incompatible = serverPreflight?.rows ?? localPreflight?.incompatible ?? [];
  const totalRows = serverPreflight?.total ?? localPreflight?.total ?? rows.length;
  const compatibleCount = totalRows - incompatible.length;
  const needsAck = incompatible.length > 0;
  const canSubmit = !!toType && policy !== null && !pending && (!needsAck || acknowledged);

  const virtualAnchorRef = useElementAnchorRef(anchorElement);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !toType) return;
    setSubmitError(null);
    setPending(true);
    try {
      await dispatchChangeType({
        fieldKey: fieldDef.field_key,
        fromType,
        toType,
        acknowledgeDestructive: needsAck,
      });
      onOpenChange(false);
    } catch (error) {
      // If the server returned a structured preflight envelope, re-show
      // its rows in this popover so the user can ack.
      const maybeDetails = (
        error as
          | { details?: { incompatible_rows?: PreflightRow[]; total_row_count?: number } }
          | undefined
      )?.details;
      if (maybeDetails?.incompatible_rows) {
        setServerPreflight({
          rows: maybeDetails.incompatible_rows,
          total: maybeDetails.total_row_count ?? totalRows,
        });
        setSubmitError(schemaMutationErrorMessage(error, "Conversion would clear values."));
      } else {
        setSubmitError(schemaMutationErrorMessage(error, "Could not change field type."));
      }
    } finally {
      setPending(false);
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
          aria-label={`Change type of ${fieldDef.display_name}`}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <form
            className="data-table-add-field-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="data-table-view-popover-heading">
              {fromType} → {toType ?? "?"}
            </div>
            <fieldset className="data-table-add-field-types">
              <legend className="data-table-add-field-label">Target type</legend>
              <div
                className="data-table-add-field-type-row"
                role="radiogroup"
                aria-label="Target type"
              >
                {allowedTargets.map((candidate) => {
                  const allowed = isConversionAllowed(fromType, candidate.kind);
                  return (
                    <button
                      key={candidate.kind}
                      type="button"
                      role="radio"
                      aria-checked={toType === candidate.kind}
                      aria-disabled={!allowed}
                      disabled={!allowed}
                      data-active={toType === candidate.kind ? "true" : undefined}
                      title={
                        allowed
                          ? candidate.label
                          : `Cannot convert ${fromType} values to ${candidate.label.toLowerCase()}.`
                      }
                      className="data-table-add-field-type-pill"
                      onClick={() => {
                        setToType(candidate.kind);
                        setAcknowledged(false);
                        setServerPreflight(null);
                      }}
                    >
                      {candidate.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="data-table-add-field-config" aria-live="polite">
              <span className="data-table-add-field-label">Preflight</span>
              <p>
                {compatibleCount} of {totalRows} row{totalRows === 1 ? "" : "s"} will keep their
                value
                {needsAck ? `; ${incompatible.length} will be cleared.` : "."}
              </p>
              {needsAck ? (
                <ul className="data-table-add-field-options" role="list">
                  {incompatible.slice(0, 25).map((entry) => (
                    <li key={entry.rowId} className="data-table-add-field-option-row">
                      <span>{entry.rowId}</span>
                      <span>{String(entry.rawValue)}</span>
                      <span>{entry.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {incompatible.length > 25 ? (
                <p className="form-note">…and {incompatible.length - 25} more.</p>
              ) : null}
            </div>

            {needsAck ? (
              <label className="data-table-add-field-toggle" htmlFor={ackId}>
                <input
                  id={ackId}
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                I understand the listed values will be cleared.
              </label>
            ) : null}

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
                {pending
                  ? "Converting…"
                  : needsAck
                    ? `Convert anyway (${incompatible.length} cleared)`
                    : "Convert"}
              </button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// Re-export the helpers for convenience.
export { CONVERSION_MATRIX };
