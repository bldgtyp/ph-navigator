import type { ProjectVersion } from "../../projects/types";
import { projectDownloadUrl } from "../api";

const VERSION_TRIGGER_HELP = "Open the version list to switch or compare versions.";
const CLEAN_STATE_HELP = "No unsaved draft changes.";
const DIRTY_STATE_HELP = "Draft changes are pending.";
const CHECKING_STATE_HELP = "Checking whether this version has pending draft changes.";
const SAVE_HELP = "Save this draft into the active unlocked version.";
const SAVE_AS_HELP = "Create a new version from the current draft, then switch to it.";
const PROJECT_ACTIONS_HELP = "Open project and version actions.";

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
        aria-description={VERSION_TRIGGER_HELP}
        data-tooltip={VERSION_TRIGGER_HELP}
      >
        <span className="version-trigger-label">
          {activeVersionName}
          {isLocked ? " · Locked" : ""}
        </span>
      </button>
      <span
        className={hasDraft ? "save-state dirty" : "save-state"}
        data-tooltip={
          checkingDraft ? CHECKING_STATE_HELP : hasDraft ? DIRTY_STATE_HELP : CLEAN_STATE_HELP
        }
        aria-description={
          checkingDraft ? CHECKING_STATE_HELP : hasDraft ? DIRTY_STATE_HELP : CLEAN_STATE_HELP
        }
      >
        {checkingDraft ? "Checking..." : hasDraft ? "Unsaved" : "Clean"}
      </span>
      {isLocked ? (
        <button
          type="button"
          onClick={onSaveAs}
          disabled={!canSaveAs || busy}
          aria-description={SAVE_AS_HELP}
          data-tooltip={SAVE_AS_HELP}
        >
          Save As
        </button>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || busy}
          aria-description={SAVE_HELP}
          data-tooltip={SAVE_HELP}
        >
          Save
        </button>
      )}
      <button
        type="button"
        className="secondary-button icon-button project-actions-trigger"
        onClick={onToggleActions}
        aria-label="Project actions"
        aria-expanded={actionsOpen}
        aria-description={PROJECT_ACTIONS_HELP}
        data-tooltip={PROJECT_ACTIONS_HELP}
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
          aria-description="Open project-level metadata, access, and MCP token settings."
          data-tooltip="Open project-level metadata, access, and MCP token settings."
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
          aria-description={SAVE_AS_HELP}
          data-tooltip={SAVE_AS_HELP}
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
        aria-description="Drop the current draft and reload the saved version body."
        data-tooltip="Drop the current draft and reload the saved version body."
        onClick={onDiscard}
        disabled={!hasDraft || busy}
      >
        Discard changes
      </button>
      <button
        type="button"
        className="menu-action"
        role="menuitem"
        aria-description={
          isLocked
            ? "Allow this version to be edited and saved again."
            : "Freeze this version so future edits must use Save As."
        }
        data-tooltip={
          isLocked
            ? "Allow this version to be edited and saved again."
            : "Freeze this version so future edits must use Save As."
        }
        onClick={onToggleLock}
        disabled={!activeVersionId || busy}
      >
        {isLocked ? "Unlock version" : "Lock version"}
      </button>
      <button
        type="button"
        className="menu-action"
        role="menuitem"
        aria-description="Compare the current draft or version against another saved version."
        data-tooltip="Compare the current draft or version against another saved version."
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
          aria-description="Download the raw saved project document JSON for this version."
          data-tooltip="Download the raw saved project document JSON for this version."
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
