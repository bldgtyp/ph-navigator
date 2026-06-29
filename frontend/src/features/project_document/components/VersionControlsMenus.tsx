import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "../../../shared/ui";
import type { ProjectVersion } from "../../projects/types";
import { projectDownloadUrl } from "../api";

const VERSION_TRIGGER_HELP = "Open the version list to switch or compare versions.";
const DIRTY_STATE_HELP =
  "Your edits are auto-saved as a draft on the server. Use Save Version to write them into the active version as a permanent snapshot.";
const SAVE_HELP =
  "Write the current draft into the active unlocked version as a permanent snapshot.";
const SAVE_AS_HELP = "Create a new version from the current draft, then switch to it.";
const PROJECT_ACTIONS_HELP = "Open project and version actions.";
const PROJECT_SETTINGS_HELP = "Open project-level metadata, access, and MCP token settings.";
const DISCARD_HELP = "Drop the current draft and reload the saved version body.";
const DIFF_HELP = "Compare the current draft or version against another saved version.";
const PROJECT_JSON_HELP = "Download the raw saved project document JSON for this version.";
const UNLOCK_HELP = "Allow this version to be edited and saved again.";
const LOCK_HELP = "Freeze this version so future edits must use Save As.";

export function VersionPathControls({
  activeVersionName,
  isLocked,
  actionsOpen,
  onToggleActions,
}: {
  activeVersionName: string;
  isLocked: boolean;
  actionsOpen: boolean;
  onToggleActions: () => void;
}) {
  const label = `${activeVersionName}${isLocked ? " · Locked" : ""}`;
  return (
    <div className="version-path-inline">
      <span className="version-path-label">{label}</span>
      <Tooltip content={PROJECT_ACTIONS_HELP} placement="bottom">
        <button
          type="button"
          className="version-path-trigger"
          onClick={onToggleActions}
          aria-label={`Version actions for ${label}`}
          aria-expanded={actionsOpen}
          aria-description={PROJECT_ACTIONS_HELP}
        >
          <ChevronDown aria-hidden="true" size={12} strokeWidth={1.9} />
        </button>
      </Tooltip>
    </div>
  );
}

export function VersionShellControls({
  isLocked,
  canSave,
  canSaveAs,
  busy,
  onSave,
  onSaveAs,
}: {
  isLocked: boolean;
  canSave: boolean;
  canSaveAs: boolean;
  busy: boolean;
  onSave: () => void;
  onSaveAs: () => void;
}) {
  return (
    <div className="shell-controls">
      <Tooltip content={DIRTY_STATE_HELP} placement="bottom">
        <span className="save-state dirty" aria-description={DIRTY_STATE_HELP} tabIndex={0}>
          <span className="save-state-dot" aria-hidden="true" />
          Uncommitted changes
        </span>
      </Tooltip>
      {isLocked ? (
        <Tooltip content={SAVE_AS_HELP} placement="bottom">
          <button
            type="button"
            onClick={onSaveAs}
            disabled={!canSaveAs || busy}
            aria-description={SAVE_AS_HELP}
          >
            {busy ? "Saving..." : "Save As"}
          </button>
        </Tooltip>
      ) : (
        <Tooltip content={SAVE_HELP} placement="bottom">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || busy}
            aria-description={SAVE_HELP}
          >
            {busy ? "Saving..." : "Save Version"}
          </button>
        </Tooltip>
      )}
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
  onOpenVersions,
  onSave,
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
  onOpenVersions: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onDiscard: () => void;
  onToggleLock: () => void;
  onOpenDiff: () => void;
  onClose: () => void;
}) {
  const lockHelp = isLocked ? UNLOCK_HELP : LOCK_HELP;
  return (
    <div className="project-actions-menu" role="menu" aria-label="Project actions">
      {onOpenProjectSettings ? (
        <MenuActionButton
          help={PROJECT_SETTINGS_HELP}
          onClick={() => {
            onClose();
            onOpenProjectSettings();
          }}
        >
          Project settings
        </MenuActionButton>
      ) : null}
      <MenuActionButton
        help={VERSION_TRIGGER_HELP}
        onClick={onOpenVersions}
        disabled={!activeVersionId || busy}
      >
        Open version...
      </MenuActionButton>
      <MenuActionButton
        help={SAVE_HELP}
        onClick={() => {
          onClose();
          onSave();
        }}
        disabled={isLocked || !hasDraft || busy}
      >
        Save Version
      </MenuActionButton>
      {!isLocked ? (
        <MenuActionButton
          help={SAVE_AS_HELP}
          onClick={onSaveAs}
          disabled={!activeVersionId || busy}
        >
          Save As
        </MenuActionButton>
      ) : null}
      <MenuActionButton help={DISCARD_HELP} onClick={onDiscard} disabled={!hasDraft || busy}>
        Discard changes
      </MenuActionButton>
      <MenuActionButton help={lockHelp} onClick={onToggleLock} disabled={!activeVersionId || busy}>
        {isLocked ? "Unlock version" : "Lock version"}
      </MenuActionButton>
      <MenuActionButton help={DIFF_HELP} onClick={onOpenDiff} disabled={!activeVersionId}>
        Diff
      </MenuActionButton>
      {activeVersionId ? (
        <MenuActionLink
          help={PROJECT_JSON_HELP}
          href={projectDownloadUrl(projectId, activeVersionId)}
          onClick={onClose}
        >
          Project JSON
        </MenuActionLink>
      ) : null}
    </div>
  );
}

function MenuActionButton({
  children,
  disabled,
  help,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  help: string;
  onClick: () => void;
}) {
  return (
    <Tooltip content={help} placement="left">
      <button
        type="button"
        className="menu-action"
        role="menuitem"
        aria-description={help}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function MenuActionLink({
  children,
  help,
  href,
  onClick,
}: {
  children: ReactNode;
  help: string;
  href: string;
  onClick: () => void;
}) {
  return (
    <Tooltip content={help} placement="left">
      <a
        className="menu-action download-link"
        role="menuitem"
        href={href}
        aria-description={help}
        onClick={onClick}
      >
        {children}
      </a>
    </Tooltip>
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
