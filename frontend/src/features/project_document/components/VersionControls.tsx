import "../version-controls.css";
import { useEffect, useRef, type ReactNode } from "react";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import type { ProjectDetail } from "../../projects/types";
import { projectDownloadUrl } from "../api";
import { useDiffQuery, useDraftSummaryQuery } from "../hooks";
import { draftLooksRecovered, isReadSafeProjectDocument, wasLocalDraftTouched } from "../lib";
import { useDraftLifecycle } from "../hooks/useDraftLifecycle";
import { useVersionControlsState } from "../hooks/useVersionControlsState";
import { DRAFT_DIFF_TARGET } from "../types/versionControls";
import { DocumentConfirmationDialog } from "./DocumentConfirmationDialog";
import { DiffDialog, DraftRestoreDialog, SaveAsDialog } from "./VersionControlsDialogs";
import {
  ProjectActionsMenu,
  VersionPathControls,
  VersionPopover,
  VersionShellControls,
} from "./VersionControlsMenus";

type VersionControlsRenderProps = {
  pathControls: ReactNode;
  documentControls: ReactNode;
};

export function VersionControls({
  project,
  defaultVersionId,
  onOpenVersion,
  onOpenProjectSettings,
  children,
}: {
  project: ProjectDetail;
  defaultVersionId: string | null;
  onOpenVersion: (versionId: string) => void;
  onOpenProjectSettings?: () => void;
  children?: (controls: VersionControlsRenderProps) => ReactNode;
}) {
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const initializedDraftKeysRef = useRef(new Set<string>());
  const state = useVersionControlsState();
  const { setDraftRestorePrompt } = state;
  const activeVersion = project.active_version;
  const activeVersionId = activeVersion?.id ?? null;
  const isEditor = project.access_mode === "editor";
  const draftSummaryQuery = useDraftSummaryQuery(project.id, activeVersionId, isEditor);
  const draftStatus = draftSummaryQuery.data;
  const draftSummary = draftStatus && !isReadSafeProjectDocument(draftStatus) ? draftStatus : null;
  const isLocked = draftSummary?.is_locked ?? activeVersion?.locked ?? false;
  const hasDraft = draftSummary?.source === "draft";
  const diffQuery = useDiffQuery(
    project.id,
    activeVersionId,
    state.diffTarget,
    state.diffOpen && Boolean(activeVersionId),
  );
  const lifecycle = useDraftLifecycle({
    projectId: project.id,
    activeVersionId,
    draftSummary,
    versionName: state.versionName,
    versionKind: state.versionKind,
    saveAsReturnVersionId: state.saveAsReturnVersionId,
    setActionError: state.setActionError,
    setConfirmation: state.setConfirmation,
    setDraftRestorePrompt: state.setDraftRestorePrompt,
    resetSaveAsForm: state.resetSaveAsForm,
    setVersionsOpen: state.setVersionsOpen,
    refetchDraftSummary: () => draftSummaryQuery.refetch(),
    onOpenVersion,
  });
  const busy = draftSummaryQuery.isLoading || lifecycle.busy;

  useOutsidePointerDown(controlsRef, state.versionsOpen || state.actionsOpen, () => {
    state.setVersionsOpen(false);
    state.setActionsOpen(false);
  });

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
      setDraftRestorePrompt({ lastPatchedAt: draftSummary.last_patched_at });
    }
  }, [
    activeVersionId,
    draftSummary,
    draftSummaryQuery.isLoading,
    project.id,
    setDraftRestorePrompt,
  ]);

  if (!isEditor) {
    const documentControls = (
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
    return <>{children ? children({ pathControls: null, documentControls }) : documentControls}</>;
  }

  const toggleLock = async () => {
    state.setActionsOpen(false);
    if (isLocked) {
      state.setConfirmation({ kind: "unlock" });
      return;
    }
    await lifecycle.lockVersion();
  };

  const openVersion = (versionId: string) => {
    if (hasDraft && versionId !== activeVersionId) {
      state.setConfirmation({
        kind: "switch",
        target: {
          versionId,
          name: project.versions.find((version) => version.id === versionId)?.name ?? "version",
        },
      });
      return;
    }
    onOpenVersion(versionId);
    state.setVersionsOpen(false);
  };

  const pathControls = (
    <div className="version-path-control" ref={controlsRef}>
      <VersionPathControls
        activeVersionName={activeVersion?.name ?? "No version"}
        isLocked={isLocked}
        actionsOpen={state.actionsOpen}
        onToggleActions={() => {
          state.setActionsOpen((value) => !value);
          state.setVersionsOpen(false);
        }}
      />
      {state.actionsOpen ? (
        <ProjectActionsMenu
          projectId={project.id}
          activeVersionId={activeVersionId}
          isLocked={isLocked}
          hasDraft={hasDraft}
          busy={busy}
          onOpenProjectSettings={onOpenProjectSettings}
          onOpenVersions={() => {
            state.setActionsOpen(false);
            state.setVersionsOpen(true);
          }}
          onSave={() => void lifecycle.save()}
          onSaveAs={() => state.openSaveAs()}
          onDiscard={() => {
            state.setActionsOpen(false);
            state.setConfirmation({ kind: "discard" });
          }}
          onToggleLock={() => void toggleLock()}
          onOpenDiff={() => {
            state.setActionsOpen(false);
            state.setDiffOpen(true);
          }}
          onClose={() => state.setActionsOpen(false)}
        />
      ) : null}
      {state.versionsOpen ? (
        <VersionPopover
          versions={project.versions}
          activeVersionId={activeVersionId}
          defaultVersionId={defaultVersionId}
          busy={busy}
          onSaveAs={() => state.openSaveAs()}
          onOpenVersion={openVersion}
          onOpenDiff={() => state.setDiffOpen(true)}
        />
      ) : null}
    </div>
  );

  const documentControls = hasDraft ? (
    <div className="version-control-wrap">
      <VersionShellControls
        isLocked={isLocked}
        canSave={Boolean(draftSummary)}
        canSaveAs={Boolean(activeVersionId)}
        busy={busy}
        onSave={() => void lifecycle.save()}
        onSaveAs={() => state.openSaveAs()}
      />
    </div>
  ) : null;

  return (
    <>
      {children ? (
        children({ pathControls, documentControls })
      ) : (
        <div className="version-control-fallback">
          {pathControls}
          {documentControls}
        </div>
      )}
      {state.actionError && !state.confirmation ? (
        <p className="inline-action-error" role="alert">
          {state.actionError}
        </p>
      ) : null}
      {state.draftRestorePrompt ? (
        <DraftRestoreDialog
          prompt={state.draftRestorePrompt}
          busy={busy}
          onDiscard={() => void lifecycle.discard()}
          onKeep={state.keepRestoredDraft}
        />
      ) : null}
      {state.saveAsOpen ? (
        <SaveAsDialog
          versionName={state.versionName}
          versionKind={state.versionKind}
          busy={busy}
          onNameChange={state.setVersionName}
          onKindChange={state.setVersionKind}
          onClose={state.closeSaveAs}
          onSubmit={() => void lifecycle.saveAs()}
        />
      ) : null}
      {state.confirmation ? (
        <DocumentConfirmationDialog
          confirmation={state.confirmation}
          isLocked={isLocked}
          busy={busy}
          actions={{
            onCancel: () => state.setConfirmation(null),
            onDiscard: () => void lifecycle.discard(),
            onUnlock: () => void lifecycle.unlockVersion(),
            onSaveAs: () => state.openSaveAs(),
            onSwitchSave: (target) => void lifecycle.saveAndOpenVersion(target),
            onSwitchSaveAs: (target) => state.openSaveAs(target.versionId),
            onSwitchDiscard: (target) => void lifecycle.discardAndOpenVersion(target),
          }}
        />
      ) : null}
      {state.diffOpen ? (
        <DiffDialog
          activeVersionId={activeVersionId}
          versions={project.versions}
          diffTarget={state.diffTarget}
          diffData={diffQuery.data}
          isLoading={diffQuery.isLoading}
          error={diffQuery.isError ? diffQuery.error : null}
          onTargetChange={state.setDiffTarget}
          onClose={() => {
            state.setDiffTarget(DRAFT_DIFF_TARGET);
            state.setDiffOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
