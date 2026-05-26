import { useState } from "react";
import type {
  ConfirmationDialog,
  DraftRestorePrompt,
  SaveAsVersionKind,
} from "../types/versionControls";
import { DRAFT_DIFF_TARGET } from "../types/versionControls";

export function useVersionControlsState() {
  // State transitions:
  // clean menus toggle independently; outside click closes version/actions menus.
  // unsaved switch opens confirmation.switch; save/discard/save-as close it.
  // stale/locked save errors open confirmation.stale-save/locked-save and keep draft.
  // recovered draft prompt remains until keep/discard clears draftRestorePrompt.
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffTarget, setDiffTarget] = useState(DRAFT_DIFF_TARGET);
  const [versionName, setVersionName] = useState("");
  const [versionKind, setVersionKind] = useState<SaveAsVersionKind>("working");
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationDialog | null>(null);
  const [draftRestorePrompt, setDraftRestorePrompt] = useState<DraftRestorePrompt | null>(null);
  const [saveAsReturnVersionId, setSaveAsReturnVersionId] = useState<string | null>(null);

  const openSaveAs = (returnVersionId: string | null = null) => {
    setSaveAsReturnVersionId(returnVersionId);
    setSaveAsOpen(true);
    setActionsOpen(false);
    setConfirmation(null);
  };

  const closeSaveAs = () => {
    setSaveAsOpen(false);
    setSaveAsReturnVersionId(null);
  };

  const resetSaveAsForm = () => {
    setSaveAsOpen(false);
    setVersionName("");
    setVersionKind("working");
    setSaveAsReturnVersionId(null);
  };

  return {
    versionsOpen,
    setVersionsOpen,
    actionsOpen,
    setActionsOpen,
    saveAsOpen,
    diffOpen,
    setDiffOpen,
    diffTarget,
    setDiffTarget,
    versionName,
    setVersionName,
    versionKind,
    setVersionKind,
    actionError,
    setActionError,
    confirmation,
    setConfirmation,
    draftRestorePrompt,
    setDraftRestorePrompt,
    saveAsReturnVersionId,
    openSaveAs,
    closeSaveAs,
    resetSaveAsForm,
    keepRestoredDraft: () => setDraftRestorePrompt(null),
  };
}
