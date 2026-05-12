import { type FormEvent, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { isStatusState, STATUS_STATE_OPTIONS } from "../lib";
import type { StatusItem, StatusItemPayload, StatusState } from "../types";

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
        <label>
          <span>State</span>
          <select
            value={state}
            onChange={(event) => {
              if (isStatusState(event.target.value)) setState(event.target.value);
            }}
          >
            {STATUS_STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Completion date</span>
          <input
            type="date"
            value={completionDate}
            onChange={(event) => setCompletionDate(event.target.value)}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
          />
        </label>
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
