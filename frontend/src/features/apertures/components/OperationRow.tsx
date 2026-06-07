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

import { useRef } from "react";
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
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const label = OPERATION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "Fixed";
  return (
    <details
      className="aperture-operation-type-menu"
      data-testid="operation-type-select"
      ref={detailsRef}
    >
      <summary className="aperture-operation-type-menu__trigger" aria-label="Operation type">
        {label}
      </summary>
      <div className="aperture-operation-type-menu__panel" role="menu">
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
              if (detailsRef.current) detailsRef.current.open = false;
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}
