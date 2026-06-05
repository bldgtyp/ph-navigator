import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
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
    <ModalDialog title="Recovered draft found" titleId="restore-draft-title" onClose={onKeep}>
      <div className="confirmation-panel">
        <p>
          Your edits were auto-saved to a server draft
          {prompt.lastPatchedAt ? ` at ${formatProjectDateTime(prompt.lastPatchedAt)}` : ""} but
          never committed to a version. Restore the draft to continue editing, or discard it and
          reload the last saved version.
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
        <AutocompleteSelect
          label="Version kind"
          value={versionKind}
          options={SAVE_AS_VERSION_KINDS.map((kind) => ({
            value: kind.value,
            label: kind.label,
          }))}
          onChange={(nextKind) => onKindChange(nextKind as SaveAsVersionKind)}
        />
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
        <AutocompleteSelect
          className="diff-target-control"
          label="Compare current version to"
          value={diffTarget}
          options={[
            { value: DRAFT_DIFF_TARGET, label: "Current draft" },
            ...versions
              .filter((version) => version.id !== activeVersionId)
              .map((version) => ({ value: version.id, label: version.name })),
          ]}
          onChange={onTargetChange}
        />
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
