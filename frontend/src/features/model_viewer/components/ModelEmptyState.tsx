import { ArrowDownToLine } from "lucide-react";
import type { HbjsonUploadFlow } from "../hooks";
import { UploadDropZone } from "./UploadDropZone";
import { UploadNoticeLine } from "./UploadNoticeLine";

/**
 * UI_SPEC §8, Phase-1 subset: centered card on a plain surface (the
 * lit-scene backdrop arrives in Phase 3). Editors get the drop-zone CTA;
 * viewers get a message only.
 */
export function ModelEmptyState({
  isEditor,
  uploadFlow,
}: {
  isEditor: boolean;
  uploadFlow: HbjsonUploadFlow;
}) {
  return (
    <div className="model-empty-state" aria-label="No model uploaded">
      <div className="model-empty-card">
        {isEditor ? (
          <>
            <h3>No model uploaded yet</h3>
            <UploadDropZone onFile={uploadFlow.handleFile} progress={uploadFlow.progress} />
            <UploadNoticeLine notice={uploadFlow.notice} onSwitch={() => undefined} />
          </>
        ) : (
          <>
            <ArrowDownToLine size={20} aria-hidden="true" />
            <h3>No model has been uploaded to this project yet.</h3>
          </>
        )}
      </div>
    </div>
  );
}
