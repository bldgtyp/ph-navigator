// One full element card composing name row, U-Value chip, glazing row,
// four frame rows (top / right / bottom / left), and an operation row.
//
// The card surfaces five dispatch callbacks that the parent stack
// fans into the page-level command dispatch.

import { useEffect, useRef } from "react";
import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import type { ApertureElement, ApertureSide, FrameRef, GlazingRef } from "../types";
import type { ViewDirection } from "../frame-label-map";
import { FrameRow } from "./FrameRow";
import { GlazingRow } from "./GlazingRow";
import { OperationRow } from "./OperationRow";
import { OperationWarningBanner } from "./OperationWarningBanner";
import type { ApertureOperation } from "../types";
import { mismatchedSides } from "../operation-frame-match";
import { UValueChip } from "./UValueChip";
import { useUnitPreference } from "../../../lib/units";

export type ApertureElementCardProps = {
  element: ApertureElement;
  viewDirection: ViewDirection;
  canEdit: boolean;
  /** Side selected by a region click → opens the matching picker (Phase 06). */
  focusedSide?: ApertureSide | "glazing" | null;
  onSetName: (newName: string) => void;
  onPickFrame: (side: ApertureSide, frame: FrameRef) => void;
  onPickGlazing: (glazing: GlazingRef) => void;
  onSetOperation: (operation: ApertureOperation | null) => void;
  operationWarningDismissed: boolean;
  onDismissOperationWarning: () => void;
  uValueWm2k?: number | null;
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
  onSetOperation,
  operationWarningDismissed,
  onDismissOperationWarning,
  uValueWm2k,
}: ApertureElementCardProps) {
  const { unitSystem } = useUnitPreference();
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (focusedSide && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedSide]);

  const mismatched = mismatchedSides(element);

  return (
    <div className="aperture-element-card" data-testid={`element-card-${element.id}`} ref={cardRef}>
      <div className="aperture-element-card__header" data-reveal-edit-on-hover>
        <InlineHeaderNameEditor
          className="aperture-element-card__name"
          variant="inline"
          value={element.name}
          fallbackValue="Unnamed"
          canEdit={canEdit}
          busy={false}
          editLabel={`Rename ${element.name || "element"}`}
          inputLabel="Element name"
          getValidationMessage={(value) => {
            if (value.length === 0) return "Element name is required.";
            return null;
          }}
          onSubmit={onSetName}
        />
        <span className="aperture-element-card__summary-uvalue">
          U-w:{" "}
          <UValueChip
            valueWm2k={uValueWm2k ?? null}
            unitSystem={unitSystem === "IP" ? "ip" : "si"}
            compact
          />
        </span>
      </div>
      <div className="aperture-element-table" role="table" aria-label={`${element.name} details`}>
        <div className="aperture-element-table__head" role="row">
          <span role="columnheader">Element</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">U-Value</span>
          <span role="columnheader">Width</span>
          <span role="columnheader">g-Value</span>
        </div>
        <GlazingRow glazing={element.glazing} canEdit={canEdit} onPick={onPickGlazing} />
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
            />
          );
        })}
        <OperationRow operation={element.operation} canEdit={canEdit} onCommit={onSetOperation} />
      </div>
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
