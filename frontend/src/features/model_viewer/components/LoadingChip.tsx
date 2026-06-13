import { AlertTriangle, LoaderCircle, RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { LoadSummary, ModelViewerErrorKind, ViewerLoadPhase } from "../types";

type LoadingChipProps = {
  phase: ViewerLoadPhase;
  errorKind: ModelViewerErrorKind | null;
  errorMessage: string | null;
  loadSummary: LoadSummary | null;
  onRetry: () => void;
};

export function LoadingChip({
  phase,
  errorKind,
  errorMessage,
  loadSummary,
  onRetry,
}: LoadingChipProps) {
  const [showReadySummary, setShowReadySummary] = useState(false);

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
        <AlertTriangle size={15} aria-hidden />
        <span>{permanent ? "This file couldn't be parsed" : "Couldn't load model"}</span>
        {errorMessage ? <span className="model-loading-chip-detail">{errorMessage}</span> : null}
        {!permanent ? (
          <button type="button" onClick={onRetry}>
            <RotateCw size={14} aria-hidden />
            Retry
          </button>
        ) : null}
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
