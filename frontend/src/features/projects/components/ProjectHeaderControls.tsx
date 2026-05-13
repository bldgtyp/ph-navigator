import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useRoomsSliceQuery } from "../../equipment/hooks";
import { projectDownloadUrl, tableDownloadUrl } from "../api";
import {
  useDiffQuery,
  useDiscardDraftMutation,
  usePatchVersionMutation,
  useSaveDraftAsMutation,
  useSaveDraftMutation,
} from "../hooks";
import type { ProjectDetail } from "../types";

const DRAFT_DIFF_TARGET = "draft";
const ROOMS_TABLE_NAME = "rooms";
type SaveAsVersionKind = "working" | "submitted" | "closed";

const SAVE_AS_VERSION_KINDS: Array<{ value: SaveAsVersionKind; label: string }> = [
  { value: "working", label: "Working" },
  { value: "submitted", label: "Submitted" },
  { value: "closed", label: "Closed" },
];
const LOCKED_SAVE_AS_KINDS = new Set<SaveAsVersionKind>(["submitted", "closed"]);

export function ProjectHeaderControls({
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
  const activeVersion = project.active_version;
  const activeVersionId = activeVersion?.id ?? null;
  const isEditor = project.access_mode === "editor";
  const roomsQuery = useRoomsSliceQuery(project.id, activeVersionId, project.access_mode, isEditor);
  const roomsSlice = roomsQuery.data;
  const hasDraft = roomsSlice?.source === "draft";
  const isLocked = activeVersion?.locked ?? false;
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

  if (project.access_mode === "viewer") {
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

  const save = async () => {
    if (!roomsSlice || !activeVersionId) return;
    await runHeaderAction("Could not save draft.", async () => {
      await saveMutation.mutateAsync({ versionEtag: roomsSlice.version_etag });
    });
  };

  const saveAs = async () => {
    if (!activeVersionId) return;
    await runHeaderAction("Could not save as a new version.", async () => {
      const response = await saveAsMutation.mutateAsync({
        name: versionName,
        kind: versionKind,
        locked: LOCKED_SAVE_AS_KINDS.has(versionKind),
      });
      onOpenVersion(response.version.id);
      setSaveAsOpen(false);
      setVersionName("");
      setVersionKind("working");
      setVersionsOpen(false);
    });
  };

  const discard = async () => {
    if (!activeVersionId || !window.confirm("Discard the current Rooms draft?")) return;
    await runHeaderAction("Could not discard draft.", async () => {
      await discardMutation.mutateAsync();
    });
  };

  const toggleLock = async () => {
    if (!activeVersionId) return;
    if (isLocked && !window.confirm("Unlock this version and allow edits?")) return;
    await runHeaderAction("Could not update version lock.", async () => {
      await patchVersionMutation.mutateAsync({ versionId: activeVersionId, locked: !isLocked });
    });
  };

  const openVersion = async (versionId: string) => {
    if (hasDraft && versionId !== activeVersionId) {
      const confirmed = window.confirm(
        "You have an unsaved draft on this version. Switch views and leave that draft unsaved?",
      );
      if (!confirmed) return;
    }
    onOpenVersion(versionId);
    setVersionsOpen(false);
  };

  const busy =
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
          {hasDraft ? "Unsaved" : "Clean"}
        </span>
        {isLocked ? (
          <button
            type="button"
            onClick={() => setSaveAsOpen(true)}
            disabled={!activeVersionId || busy}
          >
            Save As
          </button>
        ) : (
          <button type="button" onClick={save} disabled={!hasDraft || !roomsSlice || busy}>
            Save
          </button>
        )}
        {!isLocked ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setSaveAsOpen(true)}
            disabled={!activeVersionId || busy}
          >
            Save As
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={discard}
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
          <>
            <a
              className="secondary-button download-link"
              href={projectDownloadUrl(project.id, activeVersionId)}
            >
              Project JSON
            </a>
            <a
              className="secondary-button download-link"
              href={tableDownloadUrl(project.id, activeVersionId, ROOMS_TABLE_NAME)}
            >
              Rooms JSON
            </a>
          </>
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
      {actionError ? (
        <p className="inline-action-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {versionsOpen ? (
        <div className="version-popover">
          <div className="version-popover-header">
            <strong>Versions</strong>
            <button type="button" className="text-button" onClick={() => setSaveAsOpen(true)}>
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
        <ModalDialog title="Save As" titleId="save-as-title" onClose={() => setSaveAsOpen(false)}>
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
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSaveAsOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy || versionName.trim().length === 0}>
                Create version
              </button>
            </div>
          </form>
        </ModalDialog>
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
