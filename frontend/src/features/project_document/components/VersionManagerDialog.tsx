import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { DialogActions, ModalDialog } from "../../../shared/ui";
import { useDeleteVersionMutation, usePatchVersionMutation } from "../../projects/hooks";
import type { ProjectVersion } from "../../projects/types";
import { VersionSummary } from "./VersionSummary";

type ManagerAction =
  | { kind: "rename"; version: ProjectVersion }
  | { kind: "delete"; version: ProjectVersion }
  | null;

export function VersionManager({
  projectId,
  versions,
  activeVersionId,
  defaultVersionId,
  onOpenVersion,
  onClose,
}: {
  projectId: string;
  versions: ProjectVersion[];
  activeVersionId: string | null;
  defaultVersionId: string | null;
  onOpenVersion: (versionId: string) => void;
  onClose: () => void;
}) {
  const renameVersion = usePatchVersionMutation(projectId);
  const deleteVersion = useDeleteVersionMutation(projectId);
  return (
    <VersionManagerDialog
      versions={versions}
      activeVersionId={activeVersionId}
      defaultVersionId={defaultVersionId}
      onOpenVersion={onOpenVersion}
      onRename={async (versionId, name) => {
        await renameVersion.mutateAsync({ versionId, name });
      }}
      onDelete={async (versionId, confirmName) => {
        await deleteVersion.mutateAsync({ versionId, confirmName });
        if (versionId === activeVersionId && defaultVersionId) {
          onOpenVersion(defaultVersionId);
        }
      }}
      onClose={onClose}
    />
  );
}

export function VersionManagerDialog({
  versions,
  activeVersionId,
  defaultVersionId,
  onOpenVersion,
  onRename,
  onDelete,
  onClose,
}: {
  versions: ProjectVersion[];
  activeVersionId: string | null;
  defaultVersionId: string | null;
  onOpenVersion: (versionId: string) => void;
  onRename: (versionId: string, name: string) => Promise<void>;
  onDelete: (versionId: string, confirmName: string) => Promise<void>;
  onClose: () => void;
}) {
  const [action, setAction] = useState<ManagerAction>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const clearAction = () => {
    setAction(null);
    setValue("");
    setError(null);
  };

  const submitAction = async () => {
    if (!action || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action.kind === "rename") {
        await onRename(action.version.id, value.trim());
      } else {
        await onDelete(action.version.id, value);
      }
      clearAction();
    } catch (caught) {
      setError(errorMessage(caught, `Could not ${action.kind} version.`));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!action) return;
    const current = versions.find((version) => version.id === action.version.id);
    if (!current) {
      setAction(null);
      setValue("");
      setError(null);
      return;
    }
    if (current.name !== action.version.name) {
      setAction({ ...action, version: current });
      setValue(action.kind === "rename" ? current.name : "");
      setError(null);
    }
  }, [action, versions]);

  const actionIsValid =
    action?.kind === "rename"
      ? value.trim().length >= 1 && value.trim().length <= 120
      : action?.kind === "delete"
        ? value === action.version.name
        : true;

  return (
    <ModalDialog
      id="version-manager"
      title="Manage versions"
      titleId="version-manager-title"
      onClose={busy ? () => undefined : action ? clearAction : onClose}
      scrollBody
    >
      <div className="modal-form version-manager-body">
        {action ? (
          <VersionManagerAction action={action} value={value} onChange={setValue} />
        ) : (
          <div className="version-manager-list">
            {versions.map((version) => {
              const isDefault = version.id === defaultVersionId;
              const deleteDisabled = isDefault || versions.length === 1;
              const deleteHelp = isDefault
                ? "The default version cannot be deleted. Make another version default first."
                : versions.length === 1
                  ? "A project must retain at least one version."
                  : undefined;
              const summaryId = `version-manager-summary-${version.id}`;
              const deleteHelpId = deleteHelp
                ? `version-manager-delete-help-${version.id}`
                : undefined;
              return (
                <section
                  className="version-manager-row"
                  key={version.id}
                  aria-labelledby={summaryId}
                >
                  <VersionSummary version={version} isDefault={isDefault} headingId={summaryId} />
                  <div className="version-manager-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`Open ${version.name}`}
                      onClick={() => onOpenVersion(version.id)}
                      disabled={version.id === activeVersionId}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`Rename ${version.name}`}
                      onClick={() => {
                        setAction({ kind: "rename", version });
                        setValue(version.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      aria-label={`Delete ${version.name}`}
                      aria-describedby={deleteHelpId}
                      disabled={deleteDisabled}
                      onClick={() => {
                        setAction({ kind: "delete", version });
                        setValue("");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  {deleteHelp ? (
                    <span className="version-manager-guard" id={deleteHelpId}>
                      {deleteHelp}
                    </span>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
      <DialogActions
        busy={busy}
        cancelDisabled={busy}
        error={error}
        submitLabel={
          action?.kind === "rename"
            ? "Rename version"
            : action?.kind === "delete"
              ? "Delete version"
              : "Done"
        }
        submitDisabled={!actionIsValid}
        danger={action?.kind === "delete"}
        onClose={busy ? () => undefined : action ? clearAction : onClose}
        onConfirm={action ? () => void submitAction() : onClose}
      />
    </ModalDialog>
  );
}

function VersionManagerAction({
  action,
  value,
  onChange,
}: {
  action: Exclude<ManagerAction, null>;
  value: string;
  onChange: (value: string) => void;
}) {
  if (action.kind === "rename") {
    return (
      <label>
        Version name
        <input
          autoFocus
          maxLength={120}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    );
  }
  return (
    <div className="version-delete-confirmation">
      <p className="modal-lede">
        Delete <strong>{action.version.name}</strong>? Associated drafts will be discarded. Child
        versions will be kept but detached from this parent.
      </p>
      <label>
        Type <strong>{action.version.name}</strong> to confirm
        <input autoFocus value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}
