import {
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  applyDefaultStatusTemplate,
  createStatusItem,
  deleteStatusItem,
  fetchStatusItems,
  updateStatusItem,
  type ProjectDetail,
  type StatusItem,
  type StatusItemPayload,
  type StatusState,
} from "./api";

type AsyncState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

const STATUS_STATE_LABELS: Record<StatusState, string> = {
  todo: "To do",
  done: "Done",
  na: "N/A",
};

const PROJECT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function StatusTab({ project }: { project: ProjectDetail }) {
  const [itemsState, setItemsState] = useState<AsyncState<StatusItem[]>>({ status: "loading" });
  const [editingItem, setEditingItem] = useState<StatusItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isEditor = project.access_mode === "editor";

  useEffect(() => {
    const controller = new AbortController();
    setItemsState({ status: "loading" });
    void fetchStatusItems(project.id, controller.signal)
      .then((payload) => setItemsState({ status: "ready", data: sortStatusItems(payload.items) }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Could not load status items.";
        setItemsState({ status: "error", message });
      });
    return () => controller.abort();
  }, [project.id]);

  const applyTemplate = () => {
    setActionError(null);
    void applyDefaultStatusTemplate(project.id)
      .then((payload) => setItemsState({ status: "ready", data: sortStatusItems(payload.items) }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not apply template.";
        setActionError(message);
      });
  };

  const addItem = (payload: StatusItemPayload) =>
    createStatusItem(project.id, payload).then((created) => {
      setItemsState((current) =>
        current.status === "ready"
          ? { status: "ready", data: sortStatusItems([...current.data, created]) }
          : current,
      );
      setIsAdding(false);
    });

  const patchItem = (itemId: string, payload: StatusItemPayload) =>
    updateStatusItem(project.id, itemId, payload).then((updated) => {
      replaceStatusItem(setItemsState, updated);
      setEditingItem(null);
    });

  const cycleState = (item: StatusItem) => {
    if (!isEditor) return;
    void patchItem(item.id, { state: nextStatusState(item.state) }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not update item.";
      setActionError(message);
    });
  };

  const deleteItem = (item: StatusItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setActionError(null);
    void deleteStatusItem(project.id, item.id)
      .then(() => {
        setItemsState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: current.data.filter((candidate) => candidate.id !== item.id),
              }
            : current,
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Could not delete item.";
        setActionError(message);
      });
  };

  const moveItem = (item: StatusItem, direction: -1 | 1) => {
    if (itemsState.status !== "ready") return;
    const nextOrder = orderIndexForMove(itemsState.data, item.id, direction);
    if (nextOrder === null) return;
    void patchItem(item.id, { order_index: nextOrder }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not reorder item.";
      setActionError(message);
    });
  };

  if (itemsState.status === "loading") {
    return (
      <section className="tab-panel" aria-labelledby="status-title">
        <h2 id="status-title">Status</h2>
        <p>Loading status items...</p>
      </section>
    );
  }

  if (itemsState.status === "error") {
    return (
      <section className="tab-panel" aria-labelledby="status-title">
        <h2 id="status-title">Status</h2>
        <p role="alert">{itemsState.message}</p>
      </section>
    );
  }

  const items = itemsState.data;
  const currentItemId = items.find((item) => item.state === "todo")?.id ?? null;

  return (
    <section className="tab-panel status-panel" aria-labelledby="status-title">
      <div className="status-heading">
        <div>
          <h2 id="status-title">Status</h2>
          <p>Track this project's lifecycle milestones.</p>
        </div>
        {isEditor && items.length > 0 ? (
          <button type="button" onClick={() => setIsAdding(true)}>
            Add item
          </button>
        ) : null}
      </div>
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {items.length === 0 ? (
        <StatusEmptyState
          isEditor={isEditor}
          projectId={project.id}
          onApplyTemplate={applyTemplate}
          onAddItem={() => setIsAdding(true)}
        />
      ) : (
        <div className="status-timeline" aria-label="Project status items">
          {items.map((item, index) => (
            <StatusItemRow
              key={item.id}
              item={item}
              isCurrent={item.id === currentItemId}
              isEditor={isEditor}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              onCycleState={() => cycleState(item)}
              onEdit={() => setEditingItem(item)}
              onDelete={() => deleteItem(item)}
              onMove={(direction) => moveItem(item, direction)}
            />
          ))}
        </div>
      )}
      {isAdding ? (
        <StatusItemModal
          title="Add status item"
          onCancel={() => setIsAdding(false)}
          onSubmit={addItem}
        />
      ) : null}
      {editingItem ? (
        <StatusItemModal
          title="Edit status item"
          item={editingItem}
          onCancel={() => setEditingItem(null)}
          onSubmit={(payload) => patchItem(editingItem.id, payload)}
        />
      ) : null}
    </section>
  );
}

function StatusEmptyState({
  isEditor,
  projectId,
  onApplyTemplate,
  onAddItem,
}: {
  isEditor: boolean;
  projectId: string;
  onApplyTemplate: () => void;
  onAddItem: () => void;
}) {
  return (
    <section className="status-empty" aria-label="Empty project status">
      <h3>Track this project's lifecycle milestones.</h3>
      <p>
        CAD files received, design model complete, cert review complete, certification complete.
      </p>
      {isEditor ? (
        <div className="status-empty-actions">
          <button type="button" onClick={onApplyTemplate}>
            Apply BLDGTYP default template
          </button>
          <button type="button" className="secondary-button" onClick={onAddItem}>
            Add custom item
          </button>
          <Link className="text-link" to={`/projects/${projectId}/envelope`}>
            Skip to Envelope
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function StatusItemRow({
  item,
  isCurrent,
  isEditor,
  canMoveUp,
  canMoveDown,
  onCycleState,
  onEdit,
  onDelete,
  onMove,
}: {
  item: StatusItem;
  isCurrent: boolean;
  isEditor: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onCycleState: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!event.altKey) return;
    if (event.key === "ArrowUp" && canMoveUp) {
      event.preventDefault();
      onMove(-1);
    }
    if (event.key === "ArrowDown" && canMoveDown) {
      event.preventDefault();
      onMove(1);
    }
  };

  return (
    <article
      className={`status-item ${isCurrent ? "current" : ""}`}
      tabIndex={isEditor ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className="status-rail">
        {isEditor ? (
          <button
            type="button"
            className={`status-state-button ${item.state}`}
            aria-label={`Set ${item.title} to ${STATUS_STATE_LABELS[nextStatusState(item.state)]}`}
            onClick={onCycleState}
          >
            {stateSymbol(item.state)}
          </button>
        ) : (
          <span
            className={`status-state-static ${item.state}`}
            aria-label={STATUS_STATE_LABELS[item.state]}
          >
            {stateSymbol(item.state)}
          </span>
        )}
      </div>
      <div className="status-item-body">
        <div className="status-item-main">
          {isEditor ? (
            <button type="button" className="status-title-button" onClick={onEdit}>
              {item.title}
            </button>
          ) : (
            <h3>{item.title}</h3>
          )}
          <span className={`status-badge ${item.state}`}>{STATUS_STATE_LABELS[item.state]}</span>
          {item.completion_date ? (
            <button
              type="button"
              className="date-pill"
              disabled={!isEditor}
              onClick={isEditor ? onEdit : undefined}
            >
              {formatStatusDate(item.completion_date)}
            </button>
          ) : null}
        </div>
        {item.description ? (
          <p className="status-description">{renderDescription(item.description)}</p>
        ) : isEditor ? (
          <button type="button" className="status-description-empty" onClick={onEdit}>
            Add notes...
          </button>
        ) : null}
      </div>
      {isEditor ? (
        <div className="status-row-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${item.title} up`}
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
          >
            ^
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={`Move ${item.title} down`}
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
          >
            v
          </button>
          <button type="button" className="secondary-button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="danger-button" onClick={onDelete}>
            Delete
          </button>
        </div>
      ) : null}
    </article>
  );
}

function StatusItemModal({
  title,
  item,
  onCancel,
  onSubmit,
}: {
  title: string;
  item?: StatusItem;
  onCancel: () => void;
  onSubmit: (payload: StatusItemPayload) => Promise<void | StatusItem>;
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
        const message =
          submitError instanceof Error ? submitError.message : "Could not save status item.";
        setError(message);
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
      >
        <div className="modal-header">
          <h2 id="status-modal-title">{title}</h2>
          <button type="button" className="text-button" onClick={onCancel}>
            Close
          </button>
        </div>
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
            <select value={state} onChange={(event) => setState(event.target.value as StatusState)}>
              <option value="todo">To do</option>
              <option value="done">Done</option>
              <option value="na">N/A</option>
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
      </section>
    </div>
  );
}

function nextStatusState(state: StatusState): StatusState {
  if (state === "todo") return "done";
  if (state === "done") return "na";
  return "todo";
}

function stateSymbol(state: StatusState): string {
  if (state === "done") return "x";
  if (state === "na") return "-";
  return "o";
}

function sortStatusItems(items: StatusItem[]): StatusItem[] {
  return [...items].sort(
    (a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at),
  );
}

function replaceStatusItem(
  setItemsState: Dispatch<SetStateAction<AsyncState<StatusItem[]>>>,
  updated: StatusItem,
) {
  setItemsState((current) =>
    current.status === "ready"
      ? {
          status: "ready",
          data: sortStatusItems(
            current.data.map((item) => (item.id === updated.id ? updated : item)),
          ),
        }
      : current,
  );
}

function orderIndexForMove(items: StatusItem[], itemId: string, direction: -1 | 1): number | null {
  const currentIndex = items.findIndex((item) => item.id === itemId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return null;
  const reordered = [...items];
  const [item] = reordered.splice(currentIndex, 1);
  if (!item) return null;
  reordered.splice(targetIndex, 0, item);
  const before = reordered[targetIndex - 1]?.order_index;
  const after = reordered[targetIndex + 1]?.order_index;
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after ?? item.order_index) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}

function renderDescription(description: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let lastIndex = 0;
  for (const match of description.matchAll(linkPattern)) {
    if (match.index > lastIndex) {
      parts.push(description.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`${match[2]}-${match.index}`}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
      >
        {match[1]}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < description.length) {
    parts.push(description.slice(lastIndex));
  }
  return parts;
}

function formatStatusDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yearText, monthText, dayText] = value.split("-");
    return PROJECT_DATE_FORMATTER.format(
      new Date(Number(yearText), Number(monthText) - 1, Number(dayText)),
    );
  }
  return PROJECT_DATE_FORMATTER.format(new Date(value));
}
