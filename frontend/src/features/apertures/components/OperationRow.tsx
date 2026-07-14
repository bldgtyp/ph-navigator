// Editable operation row used inside ``ApertureElementCard``.
// Composes:
//   * A compact details menu for Fixed / Swing / Slide
//   * Four direction toggle buttons (Left / Right / Up / Down) for
//     non-fixed types
//
// Both control surfaces dispatch through ``onCommit`` with the
// fully composed ``ApertureOperation | null`` payload — the parent
// fans into ``setElementOperation``. Locked / Viewer access renders
// the read-only label from ``formatOperation`` instead of the editor.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import { formatOperation } from "../operation-labels";
import type { ApertureOperation, ApertureOperationDirection } from "../types";

export type OperationRowProps = {
  operation: ApertureOperation | null;
  canEdit: boolean;
  onCommit: (next: ApertureOperation | null) => void;
};

const DIRECTIONS: { key: ApertureOperationDirection; label: string }[] = [
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "up", label: "Up" },
  { key: "down", label: "Down" },
];

type OperationTypeValue = "fixed" | "swing" | "slide";

const OPERATION_TYPE_OPTIONS: { value: OperationTypeValue; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "swing", label: "Swing" },
  { value: "slide", label: "Slide" },
];

export function OperationRow({ operation, canEdit, onCommit }: OperationRowProps) {
  if (!canEdit) {
    return (
      <div
        className="aperture-element-table__row aperture-card-row aperture-operation-row"
        data-testid="operation-row"
        role="row"
      >
        <div className="aperture-card-row__label" role="cell">
          Operation:
        </div>
        <div className="aperture-operation-row__readonly" role="cell">
          {formatOperation(operation)}
        </div>
        <div className="aperture-card-row__metric" role="cell">
          -
        </div>
        <div className="aperture-card-row__metric" role="cell">
          -
        </div>
        <div className="aperture-card-row__metric" role="cell">
          -
        </div>
      </div>
    );
  }

  const type = operation === null ? "fixed" : operation.type;
  const directions = operation === null ? [] : operation.directions;

  const handleTypeChange = (value: OperationTypeValue) => {
    if (value === "fixed") {
      onCommit(null);
      return;
    }
    onCommit({ type: value, directions });
  };

  const toggleDirection = (direction: ApertureOperationDirection) => {
    if (operation === null) return;
    const has = directions.includes(direction);
    const next = has ? directions.filter((d) => d !== direction) : [...directions, direction];
    onCommit({ type: operation.type, directions: next });
  };

  return (
    <div
      className="aperture-element-table__row aperture-card-row aperture-operation-row"
      data-testid="operation-row"
      role="row"
    >
      <div className="aperture-card-row__label" role="cell">
        Operation:
      </div>
      <div className="aperture-operation-row__main" role="cell">
        <OperationTypeMenu value={type} onChange={handleTypeChange} />
        {operation !== null && (
          <div className="aperture-operation-row__directions">
            {DIRECTIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                className="aperture-operation-row__toggle"
                data-active={directions.includes(d.key) ? "true" : undefined}
                aria-pressed={directions.includes(d.key)}
                onClick={() => toggleDirection(d.key)}
                data-testid={`operation-direction-${d.key}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="aperture-card-row__metric" role="cell">
        -
      </div>
      <div className="aperture-card-row__metric" role="cell">
        -
      </div>
      <div className="aperture-card-row__metric" role="cell">
        -
      </div>
    </div>
  );
}

function OperationTypeMenu({
  value,
  onChange,
}: {
  value: OperationTypeValue;
  onChange: (value: OperationTypeValue) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const label = OPERATION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Fixed";

  useOutsidePointerDown(rootRef, open, () => setOpen(false), [panelRef]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    let frameId: number | null = null;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportPadding = 12;
      const gap = 4;
      const belowSpace = window.innerHeight - rect.bottom - viewportPadding;
      const aboveSpace = rect.top - viewportPadding;
      setPosition({
        top: belowSpace >= 140 || belowSpace >= aboveSpace ? rect.bottom + gap : rect.top - gap,
        left: rect.left,
        placement: belowSpace >= 140 || belowSpace >= aboveSpace ? "bottom" : "top",
      });
    };
    const schedulePositionUpdate = () => {
      frameId = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", schedulePositionUpdate, true);
    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", schedulePositionUpdate, true);
    };
  }, [open]);

  return (
    <div className="aperture-operation-type-menu" ref={rootRef}>
      <button
        type="button"
        className="aperture-operation-type-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Operation type"
        data-testid="operation-type-select"
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
      >
        {label}
      </button>
      {open
        ? createPortal(
            <div
              className="aperture-operation-type-menu__panel"
              data-placement={position?.placement}
              ref={panelRef}
              role="menu"
              style={{
                left: position?.left ?? 0,
                opacity: position ? undefined : 0,
                pointerEvents: position ? undefined : "none",
                top: position?.top ?? 0,
                transform: position?.placement === "top" ? "translateY(-100%)" : undefined,
              }}
            >
              {OPERATION_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="aperture-operation-type-menu__option"
                  data-active={option.value === value ? "true" : undefined}
                  role="menuitemradio"
                  aria-checked={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type MenuPosition = {
  top: number;
  left: number;
  placement: "bottom" | "top";
};
