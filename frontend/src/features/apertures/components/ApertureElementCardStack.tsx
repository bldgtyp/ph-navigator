// Stack of element cards rendered below the canvas. Order is canonical:
// ``column_span[0]`` ascending then ``row_span[0]`` ascending — same
// reading order as the catalog spec so the index of the card matches
// the order users see in the on-canvas pill stack.

import type {
  ApertureElement,
  ApertureOperation,
  ApertureSide,
  ApertureTypeEntry,
  FrameRef,
  GlazingRef,
} from "../types";
import type { ViewDirection } from "../frame-label-map";
import { ApertureElementCard } from "./ApertureElementCard";

export type FocusedTarget = {
  elementId: string;
  region: ApertureSide | "glazing";
} | null;

export type ApertureElementCardStackProps = {
  aperture: ApertureTypeEntry;
  viewDirection: ViewDirection;
  canEdit: boolean;
  focusedTarget: FocusedTarget;
  onSetElementName: (elementId: string, newName: string) => void;
  onPickFrame: (elementId: string, side: ApertureSide, frame: FrameRef) => void;
  onPickGlazing: (elementId: string, glazing: GlazingRef) => void;
  onSetElementOperation: (elementId: string, operation: ApertureOperation | null) => void;
  dismissedOperationWarnings: readonly string[];
  onDismissOperationWarning: (elementId: string) => void;
  uValueByElementId?: Map<string, number>;
};

export function ApertureElementCardStack({
  aperture,
  viewDirection,
  canEdit,
  focusedTarget,
  onSetElementName,
  onPickFrame,
  onPickGlazing,
  onSetElementOperation,
  dismissedOperationWarnings,
  onDismissOperationWarning,
  uValueByElementId,
}: ApertureElementCardStackProps) {
  const ordered = orderedElements(aperture.elements);
  return (
    <div className="aperture-element-card-stack" data-testid="aperture-element-card-stack">
      {ordered.map((element) => (
        <ApertureElementCard
          key={element.id}
          element={element}
          viewDirection={viewDirection}
          canEdit={canEdit}
          focusedSide={
            focusedTarget && focusedTarget.elementId === element.id ? focusedTarget.region : null
          }
          onSetName={(n) => onSetElementName(element.id, n)}
          onPickFrame={(side, frame) => onPickFrame(element.id, side, frame)}
          onPickGlazing={(glazing) => onPickGlazing(element.id, glazing)}
          onSetOperation={(op) => onSetElementOperation(element.id, op)}
          operationWarningDismissed={dismissedOperationWarnings.includes(element.id)}
          onDismissOperationWarning={() => onDismissOperationWarning(element.id)}
          uValueWm2k={uValueByElementId?.get(element.id) ?? null}
        />
      ))}
    </div>
  );
}

export function orderedElements(elements: ApertureElement[]): ApertureElement[] {
  return [...elements].sort((a, b) => {
    if (a.column_span[0] !== b.column_span[0]) return a.column_span[0] - b.column_span[0];
    return a.row_span[0] - b.row_span[0];
  });
}
