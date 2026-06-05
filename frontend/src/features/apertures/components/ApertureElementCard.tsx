// One full element card composing name row, U-Value chip placeholder,
// glazing row, four frame rows (top / right / bottom / left), and a
// read-only operation row (Phase 07 wires the editor).
//
// The card surfaces five dispatch callbacks that the parent stack
// fans into the page-level command dispatch.

import { useEffect, useRef, useState } from "react";
import type { ApertureElement, ApertureSide, FrameRef, GlazingRef } from "../types";
import type { ViewDirection } from "../frame-label-map";
import { FrameRow } from "./FrameRow";
import { GlazingRow } from "./GlazingRow";

export type ApertureElementCardProps = {
  element: ApertureElement;
  viewDirection: ViewDirection;
  canEdit: boolean;
  /** Side selected by a region click → opens the matching picker (Phase 06). */
  focusedSide?: ApertureSide | "glazing" | null;
  onSetName: (newName: string) => void;
  onPickFrame: (side: ApertureSide, frame: FrameRef) => void;
  onPickGlazing: (glazing: GlazingRef) => void;
  onEditFrameField: (side: ApertureSide, fieldKey: string, value: string | number | null) => void;
  onEditGlazingField: (fieldKey: string, value: string | number | null) => void;
};

const ALL_SIDES: ApertureSide[] = ["top", "right", "bottom", "left"];

export function ApertureElementCard({
  element,
  viewDirection,
  canEdit,
  focusedSide,
  onSetName,
  onPickFrame,
  onPickGlazing,
  onEditFrameField,
  onEditGlazingField,
}: ApertureElementCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [nameDraft, setNameDraft] = useState(element.name);

  useEffect(() => {
    setNameDraft(element.name);
  }, [element.name]);

  useEffect(() => {
    if (focusedSide && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedSide]);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameDraft(element.name);
      return;
    }
    if (trimmed !== element.name) onSetName(trimmed);
  };

  const operationLabel = describeOperation(element.operation);

  return (
    <div className="aperture-element-card" data-testid={`element-card-${element.id}`} ref={cardRef}>
      <div className="aperture-element-card__header">
        <input
          className="aperture-element-card__name"
          value={nameDraft}
          disabled={!canEdit}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setNameDraft(element.name);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          aria-label="Element name"
        />
        <span className="aperture-element-card__uvalue-chip" data-testid="element-uvalue-chip">
          U-Value: --
        </span>
      </div>
      <GlazingRow
        glazing={element.glazing}
        canEdit={canEdit}
        onPick={onPickGlazing}
        onEditField={onEditGlazingField}
      />
      {ALL_SIDES.map((side) => (
        <FrameRow
          key={side}
          side={side}
          viewDirection={viewDirection}
          frame={element.frames[side]}
          operation={element.operation}
          canEdit={canEdit}
          onPick={(frame) => onPickFrame(side, frame)}
          onEditField={(k, v) => onEditFrameField(side, k, v)}
        />
      ))}
      <div className="aperture-element-card__operation">
        <span className="aperture-card-row__label">Operation:</span>
        <span data-testid="element-operation-readout">{operationLabel}</span>
      </div>
    </div>
  );
}

function describeOperation(operation: ApertureElement["operation"]): string {
  if (operation === null) return "Fixed";
  const type = operation.type === "swing" ? "Swing" : "Slide";
  if (operation.directions.length === 0) return type;
  const dirs = operation.directions.map((d) => d.charAt(0).toUpperCase() + d.slice(1));
  return `${type} (${dirs.join(", ")})`;
}
