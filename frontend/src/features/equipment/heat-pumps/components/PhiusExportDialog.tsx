import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../../../../shared/lib/errors";
import { downloadBlob } from "../../../../shared/lib/downloadBlob";
import { ModalDialog } from "../../../../shared/ui/ModalDialog";
import { requestPhiusExport } from "../api";
import { buildPhiusExportFilename } from "../lib/phius-export";
import type { PhiusExportResponse, PhiusExportWarning } from "../types";

type DialogState =
  | { status: "loading" }
  | { status: "ready"; payload: PhiusExportResponse }
  | { status: "error"; message: string };

export function PhiusExportDialog({
  projectId,
  btNumber,
  onClose,
}: {
  projectId: string;
  btNumber: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<DialogState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    requestPhiusExport(projectId)
      .then((payload) => {
        if (!cancelled) setState({ status: "ready", payload });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            status: "error",
            message: errorMessage(err, "Could not compute Phius export."),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleContinue = () => {
    if (state.status !== "ready") return;
    const blob = new Blob([state.payload.csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, buildPhiusExportFilename(btNumber));
    onClose();
  };

  return (
    <ModalDialog
      title="Export to Phius HP Estimator"
      titleId="hp-phius-export-title"
      onClose={onClose}
    >
      <div className="project-form hp-modal-form">
        {state.status === "loading" ? <p>Computing export…</p> : null}
        {state.status === "error" ? (
          <p className="form-error" role="alert">
            {state.message}
          </p>
        ) : null}
        {state.status === "ready" ? <PhiusExportReadyBody payload={state.payload} /> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {state.status === "ready" ? "Cancel" : "Close"}
          </button>
          {state.status === "ready" ? (
            <button type="button" onClick={handleContinue}>
              {state.payload.warnings.length > 0 ? "Continue with gaps" : "Download CSV"}
            </button>
          ) : null}
        </div>
      </div>
    </ModalDialog>
  );
}

function PhiusExportReadyBody({ payload }: { payload: PhiusExportResponse }) {
  const groupedWarnings = useMemo(() => groupByRow(payload.warnings), [payload.warnings]);
  const summary =
    `${payload.rows.length} outdoor equip ${payload.rows.length === 1 ? "row" : "rows"}` +
    ` · ${groupedWarnings.size} with ${groupedWarnings.size === 1 ? "warning" : "warnings"}`;
  return (
    <>
      <p>{summary}</p>
      {groupedWarnings.size === 0 ? (
        <p>All required fields populated.</p>
      ) : (
        <ul className="hp-phius-warning-list">
          {Array.from(groupedWarnings.values()).map((group) => (
            <li key={group.row_id}>
              <strong>{group.model_number || "(no model number)"}</strong>
              <ul>
                {group.warnings.map((warning) => (
                  <li key={`${warning.row_id}:${warning.field}`}>{warning.message}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

type WarningGroup = {
  row_id: string;
  model_number: string;
  warnings: PhiusExportWarning[];
};

function groupByRow(warnings: PhiusExportWarning[]): Map<string, WarningGroup> {
  const grouped = new Map<string, WarningGroup>();
  for (const warning of warnings) {
    const group = grouped.get(warning.row_id);
    if (group) {
      group.warnings.push(warning);
    } else {
      grouped.set(warning.row_id, {
        row_id: warning.row_id,
        model_number: warning.model_number,
        warnings: [warning],
      });
    }
  }
  return grouped;
}
