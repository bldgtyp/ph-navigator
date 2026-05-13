import { useMemo, useState } from "react";
import { hasDuplicateFieldOptionLabels } from "../../../shared/ui/data-table/lib";
import { missingOptionReferences, normalizeOptionOrders, optionReferenceCounts } from "../lib";
import type { RoomOptionKey, RoomRow, SingleSelectOption } from "../types";

const CLEAR_REPLACEMENT_ID = "__clear";

export function RoomOptionManager({
  fieldKey,
  label,
  options,
  required,
  rooms,
  disabled,
  onSave,
}: {
  fieldKey: RoomOptionKey;
  label: string;
  options: SingleSelectOption[];
  required?: boolean;
  rooms: RoomRow[];
  disabled: boolean;
  onSave: (
    fieldKey: RoomOptionKey,
    options: SingleSelectOption[],
    replacements?: Record<string, string | null>,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftOptions, setDraftOptions] = useState(() => normalizeOptionOrders(options));
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [replacementId, setReplacementId] = useState<string>(CLEAR_REPLACEMENT_ID);
  const referenceCounts = useMemo(() => optionReferenceCounts(rooms, fieldKey), [fieldKey, rooms]);
  const missingReferences = useMemo(
    () => missingOptionReferences(rooms, fieldKey, options),
    [fieldKey, options, rooms],
  );

  const startEdit = () => {
    setDraftOptions(normalizeOptionOrders(options));
    setDeleteTargetId(null);
    setReplacementId(CLEAR_REPLACEMENT_ID);
    setOpen((current) => !current);
  };

  const duplicateLabel = hasDuplicateFieldOptionLabels(draftOptions);
  const canSave =
    !disabled && !duplicateLabel && draftOptions.every((option) => option.label.trim());
  const deleteTarget = draftOptions.find((option) => option.id === deleteTargetId);
  const replacementOptions = draftOptions.filter((option) => option.id !== deleteTargetId);
  const deleteTargetReferenceCount = deleteTarget ? (referenceCounts[deleteTarget.id] ?? 0) : 0;
  const mustMergeDelete = Boolean(required && deleteTargetReferenceCount > 0);
  const canConfirmDelete = !mustMergeDelete || replacementId !== CLEAR_REPLACEMENT_ID;

  return (
    <div className="room-option-manager">
      <button
        type="button"
        className="data-table-header-action"
        aria-expanded={open}
        aria-label={`Manage ${label} options`}
        disabled={disabled}
        onClick={startEdit}
      >
        Options
      </button>
      {missingReferences.length ? (
        <span className="room-option-warning" title={`${missingReferences.length} missing ids`}>
          Missing
        </span>
      ) : null}
      {open ? (
        <div className="room-option-popover">
          <div className="room-option-popover-header">
            <strong>{label} options</strong>
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          {draftOptions.length ? (
            <div className="room-option-list">
              {draftOptions.map((option, index) => (
                <div className="room-option-row" key={option.id}>
                  <input
                    type="color"
                    aria-label={`${option.label} color`}
                    value={option.color}
                    onChange={(event) =>
                      setDraftOptions(
                        updateOption(draftOptions, option.id, { color: event.target.value }),
                      )
                    }
                  />
                  <input
                    aria-label={`${option.label} label`}
                    value={option.label}
                    onChange={(event) =>
                      setDraftOptions(
                        updateOption(draftOptions, option.id, { label: event.target.value }),
                      )
                    }
                  />
                  <span>{referenceCounts[option.id] ?? 0}</span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={index === 0}
                    onClick={() => setDraftOptions(moveOption(draftOptions, index, index - 1))}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={index === draftOptions.length - 1}
                    onClick={() => setDraftOptions(moveOption(draftOptions, index, index + 1))}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => {
                      const firstReplacement = draftOptions.find(
                        (candidate) => candidate.id !== option.id,
                      );
                      setDeleteTargetId(option.id);
                      setReplacementId(
                        required
                          ? (firstReplacement?.id ?? CLEAR_REPLACEMENT_ID)
                          : CLEAR_REPLACEMENT_ID,
                      );
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="form-note">No options yet. Paste or edit a room to create them.</p>
          )}
          {duplicateLabel ? <p className="form-error">Option labels must be unique.</p> : null}
          {deleteTarget ? (
            <div className="room-option-delete-panel">
              <label>
                Delete {deleteTarget.label}
                <select
                  value={replacementId}
                  onChange={(event) => setReplacementId(event.target.value)}
                >
                  {mustMergeDelete ? null : (
                    <option value={CLEAR_REPLACEMENT_ID}>Clear referenced cells</option>
                  )}
                  {replacementOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      Merge into {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="danger-button"
                disabled={!canConfirmDelete}
                onClick={() => {
                  const replacements = {
                    [deleteTarget.id]:
                      replacementId === CLEAR_REPLACEMENT_ID ? null : replacementId,
                  };
                  const nextOptions = draftOptions.filter(
                    (option) => option.id !== deleteTarget.id,
                  );
                  onSave(fieldKey, nextOptions, replacements);
                  setOpen(false);
                }}
              >
                Confirm delete
              </button>
            </div>
          ) : null}
          <div className="room-option-popover-footer">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setDraftOptions(normalizeOptionOrders(options))}
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                onSave(fieldKey, draftOptions);
                setOpen(false);
              }}
            >
              Save options
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function updateOption(
  options: SingleSelectOption[],
  optionId: string,
  patch: Partial<Pick<SingleSelectOption, "label" | "color">>,
): SingleSelectOption[] {
  return options.map((option) => (option.id === optionId ? { ...option, ...patch } : option));
}

function moveOption(options: SingleSelectOption[], fromIndex: number, toIndex: number) {
  const next = [...options];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return options;
  next.splice(toIndex, 0, moved);
  return normalizeOptionOrders(next);
}
