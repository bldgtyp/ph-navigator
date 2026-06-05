// Editable operation row used inside ``ApertureElementCard``.
// Composes:
//   * Native <select> for Fixed / Swing / Slide
//   * Four direction toggle buttons (Left / Right / Up / Down) for
//     non-fixed types
//   * The Common-patterns preset menu
//
// All three control surfaces dispatch through ``onCommit`` with the
// fully composed ``ApertureOperation | null`` payload — the parent
// fans into ``setElementOperation``. Locked / Viewer access renders
// the read-only label from ``formatOperation`` instead of the editor.

import { formatOperation } from "../operation-labels";
import type { ApertureOperation, ApertureOperationDirection } from "../types";
import { OperationPresetMenu } from "./OperationPresetMenu";

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

export function OperationRow({ operation, canEdit, onCommit }: OperationRowProps) {
  if (!canEdit) {
    return (
      <div className="aperture-card-row aperture-operation-row" data-testid="operation-row">
        <div className="aperture-card-row__label">Operation:</div>
        <div className="aperture-operation-row__readonly">{formatOperation(operation)}</div>
      </div>
    );
  }

  const type = operation === null ? "fixed" : operation.type;
  const directions = operation === null ? [] : operation.directions;

  const handleTypeChange = (value: string) => {
    if (value === "fixed") {
      onCommit(null);
      return;
    }
    onCommit({ type: value as "swing" | "slide", directions });
  };

  const toggleDirection = (direction: ApertureOperationDirection) => {
    if (operation === null) return;
    const has = directions.includes(direction);
    const next = has ? directions.filter((d) => d !== direction) : [...directions, direction];
    onCommit({ type: operation.type, directions: next });
  };

  return (
    <div className="aperture-card-row aperture-operation-row" data-testid="operation-row">
      <div className="aperture-card-row__label">Operation:</div>
      <div className="aperture-operation-row__main">
        <select
          className="aperture-operation-row__select"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value)}
          aria-label="Operation type"
          data-testid="operation-type-select"
        >
          <option value="fixed">Fixed</option>
          <option value="swing">Swing</option>
          <option value="slide">Slide</option>
        </select>
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
        <OperationPresetMenu onPick={(payload) => onCommit(payload)} />
      </div>
    </div>
  );
}
