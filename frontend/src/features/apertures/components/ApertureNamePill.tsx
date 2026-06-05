import { useEffect, useState, type CSSProperties } from "react";
import type { RectMm } from "../aperture-geometry";
import { pxFromMm } from "../canvas-constants";
import type { ApertureElement } from "../types";

export function ApertureNamePill({
  element,
  glazingRect,
  parentRect,
  zoom,
  canEdit,
  onCommit,
}: {
  element: ApertureElement;
  glazingRect: RectMm;
  parentRect: RectMm;
  zoom: number;
  canEdit: boolean;
  onCommit: (elementId: string, newName: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(element.name);

  // Reset the draft when the canonical name changes underneath us (e.g.
  // commit completes, version switches, or the aperture is swapped).
  useEffect(() => {
    if (!editing) setDraft(element.name);
  }, [element.name, editing]);

  const style: CSSProperties = {
    left: `${pxFromMm(glazingRect.x - parentRect.x + glazingRect.width / 2, zoom)}px`,
    top: `${pxFromMm(glazingRect.y - parentRect.y + glazingRect.height / 2, zoom)}px`,
  };

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === element.name) {
      setDraft(element.name);
      setEditing(false);
      return;
    }
    onCommit(element.id, trimmed);
    setEditing(false);
  }

  function cancel() {
    setDraft(element.name);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        className="aperture-name-pill aperture-name-pill--editing"
        data-testid={`pill-${element.id}`}
        data-pill="true"
        style={style}
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onFocus={(event) => event.currentTarget.select()}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        onBlur={commit}
      />
    );
  }

  return (
    <div
      className="aperture-name-pill"
      data-testid={`pill-${element.id}`}
      data-pill="true"
      data-readonly={canEdit ? undefined : "true"}
      style={style}
      onMouseDown={(event) => {
        if (!canEdit) return;
        event.stopPropagation();
        setDraft(element.name);
        setEditing(true);
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {element.name}
    </div>
  );
}
