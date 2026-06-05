import { type FormEvent, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { isStatusState, STATUS_STATE_OPTIONS } from "../lib";
import type { StatusItem, StatusItemPayload, StatusState } from "../types";
import { StatusDescription } from "./StatusDescription";

export function StatusItemModal({
  title,
  item,
  onCancel,
  onSubmit,
}: {
  title: string;
  item?: StatusItem;
  onCancel: () => void;
  onSubmit: (payload: StatusItemPayload) => Promise<void>;
}) {
  const [itemTitle, setItemTitle] = useState(item?.title ?? "");
  const [state, setState] = useState<StatusState>(item?.state ?? "todo");
  const [completionDate, setCompletionDate] = useState(item?.completion_date ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [descriptionMode, setDescriptionMode] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const payload: StatusItemPayload = {
      title: itemTitle.trim(),
      state,
      completion_date: completionDate || null,
      description: description.trim() || null,
    };
    void onSubmit(payload)
      .catch((submitError: unknown) => {
        setError(errorMessage(submitError, "Could not save status item."));
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <ModalDialog title={title} titleId="status-modal-title" onClose={onCancel}>
      <form className="project-form" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input
            value={itemTitle}
            onChange={(event) => setItemTitle(event.target.value)}
            required
          />
        </label>
        <AutocompleteSelect
          label="State"
          value={state}
          options={STATUS_STATE_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(nextState) => {
            if (isStatusState(nextState)) setState(nextState);
          }}
        />
        <label>
          <span>Completion date</span>
          <input
            type="date"
            value={completionDate}
            onChange={(event) => setCompletionDate(event.target.value)}
          />
        </label>
        <div className="field-group">
          <div className="field-label-row">
            <span>Description</span>
            <div className="segmented-control" aria-label="Description mode">
              <button
                type="button"
                className={descriptionMode === "edit" ? "active" : ""}
                aria-pressed={descriptionMode === "edit"}
                onClick={() => setDescriptionMode("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                className={descriptionMode === "preview" ? "active" : ""}
                aria-pressed={descriptionMode === "preview"}
                onClick={() => setDescriptionMode("preview")}
              >
                Preview
              </button>
            </div>
          </div>
          {descriptionMode === "edit" ? (
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
            />
          ) : (
            <div className="markdown-preview">
              {description.trim() ? (
                <StatusDescription description={description} />
              ) : (
                <p className="empty-preview">No description.</p>
              )}
            </div>
          )}
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || itemTitle.trim().length === 0}>
            {isSubmitting ? "Saving..." : "Save item"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
