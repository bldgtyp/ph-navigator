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
import { OperationRow } from "./OperationRow";
import { OperationWarningBanner } from "./OperationWarningBanner";
import type { ApertureOperation } from "../types";
import { mismatchedSides } from "../operation-frame-match";

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
  onSetOperation: (operation: ApertureOperation | null) => void;
  operationWarningDismissed: boolean;
  onDismissOperationWarning: () => void;
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
  onSetOperation,
  operationWarningDismissed,
  onDismissOperationWarning,
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

  const mismatched = mismatchedSides(element);

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
      {ALL_SIDES.map((side) => {
        const isMismatch = !operationWarningDismissed && mismatched.includes(side);
        return (
          <FrameRow
            key={side}
            side={side}
            viewDirection={viewDirection}
            frame={element.frames[side]}
            operation={element.operation}
            canEdit={canEdit}
            mismatchIndicator={
              isMismatch
                ? mismatchTooltip(element.frames[side]?.operation, element.operation)
                : null
            }
            onPick={(frame) => onPickFrame(side, frame)}
            onEditField={(k, v) => onEditFrameField(side, k, v)}
          />
        );
      })}
      <OperationRow operation={element.operation} canEdit={canEdit} onCommit={onSetOperation} />
      {!operationWarningDismissed && (
        <OperationWarningBanner
          mismatchedSides={mismatched}
          onDismiss={onDismissOperationWarning}
        />
      )}
    </div>
  );
}

function mismatchTooltip(
  frameOperation: string | null | undefined,
  elementOperation: ApertureElement["operation"],
): string {
  const elementLabel =
    elementOperation === null
      ? "Fixed"
      : `${elementOperation.type.charAt(0).toUpperCase()}${elementOperation.type.slice(1)}`;
  return `Frame catalog operation was '${frameOperation ?? "?"}'; element operation is now '${elementLabel}'.`;
}
