import type { KeyboardEvent } from "react";
import { formatProjectDate } from "../../../shared/lib/dates";
import { nextStatusState, stateSymbol, STATUS_STATE_LABELS } from "../lib";
import type { StatusItem } from "../types";
import { StatusDescription } from "./StatusDescription";

export function StatusItemRow({
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
              {formatProjectDate(item.completion_date)}
            </button>
          ) : null}
        </div>
        {item.description ? (
          <StatusDescription description={item.description} />
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
