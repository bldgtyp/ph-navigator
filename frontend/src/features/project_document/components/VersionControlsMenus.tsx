import type { ProjectVersion } from "../../projects/types";
import { projectDownloadUrl } from "../api";

export function VersionShellControls({
  activeVersionName,
  isLocked,
  hasDraft,
  checkingDraft,
  canSave,
  canSaveAs,
  busy,
  versionsOpen,
  actionsOpen,
  onToggleVersions,
  onToggleActions,
  onSave,
  onSaveAs,
}: {
  activeVersionName: string;
  isLocked: boolean;
  hasDraft: boolean;
  checkingDraft: boolean;
  canSave: boolean;
  canSaveAs: boolean;
  busy: boolean;
  versionsOpen: boolean;
  actionsOpen: boolean;
  onToggleVersions: () => void;
  onToggleActions: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}) {
  return (
    <div className="shell-controls">
      <button
        type="button"
        className="secondary-button version-trigger"
        onClick={onToggleVersions}
        aria-expanded={versionsOpen}
      >
        {activeVersionName}
        {isLocked ? " · Locked" : ""}
      </button>
      <span
        className={hasDraft ? "save-state dirty" : "save-state"}
        title={
          checkingDraft
            ? "Checking draft state"
            : hasDraft
              ? "Unsaved draft changes"
              : "Saved version is clean"
        }
      >
        {checkingDraft ? "Checking..." : hasDraft ? "Unsaved" : "Clean"}
      </span>
      {isLocked ? (
        <button type="button" onClick={onSaveAs} disabled={!canSaveAs || busy}>
          Save As
        </button>
      ) : (
        <button type="button" onClick={onSave} disabled={!canSave || busy}>
          Save
        </button>
      )}
      <button
        type="button"
        className="secondary-button icon-button project-actions-trigger"
        onClick={onToggleActions}
        aria-label="Project actions"
        aria-expanded={actionsOpen}
        title="Project actions"
      >
        <span className="project-actions-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
    </div>
  );
}

export function ProjectActionsMenu({
  projectId,
  activeVersionId,
  isLocked,
  hasDraft,
  busy,
  onOpenProjectSettings,
  onSaveAs,
  onDiscard,
  onToggleLock,
  onOpenDiff,
  onClose,
}: {
  projectId: string;
  activeVersionId: string | null;
  isLocked: boolean;
  hasDraft: boolean;
  busy: boolean;
  onOpenProjectSettings?: () => void;
  onSaveAs: () => void;
  onDiscard: () => void;
  onToggleLock: () => void;
  onOpenDiff: () => void;
  onClose: () => void;
}) {
  return (
    <div className="project-actions-menu" role="menu" aria-label="Project actions">
      {onOpenProjectSettings ? (
        <button
          type="button"
          className="menu-action"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenProjectSettings();
          }}
        >
          Project settings
        </button>
      ) : null}
      {!isLocked ? (
        <button
          type="button"
          className="menu-action"
          role="menuitem"
          onClick={onSaveAs}
          disabled={!activeVersionId || busy}
        >
          Save As
        </button>
      ) : null}
      <button
        type="button"
        className="menu-action"
        role="menuitem"
        onClick={onDiscard}
        disabled={!hasDraft || busy}
      >
        Discard changes
      </button>
      <button
        type="button"
        className="menu-action"
        role="menuitem"
        onClick={onToggleLock}
        disabled={!activeVersionId || busy}
      >
        {isLocked ? "Unlock version" : "Lock version"}
      </button>
      <button
        type="button"
        className="menu-action"
        role="menuitem"
        onClick={onOpenDiff}
        disabled={!activeVersionId}
      >
        Diff
      </button>
      {activeVersionId ? (
        <a
          className="menu-action download-link"
          role="menuitem"
          href={projectDownloadUrl(projectId, activeVersionId)}
          onClick={onClose}
        >
          Project JSON
        </a>
      ) : null}
    </div>
  );
}

export function VersionPopover({
  versions,
  activeVersionId,
  defaultVersionId,
  busy,
  onSaveAs,
  onOpenVersion,
  onOpenDiff,
}: {
  versions: ProjectVersion[];
  activeVersionId: string | null;
  defaultVersionId: string | null;
  busy: boolean;
  onSaveAs: () => void;
  onOpenVersion: (versionId: string) => void;
  onOpenDiff: () => void;
}) {
  return (
    <div className="version-popover">
      <div className="version-popover-header">
        <strong>Versions</strong>
        <button type="button" className="text-button" onClick={onSaveAs}>
          + Save As...
        </button>
      </div>
      <div className="version-list">
        {versions.map((version) => (
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
              onClick={() => onOpenVersion(version.id)}
              disabled={version.id === activeVersionId || busy}
            >
              Open
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="text-button" onClick={onOpenDiff}>
        Compare versions...
      </button>
    </div>
  );
}
