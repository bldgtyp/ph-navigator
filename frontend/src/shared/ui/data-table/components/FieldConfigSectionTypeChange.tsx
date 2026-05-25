// Inline sub-panel rendered inside FieldConfigModal when the user
// picks a target type that differs from the source. Presentational —
// the parent supplies the pre-computed preflight result so the row
// walk happens exactly once per render.
import { useId } from "react";
import type { CustomFieldType } from "../types";
import type { LocalPreflightResult, PreflightRow } from "../lib/coerceCustomFieldType";

export type ServerPreflightPayload = { rows: PreflightRow[]; total: number };

export type FieldConfigSectionTypeChangeProps = {
  fromType: CustomFieldType;
  toType: CustomFieldType;
  localPreflight: LocalPreflightResult | null;
  serverPreflight: ServerPreflightPayload | null;
  acknowledged: boolean;
  onAcknowledgeChange: (next: boolean) => void;
  disabled?: boolean;
};

export function FieldConfigSectionTypeChange({
  fromType,
  toType,
  localPreflight,
  serverPreflight,
  acknowledged,
  onAcknowledgeChange,
  disabled = false,
}: FieldConfigSectionTypeChangeProps) {
  const ackId = useId();
  const incompatible = serverPreflight?.rows ?? localPreflight?.incompatible ?? [];
  const totalRows = serverPreflight?.total ?? localPreflight?.total ?? 0;
  const compatibleCount = Math.max(0, totalRows - incompatible.length);
  const needsAck = incompatible.length > 0;

  return (
    <div
      className="data-table-field-config-modal-section data-table-field-config-typechange"
      role="group"
      aria-label={`Type change preflight: ${fromType} → ${toType}`}
    >
      <div className="data-table-view-popover-heading">
        {fromType} → {toType}
      </div>
      <div className="data-table-add-field-config" aria-live="polite">
        <span className="data-table-add-field-label">Preflight</span>
        <p>
          {compatibleCount} of {totalRows} row{totalRows === 1 ? "" : "s"} will keep their value
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
            disabled={disabled}
            onChange={(event) => onAcknowledgeChange(event.target.checked)}
          />
          I understand the listed values will be cleared.
        </label>
      ) : null}
    </div>
  );
}
