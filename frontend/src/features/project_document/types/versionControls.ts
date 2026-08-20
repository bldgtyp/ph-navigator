export const DRAFT_DIFF_TARGET = "draft";

export type SaveAsVersionKind = "working" | "submitted" | "closed";

export const VERSION_KIND_LABELS = {
  working: "Working",
  submitted: "Submitted",
  closed: "Closed",
  snapshot: "Snapshot",
} as const;

export const SAVE_AS_VERSION_KINDS: Array<{ value: SaveAsVersionKind; label: string }> = (
  ["working", "submitted", "closed"] as const
).map((value) => ({ value, label: VERSION_KIND_LABELS[value] }));

export const LOCKED_SAVE_AS_KINDS = new Set<SaveAsVersionKind>(["submitted", "closed"]);

export type PendingSwitch = { versionId: string; name: string };

export type ConfirmationDialog =
  | { kind: "discard" }
  | { kind: "unlock" }
  | { kind: "switch"; target: PendingSwitch }
  | { kind: "stale-save" }
  | { kind: "locked-save" };

export type DraftRestorePrompt = {
  lastPatchedAt: string | null;
};

export type ConfirmationDialogActions = {
  onCancel: () => void;
  onDiscard: () => void;
  onUnlock: () => void;
  onSaveAs: () => void;
  onSwitchSave: (target: PendingSwitch) => void;
  onSwitchSaveAs: (target: PendingSwitch) => void;
  onSwitchDiscard: (target: PendingSwitch) => void;
};
