import { useId, useRef, useState, type ChangeEvent } from "react";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { useCommitImportMutation, usePreviewImportMutation } from "./useImportMutations";
import type { PreviewResponse } from "./types";

// Mirrors the backend's `_IMPORT_MAX_BYTES`. Imports never legitimately
// approach this size (a 10k-row file is < 1 MB).
const IMPORT_MAX_BYTES = 8 * 1024 * 1024;

const PREVIEW_RENDER_LIMIT = 20;

type Stage =
  | { kind: "pick" }
  | { kind: "loading"; fileName: string }
  | { kind: "report"; fileName: string; preview: PreviewResponse }
  | { kind: "committing"; fileName: string; preview: PreviewResponse }
  | { kind: "done"; fileName: string; inserted: number; skippedConflict: number };

export type ImportDialogProps = {
  onClose: () => void;
  onCommitted?: (info: { inserted: number; skippedConflict: number }) => void;
};

export function ImportDialog({ onClose, onCommitted }: ImportDialogProps) {
  const titleId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Monotonic id per file pick — late-resolving previews from an earlier
  // pick are discarded so file B's name can't render with file A's report.
  const requestIdRef = useRef(0);
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const previewMutation = usePreviewImportMutation();
  const commitMutation = useCommitImportMutation();

  function resetAndClose() {
    setStage({ kind: "pick" });
    setErrorBanner(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);

    if (file.size > IMPORT_MAX_BYTES) {
      setErrorBanner(
        `File too large (${formatBytes(file.size)}, max ${formatBytes(IMPORT_MAX_BYTES)}).`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const requestId = ++requestIdRef.current;
    const isStale = () => requestIdRef.current !== requestId;

    setStage({ kind: "loading", fileName: file.name });
    let parsed: unknown;
    try {
      const text = await readFileAsText(file);
      parsed = JSON.parse(text);
    } catch (parseError) {
      if (isStale()) return;
      setErrorBanner(`Could not parse file as JSON: ${(parseError as Error).message}`);
      setStage({ kind: "pick" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const preview = await previewMutation.mutateAsync(parsed);
      if (isStale()) return;
      setStage({ kind: "report", fileName: file.name, preview });
    } catch (apiError) {
      if (isStale()) return;
      setErrorBanner(formatApiError(apiError));
      setStage({ kind: "pick" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirm() {
    if (stage.kind !== "report") return;
    const { preview, fileName } = stage;
    setErrorBanner(null);
    setStage({ kind: "committing", fileName, preview });
    try {
      const result = await commitMutation.mutateAsync(preview.token);
      setStage({
        kind: "done",
        fileName,
        inserted: result.inserted,
        skippedConflict: result.skipped_conflict_ids.length,
      });
      onCommitted?.({
        inserted: result.inserted,
        skippedConflict: result.skipped_conflict_ids.length,
      });
    } catch (apiError) {
      setErrorBanner(formatApiError(apiError));
      if (apiError instanceof ApiRequestError && apiError.status === 410) {
        setStage({ kind: "pick" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setStage({ kind: "report", fileName, preview });
    }
  }

  return (
    <ModalDialog title="Import glazing-types JSON" titleId={titleId} onClose={resetAndClose}>
      {errorBanner ? (
        <p className="form-error" role="alert" data-testid="import-dialog-error">
          {errorBanner}
        </p>
      ) : null}

      {stage.kind === "pick" ? (
        <div className="import-dialog-pick">
          <p>Select a Window-Glazing Catalog JSON file exported from PH-Navigator.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            data-testid="import-dialog-file"
          />
          <p className="modal-subtitle">Max {formatBytes(IMPORT_MAX_BYTES)}.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={resetAndClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {stage.kind === "loading" ? <p>Analyzing {stage.fileName}…</p> : null}

      {stage.kind === "report" ? (
        <ImportReport
          fileName={stage.fileName}
          preview={stage.preview}
          committing={commitMutation.isPending}
          onCancel={resetAndClose}
          onConfirm={handleConfirm}
        />
      ) : null}

      {stage.kind === "committing" ? <p>Importing {stage.fileName}…</p> : null}

      {stage.kind === "done" ? (
        <div className="import-dialog-done">
          <p>
            Imported {stage.inserted} {stage.inserted === 1 ? "row" : "rows"} from{" "}
            <code>{stage.fileName}</code>.
          </p>
          {stage.skippedConflict > 0 ? (
            <p className="modal-subtitle">
              {stage.skippedConflict} {stage.skippedConflict === 1 ? "row was" : "rows were"}{" "}
              skipped due to id conflicts.
            </p>
          ) : null}
          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={resetAndClose}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </ModalDialog>
  );
}

function ImportReport({
  fileName,
  preview,
  committing,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  preview: PreviewResponse;
  committing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { counts, warnings, errors, rows_preview } = preview;
  return (
    <div className="import-dialog-report">
      <p className="modal-subtitle">
        <code>{fileName}</code> — schema v{preview.schema_version}
      </p>
      <dl className="import-dialog-counts">
        <div>
          <dt>New</dt>
          <dd>{counts.new}</dd>
        </div>
        <div>
          <dt>Matched (will skip)</dt>
          <dd>{counts.matched}</dd>
        </div>
        <div>
          <dt>Errored</dt>
          <dd>{counts.errored}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{counts.warnings}</dd>
        </div>
        {counts.dropped > 0 ? (
          <div>
            <dt>Dropped</dt>
            <dd>{counts.dropped}</dd>
          </div>
        ) : null}
      </dl>

      {errors.length > 0 ? (
        <ReasonList title="Row errors (excluded)" reasons={errors} variant="error" />
      ) : null}
      {warnings.length > 0 ? (
        <ReasonList title="Warnings" reasons={warnings} variant="warning" />
      ) : null}

      {rows_preview.length > 0 ? (
        <details className="import-dialog-row-preview">
          <summary>
            First {Math.min(rows_preview.length, PREVIEW_RENDER_LIMIT)} of {rows_preview.length}{" "}
            rows
          </summary>
          <table>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Classification</th>
                <th scope="col">Name</th>
                <th scope="col">Manufacturer</th>
              </tr>
            </thead>
            <tbody>
              {rows_preview.slice(0, PREVIEW_RENDER_LIMIT).map((row) => (
                <tr key={row.index} data-classification={row.classification}>
                  <td>{row.index + 1}</td>
                  <td>{row.classification}</td>
                  <td>{row.name ?? "—"}</td>
                  <td>{row.manufacturer ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onConfirm}
          disabled={counts.new === 0 || committing}
        >
          Import {counts.new} {counts.new === 1 ? "row" : "rows"}
        </button>
      </div>
    </div>
  );
}

function ReasonList({
  title,
  reasons,
  variant,
}: {
  title: string;
  reasons: { reason: string; count: number; row_indices: number[] }[];
  variant: "error" | "warning";
}) {
  return (
    <section className={`import-dialog-reasons import-dialog-reasons-${variant}`}>
      <h3>{title}</h3>
      <ul>
        {reasons.map((entry) => (
          <li key={entry.reason}>
            <code>{entry.reason}</code> — {entry.count} {entry.count === 1 ? "row" : "rows"} (
            {entry.row_indices
              .slice(0, 5)
              .map((index) => index + 1)
              .join(", ")}
            {entry.row_indices.length > 5 ? "…" : ""})
          </li>
        ))}
      </ul>
    </section>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ERROR_CODE_COPY: Record<string, string> = {
  catalog_import_bad_json: "File is not valid JSON. Check the export and try again.",
  catalog_import_schema_too_new:
    "This file was exported by a newer version of PH-Navigator. Upgrade the app or downgrade the file.",
  catalog_import_too_large: "File too large (max 8 MB).",
  catalog_import_token_missing: "Preview expired — please re-upload the file.",
  catalog_import_token_forbidden:
    "This import preview belongs to another session. Please re-upload the file.",
  catalog_import_field_required:
    "A required field is missing after coercion; please fix the file and re-upload.",
};

function formatApiError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 413) {
      return ERROR_CODE_COPY.catalog_import_too_large ?? "File too large.";
    }
    if (error.errorCode === "catalog_import_bad_envelope") {
      return `Bad envelope: ${error.message}`;
    }
    const curated = error.errorCode ? ERROR_CODE_COPY[error.errorCode] : undefined;
    if (curated) return curated;
    const tail = error.statusText || error.message;
    return `Import failed (${error.status})${tail ? `: ${tail}` : ""}.`;
  }
  return errorMessage(error, "Could not import the file. Check your connection and try again.");
}
