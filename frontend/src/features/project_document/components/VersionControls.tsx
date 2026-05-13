import { useEffect, useRef, useState } from "react";
import { formatProjectDateTime } from "../../../shared/lib/dates";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { usePatchVersionMutation } from "../../projects/hooks";
import type { ProjectDetail } from "../../projects/types";
import { projectDownloadUrl } from "../api";
import {
  useDiffQuery,
  useDiscardDraftMutation,
  useDraftSummaryQuery,
  useSaveDraftAsMutation,
  useSaveDraftMutation,
} from "../hooks";
import {
  isReadSafeProjectDocument,
  isVersionLockedError,
  isVersionStaleError,
  wasLocalDraftTouched,
} from "../lib";

const DRAFT_DIFF_TARGET = "draft";
type SaveAsVersionKind = "working" | "submitted" | "closed";

const SAVE_AS_VERSION_KINDS: Array<{ value: SaveAsVersionKind; label: string }> = [
  { value: "working", label: "Working" },
  { value: "submitted", label: "Submitted" },
  { value: "closed", label: "Closed" },
];
const LOCKED_SAVE_AS_KINDS = new Set<SaveAsVersionKind>(["submitted", "closed"]);

type PendingSwitch = { versionId: string; name: string };

type ConfirmationDialog =
  | { kind: "discard" }
  | { kind: "unlock" }
  | { kind: "switch"; target: PendingSwitch }
  | { kind: "stale-save" }
  | { kind: "locked-save" };

type DraftRestorePrompt = {
  lastPatchedAt: string | null;
};

type ConfirmationDialogActions = {
  onCancel: () => void;
  onDiscard: () => void;
  onUnlock: () => void;
  onSaveAs: () => void;
  onSwitchSave: (target: PendingSwitch) => void;
  onSwitchSaveAs: (target: PendingSwitch) => void;
  onSwitchDiscard: (target: PendingSwitch) => void;
};

export function VersionControls({
  project,
  defaultVersionId,
  onOpenVersion,
}: {
  project: ProjectDetail;
  defaultVersionId: string | null;
  onOpenVersion: (versionId: string) => void;
}) {
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffTarget, setDiffTarget] = useState(DRAFT_DIFF_TARGET);
  const [versionName, setVersionName] = useState("");
  const [versionKind, setVersionKind] = useState<SaveAsVersionKind>("working");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationDialog | null>(null);
  const [draftRestorePrompt, setDraftRestorePrompt] = useState<DraftRestorePrompt | null>(null);
  const [saveAsReturnVersionId, setSaveAsReturnVersionId] = useState<string | null>(null);
  const initializedDraftKeysRef = useRef(new Set<string>());
  const activeVersion = project.active_version;
  const activeVersionId = activeVersion?.id ?? null;
  const isEditor = project.access_mode === "editor";
  const draftSummaryQuery = useDraftSummaryQuery(project.id, activeVersionId, isEditor);
  const draftStatus = draftSummaryQuery.data;
  const draftSummary = draftStatus && !isReadSafeProjectDocument(draftStatus) ? draftStatus : null;
  const isLocked = draftSummary?.is_locked ?? activeVersion?.locked ?? false;
  const hasDraft = draftSummary?.source === "draft";
  const saveMutation = useSaveDraftMutation(project.id, activeVersionId);
  const saveAsMutation = useSaveDraftAsMutation(project.id, activeVersionId);
  const discardMutation = useDiscardDraftMutation(project.id, activeVersionId);
  const patchVersionMutation = usePatchVersionMutation(project.id);
  const diffQuery = useDiffQuery(
    project.id,
    activeVersionId,
    diffTarget,
    diffOpen && Boolean(activeVersionId),
  );

  useEffect(() => {
    if (!hasDraft || !activeVersionId) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeVersionId, hasDraft]);

  useEffect(() => {
    if (!activeVersionId || draftSummaryQuery.isLoading || draftSummary?.source !== "draft") return;

    const draftRestoreKey = `${activeVersionId}:${draftSummary.draft_etag ?? "draft"}`;
    if (initializedDraftKeysRef.current.has(draftRestoreKey)) return;

    initializedDraftKeysRef.current.add(draftRestoreKey);
    if (
      !wasLocalDraftTouched(project.id, activeVersionId, draftSummary.draft_etag) &&
      draftLooksRecovered(draftSummary.last_patched_at)
    ) {
      setDraftRestorePrompt({
        lastPatchedAt: draftSummary.last_patched_at,
      });
    }
  }, [activeVersionId, draftSummary, draftSummaryQuery.isLoading, project.id]);

  if (!isEditor) {
    return (
      <div className="shell-controls viewer-controls">
        <span>Edit controls hidden</span>
        {activeVersionId ? (
          <a
            className="secondary-button download-link"
            href={projectDownloadUrl(project.id, activeVersionId)}
          >
            Project JSON
          </a>
        ) : null}
      </div>
    );
  }

  const runHeaderAction = async (fallbackMessage: string, action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error, fallbackMessage));
    }
  };

  const handleDocumentActionError = async (error: unknown, fallbackMessage: string) => {
    if (isVersionLockedError(error)) {
      setActionError("This version was locked elsewhere. Save As to keep the draft.");
      setConfirmation({ kind: "locked-save" });
      await draftSummaryQuery.refetch();
      return;
    }
    if (isVersionStaleError(error)) {
      setActionError("The saved version changed while this draft was open.");
      setConfirmation({ kind: "stale-save" });
      await draftSummaryQuery.refetch();
      return;
    }
    setActionError(errorMessage(error, fallbackMessage));
  };

  const saveDraft = async (fallbackMessage: string, afterSuccess?: () => void) => {
    if (!draftSummary || !activeVersionId) return;
    setActionError(null);
    try {
      await saveMutation.mutateAsync({ versionEtag: draftSummary.version_etag });
      afterSuccess?.();
    } catch (error) {
      await handleDocumentActionError(error, fallbackMessage);
    }
  };

  const save = async () => {
    await saveDraft("Could not save draft.");
  };

  const saveAs = async () => {
    if (!activeVersionId) return;
    await runHeaderAction("Could not save as a new version.", async () => {
      const response = await saveAsMutation.mutateAsync({
        name: versionName,
        kind: versionKind,
        locked: LOCKED_SAVE_AS_KINDS.has(versionKind),
      });
      // Switch-flow Save As preserves the requested target view instead of following
      // the server's new default version.
      onOpenVersion(saveAsReturnVersionId ?? response.version.id);
      setSaveAsOpen(false);
      setVersionName("");
      setVersionKind("working");
      setSaveAsReturnVersionId(null);
      setVersionsOpen(false);
    });
  };

  const discardDraft = async (fallbackMessage: string, afterSuccess?: () => void) => {
    if (!activeVersionId) return;
    await runHeaderAction(fallbackMessage, async () => {
      await discardMutation.mutateAsync();
      setDraftRestorePrompt(null);
      setConfirmation(null);
      afterSuccess?.();
    });
  };

  const discard = async () => {
    await discardDraft("Could not discard draft.");
  };

  const toggleLock = async () => {
    if (!activeVersionId) return;
    if (isLocked) {
      setConfirmation({ kind: "unlock" });
      return;
    }
    await runHeaderAction("Could not update version lock.", async () => {
      await patchVersionMutation.mutateAsync({ versionId: activeVersionId, locked: !isLocked });
      await draftSummaryQuery.refetch();
    });
  };

  const openVersion = async (versionId: string) => {
    if (hasDraft && versionId !== activeVersionId) {
      setConfirmation({
        kind: "switch",
        target: {
          versionId,
          name: project.versions.find((version) => version.id === versionId)?.name ?? "version",
        },
      });
      return;
    }
    onOpenVersion(versionId);
    setVersionsOpen(false);
  };

  const saveAndOpenVersion = async (target: PendingSwitch) => {
    await saveDraft("Could not save draft before opening version.", () => {
      setConfirmation(null);
      setVersionsOpen(false);
      onOpenVersion(target.versionId);
    });
  };

  const discardAndOpenVersion = async (target: PendingSwitch) => {
    await discardDraft("Could not discard draft before opening version.", () => {
      setVersionsOpen(false);
      onOpenVersion(target.versionId);
    });
  };

  const unlockVersion = async () => {
    if (!activeVersionId) return;
    await runHeaderAction("Could not unlock version.", async () => {
      await patchVersionMutation.mutateAsync({ versionId: activeVersionId, locked: false });
      setConfirmation(null);
      await draftSummaryQuery.refetch();
    });
  };

  const openSaveAs = (returnVersionId: string | null = null) => {
    setSaveAsReturnVersionId(returnVersionId);
    setSaveAsOpen(true);
    setConfirmation(null);
  };

  const closeSaveAs = () => {
    setSaveAsOpen(false);
    setSaveAsReturnVersionId(null);
  };

  const keepRestoredDraft = () => {
    setDraftRestorePrompt(null);
  };

  const busy =
    draftSummaryQuery.isLoading ||
    saveMutation.isPending ||
    saveAsMutation.isPending ||
    discardMutation.isPending ||
    patchVersionMutation.isPending;

  return (
    <div className="version-control-wrap">
      <div className="shell-controls">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setVersionsOpen((value) => !value)}
        >
          {activeVersion?.name ?? "No version"}
          {isLocked ? " · Locked" : ""}
        </button>
        <span className={hasDraft ? "save-state dirty" : "save-state"}>
          {draftSummaryQuery.isLoading ? "Checking..." : hasDraft ? "Unsaved" : "Clean"}
        </span>
        {isLocked ? (
          <button type="button" onClick={() => openSaveAs()} disabled={!activeVersionId || busy}>
            Save As
          </button>
        ) : (
          <button type="button" onClick={save} disabled={!hasDraft || !draftSummary || busy}>
            Save
          </button>
        )}
        {!isLocked ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => openSaveAs()}
            disabled={!activeVersionId || busy}
          >
            Save As
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setConfirmation({ kind: "discard" })}
          disabled={!hasDraft || busy}
        >
          Discard
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={toggleLock}
          disabled={!activeVersionId || busy}
        >
          {isLocked ? "Unlock" : "Lock"}
        </button>
        {activeVersionId ? (
          <a
            className="secondary-button download-link"
            href={projectDownloadUrl(project.id, activeVersionId)}
          >
            Project JSON
          </a>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => setDiffOpen(true)}
          disabled={!activeVersionId}
        >
          Diff
        </button>
      </div>
      {actionError && !confirmation ? (
        <p className="inline-action-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {draftRestorePrompt ? (
        <ModalDialog
          title="Unsaved draft found"
          titleId="restore-draft-title"
          onClose={keepRestoredDraft}
        >
          <div className="confirmation-panel">
            <p>
              This version has a recovered server draft
              {draftRestorePrompt.lastPatchedAt
                ? ` from ${formatProjectDateTime(draftRestorePrompt.lastPatchedAt)}`
                : ""}
              . Keep it open or discard it and reload the saved version.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => void discard()}
                disabled={busy}
              >
                Discard draft
              </button>
              <button type="button" onClick={keepRestoredDraft} disabled={busy}>
                Restore draft
              </button>
            </div>
          </div>
        </ModalDialog>
      ) : null}
      {versionsOpen ? (
        <div className="version-popover">
          <div className="version-popover-header">
            <strong>Versions</strong>
            <button type="button" className="text-button" onClick={() => openSaveAs()}>
              + Save As...
            </button>
          </div>
          <div className="version-list">
            {project.versions.map((version) => (
              <div className="version-row" key={version.id}>
                <div>
                  <strong>{version.name}</strong>
                  <span>
                    {version.kind}
                    {version.locked ? " · Locked" : ""}
                    {version.id === defaultVersionId ? " · Default" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openVersion(version.id)}
                  disabled={version.id === activeVersionId || busy}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="text-button" onClick={() => setDiffOpen(true)}>
            Compare versions...
          </button>
        </div>
      ) : null}
      {saveAsOpen ? (
        <ModalDialog title="Save As" titleId="save-as-title" onClose={closeSaveAs}>
          <form
            className="project-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAs();
            }}
          >
            <label>
              Version name
              <input
                value={versionName}
                onChange={(event) => setVersionName(event.target.value)}
                placeholder="Round 1 Submit"
                required
              />
            </label>
            <label>
              Version kind
              <select
                value={versionKind}
                onChange={(event) => setVersionKind(event.target.value as typeof versionKind)}
              >
                {SAVE_AS_VERSION_KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={closeSaveAs}>
                Cancel
              </button>
              <button type="submit" disabled={busy || versionName.trim().length === 0}>
                Create version
              </button>
            </div>
          </form>
        </ModalDialog>
      ) : null}
      {confirmation ? (
        <DocumentConfirmationDialog
          confirmation={confirmation}
          isLocked={isLocked}
          busy={busy}
          actions={{
            onCancel: () => setConfirmation(null),
            onDiscard: () => void discard(),
            onUnlock: () => void unlockVersion(),
            onSaveAs: () => openSaveAs(),
            onSwitchSave: (target) => void saveAndOpenVersion(target),
            onSwitchSaveAs: (target) => openSaveAs(target.versionId),
            onSwitchDiscard: (target) => void discardAndOpenVersion(target),
          }}
        />
      ) : null}
      {diffOpen ? (
        <ModalDialog title="Diff" titleId="diff-title" onClose={() => setDiffOpen(false)}>
          <div className="diff-panel">
            <label className="diff-target-control">
              Compare current version to
              <select value={diffTarget} onChange={(event) => setDiffTarget(event.target.value)}>
                <option value={DRAFT_DIFF_TARGET}>Current draft</option>
                {project.versions
                  .filter((version) => version.id !== activeVersionId)
                  .map((version) => (
                    <option key={version.id} value={version.id}>
                      {version.name}
                    </option>
                  ))}
              </select>
            </label>
            {diffQuery.isLoading ? <p>Loading diff...</p> : null}
            {diffQuery.isError ? (
              <p className="form-error" role="alert">
                {errorMessage(diffQuery.error, "Could not load diff.")}
              </p>
            ) : null}
            {diffQuery.data?.tables.map((table) => (
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
      ) : null}
    </div>
  );
}

function draftLooksRecovered(lastPatchedAt: string | null): boolean {
  if (!lastPatchedAt) return true;
  // Draft writes can land before the summary refetch observes their ETag.
  // Treat very recent patches as active-session work, not crash recovery.
  return Date.now() - Date.parse(lastPatchedAt) > 5_000;
}

function DocumentConfirmationDialog({
  confirmation,
  isLocked,
  busy,
  actions,
}: {
  confirmation: ConfirmationDialog;
  isLocked: boolean;
  busy: boolean;
  actions: ConfirmationDialogActions;
}) {
  const { onCancel, onDiscard, onUnlock, onSaveAs, onSwitchSave, onSwitchSaveAs, onSwitchDiscard } =
    actions;

  if (confirmation.kind === "discard") {
    return (
      <ModalDialog title="Discard draft?" titleId="discard-draft-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>This deletes the server draft and reloads the saved version body.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={onDiscard} disabled={busy}>
              Discard draft
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "unlock") {
    return (
      <ModalDialog title="Unlock version?" titleId="unlock-version-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>Unlocking allows direct edits and Save on this version.</p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" onClick={onUnlock} disabled={busy}>
              Unlock version
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "switch") {
    const target = confirmation.target;
    return (
      <ModalDialog title="Unsaved draft" titleId="switch-version-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>Save or discard this draft before opening {target.name}.</p>
          <div className="modal-actions modal-actions-stack">
            <button
              type="button"
              onClick={() => onSwitchSave(target)}
              disabled={busy || isLocked}
              title={isLocked ? "Locked versions cannot be saved directly." : undefined}
            >
              Save then open
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onSwitchSaveAs(target)}
              disabled={busy}
            >
              Save As... then open
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => onSwitchDiscard(target)}
              disabled={busy}
            >
              Discard changes
            </button>
            <button type="button" className="secondary-button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  if (confirmation.kind === "stale-save") {
    return (
      <ModalDialog title="Saved version changed" titleId="stale-save-title" onClose={onCancel}>
        <div className="confirmation-panel">
          <p>
            The saved version changed while this draft was open. Save As preserves this draft in a
            new version, or discard it and reload the current saved body.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onCancel}>
              Keep draft
            </button>
            <button type="button" className="secondary-button" onClick={onDiscard} disabled={busy}>
              Discard draft
            </button>
            <button type="button" onClick={onSaveAs} disabled={busy}>
              Save As
            </button>
          </div>
        </div>
      </ModalDialog>
    );
  }

  return (
    <ModalDialog title="Version locked" titleId="locked-save-title" onClose={onCancel}>
      <div className="confirmation-panel">
        <p>This version was locked elsewhere. The draft is preserved; use Save As or discard it.</p>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Keep draft
          </button>
          <button type="button" className="secondary-button" onClick={onDiscard} disabled={busy}>
            Discard draft
          </button>
          <button type="button" onClick={onSaveAs} disabled={busy}>
            Save As
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
