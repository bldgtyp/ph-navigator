// Stack of element cards rendered below the canvas. Order is canonical:
// ``column_span[0]`` ascending then ``row_span[0]`` ascending — same
// reading order as the catalog spec so the index of the card matches
// the order users see in the on-canvas pill stack.

import { useLayoutEffect, useRef } from "react";
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

const CARD_MOVE_DURATION_MS = 180;
const cardMoveFrames = new WeakMap<HTMLElement, number>();
const cardMoveTimers = new WeakMap<HTMLElement, number>();

export type ApertureElementCardStackProps = {
  aperture: ApertureTypeEntry;
  viewDirection: ViewDirection;
  canEdit: boolean;
  selectedElementIds: readonly string[];
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
  selectedElementIds,
  onSetElementName,
  onPickFrame,
  onPickGlazing,
  onSetElementOperation,
  dismissedOperationWarnings,
  onDismissOperationWarning,
  uValueByElementId,
}: ApertureElementCardStackProps) {
  const stackRef = useRef<HTMLDivElement | null>(null);
  const previousRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const previousOrderKeyRef = useRef<string | null>(null);
  const latestSelectedElementId = selectedElementIds.at(-1) ?? null;
  const selectedElementIdSet = new Set(selectedElementIds);
  const ordered = orderedElements(aperture.elements, latestSelectedElementId);
  const orderKey = ordered.map((element) => element.id).join("\n");

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const currentRects = measureCardRects(stack);
    const previousRects = previousRectsRef.current;
    const previousOrderKey = previousOrderKeyRef.current;
    previousRectsRef.current = currentRects;
    previousOrderKeyRef.current = orderKey;
    if (previousOrderKey === null || previousOrderKey === orderKey || prefersReducedMotion())
      return;

    for (const card of stack.querySelectorAll<HTMLElement>(".aperture-element-card")) {
      const elementId = card.dataset.elementId;
      if (!elementId) continue;
      const previousRect = previousRects.get(elementId);
      const currentRect = currentRects.get(elementId);
      if (!previousRect || !currentRect) continue;
      const dx = previousRect.left - currentRect.left;
      const dy = previousRect.top - currentRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      animateCardMove(card, dx, dy);
    }
  });

  return (
    <div
      className="aperture-element-card-stack"
      data-testid="aperture-element-card-stack"
      ref={stackRef}
    >
      {ordered.map((element) => (
        <ApertureElementCard
          key={element.id}
          element={element}
          viewDirection={viewDirection}
          canEdit={canEdit}
          isSelected={selectedElementIdSet.has(element.id)}
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

export function orderedElements(
  elements: ApertureElement[],
  priorityElementId: string | null = null,
): ApertureElement[] {
  const ordered = [...elements].sort((a, b) => {
    if (a.column_span[0] !== b.column_span[0]) return a.column_span[0] - b.column_span[0];
    return a.row_span[0] - b.row_span[0];
  });
  if (priorityElementId === null) return ordered;
  const priorityIndex = ordered.findIndex((element) => element.id === priorityElementId);
  if (priorityIndex <= 0) return ordered;
  const priority = ordered[priorityIndex];
  if (priority === undefined) return ordered;
  return [priority, ...ordered.slice(0, priorityIndex), ...ordered.slice(priorityIndex + 1)];
}

function measureCardRects(stack: HTMLElement): Map<string, DOMRect> {
  const rects = new Map<string, DOMRect>();
  for (const card of stack.querySelectorAll<HTMLElement>(".aperture-element-card")) {
    const elementId = card.dataset.elementId;
    if (!elementId) continue;
    rects.set(elementId, card.getBoundingClientRect());
  }
  return rects;
}

function animateCardMove(card: HTMLElement, dx: number, dy: number): void {
  const pendingFrame = cardMoveFrames.get(card);
  if (pendingFrame !== undefined) window.cancelAnimationFrame(pendingFrame);
  const pendingTimer = cardMoveTimers.get(card);
  if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);

  card.dataset.moving = "true";
  card.style.transition = "none";
  card.style.transform = `translate(${dx}px, ${dy}px)`;

  const frame = window.requestAnimationFrame(() => {
    cardMoveFrames.delete(card);
    card.style.transition = `transform ${CARD_MOVE_DURATION_MS}ms var(--ease)`;
    card.style.transform = "translate(0, 0)";
  });
  cardMoveFrames.set(card, frame);

  const timer = window.setTimeout(() => {
    cardMoveTimers.delete(card);
    if (card.style.transform !== "translate(0, 0)") return;
    delete card.dataset.moving;
    card.style.transition = "";
    card.style.transform = "";
  }, CARD_MOVE_DURATION_MS + 50);
  cardMoveTimers.set(card, timer);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
