import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect, ModalDialog } from "../../../shared/ui";
import type { ProjectVersion } from "../../projects/types";
import type { DiffChange, DiffSummary } from "../types";
import { DRAFT_DIFF_TARGET } from "../types/versionControls";

export function DiffDialog({
  versions,
  fromVersionId,
  diffTarget,
  diffData,
  isLoading,
  error,
  onFromChange,
  onTargetChange,
  onClose,
}: {
  versions: ProjectVersion[];
  fromVersionId: string;
  diffTarget: string;
  diffData: DiffSummary | undefined;
  isLoading: boolean;
  error: unknown;
  onFromChange: (versionId: string) => void;
  onTargetChange: (target: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalDialog
      id="version-diff"
      title="Compare versions"
      titleId="diff-title"
      onClose={onClose}
      dismissOnBackdrop
      resizable
      scrollBody
    >
      <div className="diff-panel">
        <div className="diff-selectors">
          <AutocompleteSelect
            label="From"
            value={fromVersionId}
            options={versions.map((version) => ({ value: version.id, label: version.name }))}
            onChange={onFromChange}
          />
          <AutocompleteSelect
            label="To"
            value={diffTarget}
            options={[
              { value: DRAFT_DIFF_TARGET, label: "Current draft" },
              ...versions
                .filter((version) => version.id !== fromVersionId)
                .map((version) => ({ value: version.id, label: version.name })),
            ]}
            onChange={onTargetChange}
          />
        </div>
        <div className="diff-results" aria-busy={isLoading}>
          {isLoading ? (
            <p className="diff-state" role="status">
              Loading comparison…
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {errorMessage(error, "Could not load comparison.")}
            </p>
          ) : null}
          {!isLoading && !error && diffData?.tables.length === 0 ? (
            <p className="diff-state" role="status">
              No changes
            </p>
          ) : null}
          {!isLoading && !error
            ? diffData?.tables.map((table) => <DiffTableSection key={table.table} table={table} />)
            : null}
        </div>
      </div>
      <div className="modal-actions diff-actions">
        <button type="button" className="primary-button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalDialog>
  );
}

function DiffTableSection({ table }: { table: DiffSummary["tables"][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="diff-table" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <strong>{table.table_label}</strong>
        <span>{formatCounts(table)}</span>
      </summary>
      {open ? (
        <div className="diff-change-list">
          {table.changes.map((change, index) => (
            <DiffChangeRow
              key={`${change.operation}:${change.record_id}:${change.field_key ?? "record"}:${index}`}
              change={change}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}

function DiffChangeRow({ change }: { change: DiffChange }) {
  const fieldLabel = change.field_label ?? change.field_key;
  return (
    <article className={`diff-change diff-change--${change.operation}`}>
      <div className="diff-change-main">
        <span className="chip chip--sm diff-operation">{operationLabel(change.operation)}</span>
        <strong>{change.record_label}</strong>
        {change.operation === "changed" ? (
          <span className="diff-value-line">
            {fieldLabel ? <b>{fieldLabel}:</b> : null}
            <span className="sr-only">changed from</span>
            <DiffValue value={change.before} />
            <span aria-hidden="true">→</span>
            <span className="sr-only">to</span>
            <DiffValue value={change.after} />
          </span>
        ) : (
          <span className="diff-value-line">
            <DiffValue value={change.operation === "added" ? change.after : change.before} />
          </span>
        )}
      </div>
      <TechnicalDetails change={change} />
    </article>
  );
}

function TechnicalDetails({ change }: { change: DiffChange }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="diff-technical" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Technical details</summary>
      {open ? (
        <dl>
          <dt>Record ID</dt>
          <dd>{change.record_id}</dd>
          {change.field_key ? (
            <>
              <dt>Field key</dt>
              <dd>{change.field_key}</dd>
            </>
          ) : null}
          <dt>Raw paths</dt>
          <dd>{change.raw_paths.join("\n") || "None"}</dd>
          <dt>Before</dt>
          <dd>{prettyJson(change.before)}</dd>
          <dt>After</dt>
          <dd>{prettyJson(change.after)}</dd>
        </dl>
      ) : null}
    </details>
  );
}

function DiffValue({ value }: { value: unknown }) {
  return <span className="diff-value">{summarizeValue(value)}</span>;
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  if (typeof value === "object") {
    const count = Object.keys(value).length;
    return `${count} ${count === 1 ? "field" : "fields"}`;
  }
  const text = typeof value === "string" ? JSON.stringify(value) : String(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

function prettyJson(value: unknown): string {
  if (value === undefined) return "None";
  return JSON.stringify(value, null, 2) ?? "None";
}

function operationLabel(operation: DiffChange["operation"]): string {
  if (operation === "added") return "Added";
  if (operation === "removed") return "Removed";
  return "Changed";
}

function formatCounts({
  added_count: added,
  removed_count: removed,
  changed_count: changed,
}: DiffSummary["tables"][number]): string {
  const parts = [
    added ? `${added} added` : "",
    removed ? `${removed} removed` : "",
    changed ? `${changed} changed` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "No changes";
}
