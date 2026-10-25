import { AlertTriangle, LoaderCircle, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { LoadSummary, ModelViewerErrorKind, ViewerLoadPhase } from "../types";

type LoadingChipProps = {
  phase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  errorMessage: string | null;
  loadSummary: LoadSummary | null;
  onRetry: () => void;
  fileName?: string;
};

export function LoadingChip({
  phase,
  errorKind,
  errorMessage,
  loadSummary,
  onRetry,
  fileName,
}: LoadingChipProps) {
  const [showReadySummary, setShowReadySummary] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => setCopyStatus(""), [errorMessage, phase]);

  useEffect(() => {
    if (phase !== "ready" || !loadSummary) {
      setShowReadySummary(false);
      return;
    }
    setShowReadySummary(true);
    const timeout = window.setTimeout(() => setShowReadySummary(false), 2400);
    return () => window.clearTimeout(timeout);
  }, [loadSummary, phase]);

  if (phase === "idle" || phase === "ready") {
    if (!loadSummary || !showReadySummary) return null;
    return (
      <div className="model-loading-chip" role="status">
        {summaryText(loadSummary)}
      </div>
    );
  }

  if (phase === "error") {
    const permanent = errorKind === "permanent";
    return (
      <div className="model-loading-chip error" role="alert">
        <strong>
          <AlertTriangle size={15} aria-hidden /> Couldn't load model
        </strong>
        {fileName ? <span>{fileName}</span> : null}
        <p>
          {permanent
            ? "The server could not read this HBJSON. Review the details below before correcting or re-exporting the file."
            : "Model loading failed. Retry the request; if it keeps failing, copy the details for troubleshooting."}
        </p>
        <pre className="model-loading-chip-detail">
          {errorMessage ?? "No diagnostic details were returned."}
        </pre>
        <div className="model-load-error-actions">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  [fileName, errorMessage].filter(Boolean).join("\n\n"),
                );
                setCopyStatus("Details copied.");
              } catch {
                setCopyStatus("Could not copy. Select and copy the details above.");
              }
            }}
          >
            Copy error details
          </button>
          {!permanent ? (
            <button type="button" onClick={onRetry}>
              <RotateCw size={14} aria-hidden /> Retry
            </button>
          ) : null}
        </div>
        <span role="status">{copyStatus}</span>
      </div>
    );
  }

  return (
    <div className="model-loading-chip" role="status">
      <LoaderCircle size={15} aria-hidden className="model-loading-spin" />
      {phase === "downloading" ? "Downloading model" : "Building scene"}
    </div>
  );
}

function summaryText(summary: LoadSummary): string {
  const skipped = summary.air_boundaries_skipped
    ? ` · ${summary.air_boundaries_skipped} air boundaries not rendered`
    : "";
  return `${summary.faces_extracted} surfaces · ${summary.spaces_extracted} spaces${skipped}`;
}
