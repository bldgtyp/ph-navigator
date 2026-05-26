import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { ProjectVersion } from "../../projects/types";
import type { DiffSummary } from "../types";
import type { DraftRestorePrompt, SaveAsVersionKind } from "../types/versionControls";
import { DRAFT_DIFF_TARGET, SAVE_AS_VERSION_KINDS } from "../types/versionControls";

export function DraftRestoreDialog({
  prompt,
  busy,
  onDiscard,
  onKeep,
}: {
  prompt: DraftRestorePrompt;
  busy: boolean;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  return (
    <ModalDialog title="Unsaved draft found" titleId="restore-draft-title" onClose={onKeep}>
      <div className="confirmation-panel">
        <p>
          This version has a recovered server draft
          {prompt.lastPatchedAt ? ` from ${formatProjectDateTime(prompt.lastPatchedAt)}` : ""}. Keep
          it open or discard it and reload the saved version.
        </p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onDiscard} disabled={busy}>
            Discard draft
          </button>
          <button type="button" onClick={onKeep} disabled={busy}>
            Restore draft
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

export function SaveAsDialog({
  versionName,
  versionKind,
  busy,
  onNameChange,
  onKindChange,
  onClose,
  onSubmit,
}: {
  versionName: string;
  versionKind: SaveAsVersionKind;
  busy: boolean;
  onNameChange: (name: string) => void;
  onKindChange: (kind: SaveAsVersionKind) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalDialog title="Save As" titleId="save-as-title" onClose={onClose}>
      <form
        className="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          Version name
          <input
            value={versionName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Round 1 Submit"
            required
          />
        </label>
        <label>
          Version kind
          <select
            value={versionKind}
            onChange={(event) => onKindChange(event.target.value as SaveAsVersionKind)}
          >
            {SAVE_AS_VERSION_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={busy || versionName.trim().length === 0}>
            Create version
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

export function DiffDialog({
  activeVersionId,
  versions,
  diffTarget,
  diffData,
  isLoading,
  error,
  onTargetChange,
  onClose,
}: {
  activeVersionId: string | null;
  versions: ProjectVersion[];
  diffTarget: string;
  diffData: DiffSummary | undefined;
  isLoading: boolean;
  error: unknown;
  onTargetChange: (target: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalDialog title="Diff" titleId="diff-title" onClose={onClose}>
      <div className="diff-panel">
        <label className="diff-target-control">
          Compare current version to
          <select value={diffTarget} onChange={(event) => onTargetChange(event.target.value)}>
            <option value={DRAFT_DIFF_TARGET}>Current draft</option>
            {versions
              .filter((version) => version.id !== activeVersionId)
              .map((version) => (
                <option key={version.id} value={version.id}>
                  {version.name}
                </option>
              ))}
          </select>
        </label>
        {isLoading ? <p>Loading diff...</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {errorMessage(error, "Could not load diff.")}
          </p>
        ) : null}
        {diffData?.tables.map((table) => (
          <section key={table.table} className="diff-table">
            <h3>{table.table}</h3>
            <p>{table.change_count} changed paths</p>
            <ul>
              {table.changed_paths.slice(0, 12).map((path) => (
                <li key={path}>{path}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ModalDialog>
  );
}
