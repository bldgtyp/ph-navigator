import type { DragEvent, KeyboardEvent } from "react";
import { ArrowDown, ArrowUp, Ban, Check, Circle, Pencil, Trash2 } from "lucide-react";
import { formatProjectDate } from "../../../shared/lib/dates";
import { AppMenu, AppMenuItem } from "../../../shared/ui/AppMenu";
import { nextStatusState, stateSymbol, STATUS_STATE_LABELS } from "../lib";
import type { StatusItem } from "../types";
import { StatusDescription } from "./StatusDescription";

export function StatusItemRow({
  item,
  isCurrent,
  isEditor,
  canMoveUp,
  canMoveDown,
  onSetState,
  onEdit,
  onDelete,
  onMove,
  onDrop,
}: {
  item: StatusItem;
  isCurrent: boolean;
  isEditor: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSetState: (state: StatusItem["state"]) => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onDrop: (draggedItemId: string, placement: "before" | "after") => void;
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

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isEditor) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!isEditor) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    onDrop(event.dataTransfer.getData("text/plain"), placement);
  };

  return (
    <article
      className={`status-item ${isCurrent ? "current" : ""}`}
      tabIndex={isEditor ? 0 : undefined}
      draggable={isEditor}
      onKeyDown={handleKeyDown}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="status-rail">
        {isEditor ? (
          <span className="drag-handle" aria-label={`Drag ${item.title} to reorder`}>
            ::
          </span>
        ) : null}
        {isEditor ? (
          <button
            type="button"
            className={`status-state-button ${item.state}`}
            aria-label={`Set ${item.title} to ${STATUS_STATE_LABELS[nextStatusState(item.state)]}`}
            onClick={() => onSetState(nextStatusState(item.state))}
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
          <span className={`chip chip--sm status-badge ${item.state}`}>
            {STATUS_STATE_LABELS[item.state]}
          </span>
          {item.completion_date && isEditor ? (
            <button type="button" className="chip chip--sm date-pill" onClick={onEdit}>
              {formatProjectDate(item.completion_date)}
            </button>
          ) : item.completion_date ? (
            <span className="chip chip--sm date-pill">
              {formatProjectDate(item.completion_date)}
            </span>
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
        <AppMenu className="status-row-menu" label={`More actions for ${item.title}`}>
          <AppMenuItem icon={Pencil} onClick={onEdit}>
            Edit milestone
          </AppMenuItem>
          <AppMenuItem icon={ArrowUp} disabled={!canMoveUp} onClick={() => onMove(-1)}>
            Move up
          </AppMenuItem>
          <AppMenuItem icon={ArrowDown} disabled={!canMoveDown} onClick={() => onMove(1)}>
            Move down
          </AppMenuItem>
          {item.state !== "done" ? (
            <AppMenuItem icon={Check} onClick={() => onSetState("done")}>
              Mark done
            </AppMenuItem>
          ) : null}
          {item.state !== "todo" ? (
            <AppMenuItem icon={Circle} onClick={() => onSetState("todo")}>
              Mark to do
            </AppMenuItem>
          ) : null}
          {item.state !== "na" ? (
            <AppMenuItem icon={Ban} onClick={() => onSetState("na")}>
              Mark N/A
            </AppMenuItem>
          ) : null}
          <AppMenuItem icon={Trash2} danger onClick={onDelete}>
            Delete milestone
          </AppMenuItem>
        </AppMenu>
      ) : null}
    </article>
  );
}
