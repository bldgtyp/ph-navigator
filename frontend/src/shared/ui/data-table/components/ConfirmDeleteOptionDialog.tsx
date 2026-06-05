import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useEffect, useMemo, useState } from "react";
import { AutocompleteSelect } from "../../AutocompleteSelect";
import type { FieldOption } from "../types";

export type CascadeChoice = { kind: "clear" } | { kind: "replace"; replacementId: string };

const CLEAR_VALUE = "__clear";

export type ConfirmDeleteOptionDialogProps = {
  open: boolean;
  option: FieldOption | null;
  referenceCount: number;
  required: boolean;
  fieldDisplayName: string;
  replacementOptions: FieldOption[];
  allowReplacement?: boolean;
  onCancel: () => void;
  onConfirm: (choice: CascadeChoice) => void;
};

export function ConfirmDeleteOptionDialog({
  open,
  option,
  referenceCount,
  required,
  fieldDisplayName,
  replacementOptions,
  allowReplacement = true,
  onCancel,
  onConfirm,
}: ConfirmDeleteOptionDialogProps) {
  // Required fields can't be cleared — Clear is disabled and a
  // replacement must be picked.
  const mustReplace = required && referenceCount > 0;
  const defaultReplacement = useMemo(
    () => (mustReplace ? (replacementOptions[0]?.id ?? "") : ""),
    [mustReplace, replacementOptions],
  );
  const [selectionKind, setSelectionKind] = useState<"clear" | "replace">(
    mustReplace ? "replace" : "clear",
  );
  const [replacementId, setReplacementId] = useState<string>(defaultReplacement);

  useEffect(() => {
    if (!open) return;
    setSelectionKind(mustReplace ? "replace" : "clear");
    setReplacementId(mustReplace ? (replacementOptions[0]?.id ?? "") : "");
  }, [mustReplace, open, replacementOptions]);

  const canConfirm = selectionKind === "clear" ? !mustReplace : replacementId.length > 0;

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="data-table-alert-overlay" />
        <AlertDialog.Content className="data-table-alert-content">
          <AlertDialog.Title className="data-table-alert-title">
            Delete option {option ? `"${option.label}"` : ""}?
          </AlertDialog.Title>
          <AlertDialog.Description className="data-table-alert-description">
            {referenceCount === 0
              ? "No rows reference this option."
              : `${referenceCount} row${referenceCount === 1 ? "" : "s"} currently reference this option. Choose how to handle them.`}
          </AlertDialog.Description>
          {referenceCount > 0 ? (
            <div className="data-table-field-editor-cascade">
              <label className="data-table-field-editor-cascade-row">
                <input
                  type="radio"
                  name="cascade-mode"
                  value={CLEAR_VALUE}
                  checked={selectionKind === "clear"}
                  disabled={mustReplace}
                  onChange={() => setSelectionKind("clear")}
                />
                <span>
                  Clear referenced cells
                  <span className="data-table-field-editor-cascade-hint">
                    Set the field to empty on the {referenceCount} row
                    {referenceCount === 1 ? "" : "s"}.
                  </span>
                </span>
              </label>
              {mustReplace ? (
                <p className="form-error data-table-field-editor-error">
                  {fieldDisplayName} is required — pick a replacement option.
                </p>
              ) : null}
              {allowReplacement ? (
                <label className="data-table-field-editor-cascade-row">
                  <input
                    type="radio"
                    name="cascade-mode"
                    value="replace"
                    checked={selectionKind === "replace"}
                    onChange={() => setSelectionKind("replace")}
                  />
                  <span className="data-table-field-editor-cascade-replace">
                    Replace with:
                    <AutocompleteSelect
                      aria-label="Replacement option"
                      value={replacementId}
                      disabled={replacementOptions.length === 0}
                      compact
                      options={[
                        { value: "", label: "Pick an option..." },
                        ...replacementOptions.map((candidate) => ({
                          value: candidate.id,
                          label: candidate.label,
                          color: candidate.color,
                        })),
                      ]}
                      onChange={(nextReplacementId) => {
                        setSelectionKind("replace");
                        setReplacementId(nextReplacementId);
                      }}
                    />
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="data-table-alert-actions">
            <AlertDialog.Cancel asChild>
              <button type="button" className="secondary-button" onClick={onCancel}>
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className="danger-button"
                disabled={referenceCount > 0 && !canConfirm}
                onClick={() => {
                  if (referenceCount === 0) {
                    onConfirm({ kind: "clear" });
                    return;
                  }
                  if (selectionKind === "clear") {
                    onConfirm({ kind: "clear" });
                  } else {
                    onConfirm({ kind: "replace", replacementId });
                  }
                }}
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
