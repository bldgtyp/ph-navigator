import { useRef, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { usePatchVersionMutation } from "../../projects/hooks";
import type { ProjectDraftSummary } from "../types";
import { isVersionLockedError, isVersionStaleError } from "../lib";
import { useDiscardDraftMutation, useSaveDraftAsMutation, useSaveDraftMutation } from "../hooks";
import { LOCKED_SAVE_AS_KINDS } from "../types/versionControls";
import type {
  ConfirmationDialog,
  PendingSwitch,
  SaveAsVersionKind,
} from "../types/versionControls";
import { useDraftWriteCoordinator } from "../useDraftWriteCoordinator";
import { clearMountedDataTableHistories } from "../../../shared/ui/data-table/historyEvents";

export function useDraftLifecycle({
  projectId,
  activeVersionId,
  draftSummary,
  versionName,
  versionKind,
  saveAsReturnVersionId,
  setActionError,
  setConfirmation,
  setDraftRestorePrompt,
  resetSaveAsForm,
  setVersionsOpen,
  refetchDraftSummary,
  onOpenVersion,
}: {
  projectId: string;
  activeVersionId: string | null;
  draftSummary: ProjectDraftSummary | null;
  versionName: string;
  versionKind: SaveAsVersionKind;
  saveAsReturnVersionId: string | null;
  setActionError: (message: string | null) => void;
  setConfirmation: (confirmation: ConfirmationDialog | null) => void;
  setDraftRestorePrompt: (prompt: null) => void;
  resetSaveAsForm: () => void;
  setVersionsOpen: (open: boolean) => void;
  refetchDraftSummary: () => Promise<unknown>;
  onOpenVersion: (versionId: string) => void;
}) {
  const saveMutation = useSaveDraftMutation(projectId, activeVersionId);
  const saveAsMutation = useSaveDraftAsMutation(projectId, activeVersionId);
  const discardMutation = useDiscardDraftMutation(projectId, activeVersionId);
  const patchVersionMutation = usePatchVersionMutation(projectId);
  const { coordinator: writeCoordinator, status: writeStatus } = useDraftWriteCoordinator(
    projectId,
    activeVersionId,
  );
  const actionInProgressRef = useRef(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const beginAction = () => {
    if (actionInProgressRef.current) return false;
    actionInProgressRef.current = true;
    setActionInProgress(true);
    return true;
  };

  const endAction = () => {
    actionInProgressRef.current = false;
    setActionInProgress(false);
  };

  const flushWrites = async () => {
    await writeCoordinator?.flush();
  };

  const cancelWrites = async () => {
    writeCoordinator?.cancel();
    await writeCoordinator?.whenIdle();
  };

  const runHeaderAction = async (fallbackMessage: string, action: () => Promise<void>) => {
    if (!beginAction()) return;
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error, fallbackMessage));
    } finally {
      endAction();
    }
  };

  const handleDocumentActionError = async (error: unknown, fallbackMessage: string) => {
    if (isVersionLockedError(error)) {
      setActionError("This version was locked elsewhere. Save As to keep the draft.");
      setConfirmation({ kind: "locked-save" });
      await refetchDraftSummary();
      return;
    }
    if (isVersionStaleError(error)) {
      setActionError("The saved version changed while this draft was open.");
      setConfirmation({ kind: "stale-save" });
      await refetchDraftSummary();
      return;
    }
    setActionError(errorMessage(error, fallbackMessage));
  };

  const saveDraft = async (fallbackMessage: string, afterSuccess?: () => void) => {
    if (!draftSummary || !activeVersionId) return;
    if (!beginAction()) return;
    setActionError(null);
    try {
      await flushWrites();
      await saveMutation.mutateAsync({ versionEtag: draftSummary.version_etag });
      afterSuccess?.();
    } catch (error) {
      await handleDocumentActionError(error, fallbackMessage);
    } finally {
      endAction();
    }
  };

  const save = async () => {
    await saveDraft("Could not save draft.");
  };

  const saveAs = async () => {
    if (!activeVersionId) return;
    await runHeaderAction("Could not save as a new version.", async () => {
      await flushWrites();
      const response = await saveAsMutation.mutateAsync({
        name: versionName,
        kind: versionKind,
        locked: LOCKED_SAVE_AS_KINDS.has(versionKind),
      });
      // Switch-flow Save As preserves the requested target view instead of following
      // the server's new default version.
      onOpenVersion(saveAsReturnVersionId ?? response.version.id);
      resetSaveAsForm();
      setVersionsOpen(false);
    });
  };

  const discardDraft = async (fallbackMessage: string, afterSuccess?: () => void) => {
    if (!activeVersionId) return;
    await runHeaderAction(fallbackMessage, async () => {
      await cancelWrites();
      clearMountedDataTableHistories({ projectId, versionId: activeVersionId });
      await discardMutation.mutateAsync();
      setDraftRestorePrompt(null);
      setConfirmation(null);
      afterSuccess?.();
    });
  };

  const discard = async () => {
    await discardDraft("Could not discard draft.");
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
      await refetchDraftSummary();
    });
  };

  const lockVersion = async () => {
    if (!activeVersionId) return;
    await runHeaderAction("Could not update version lock.", async () => {
      await patchVersionMutation.mutateAsync({ versionId: activeVersionId, locked: true });
      await refetchDraftSummary();
    });
  };

  return {
    busy:
      saveMutation.isPending ||
      saveAsMutation.isPending ||
      discardMutation.isPending ||
      patchVersionMutation.isPending ||
      actionInProgress,
    savingVersion: saveMutation.isPending,
    writesPending: writeStatus.inFlight || writeStatus.queued > 0,
    save,
    saveAs,
    discard,
    saveAndOpenVersion,
    discardAndOpenVersion,
    unlockVersion,
    lockVersion,
  };
}
