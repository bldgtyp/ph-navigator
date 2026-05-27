import { updateElementInWindowType } from "../lib";
import type { FrameRef, FrameSide, GlazingRef, WindowElement, WindowTypeEntry } from "../types";
import type {
  RefreshSelection,
  RefreshSlotName,
  RefreshSlotReport,
  RefreshSlotState,
} from "./types";

export function defaultRefreshSelection(slot: RefreshSlotReport): RefreshSelection {
  const selection: RefreshSelection = {};
  for (const field of slot.fields) {
    selection[field.key] =
      !field.skip_reason &&
      slot.state === "drifted" &&
      !field.is_overridden &&
      field.ref_value !== field.catalog_value
        ? "update"
        : "keep";
  }
  return selection;
}

export function canApplyRefresh(slot: RefreshSlotReport): boolean {
  return (
    slot.state === "drifted" &&
    slot.current_catalog_version_id !== null &&
    slot.fields.some((field) => !field.skip_reason)
  );
}

export function applyRefreshSelection<TRef extends FrameRef | GlazingRef>(
  ref: TRef,
  slot: RefreshSlotReport,
  selection: RefreshSelection,
  syncedAt = new Date().toISOString(),
): TRef {
  if (!ref.catalog_origin || !canApplyRefresh(slot)) return ref;
  const currentCatalogVersionId = slot.current_catalog_version_id;
  if (currentCatalogVersionId === null) return ref;

  const next = { ...ref } as TRef & Record<string, unknown>;
  for (const field of slot.fields) {
    if (!field.skip_reason && selection[field.key] === "update") {
      next[field.key] = field.catalog_value;
    }
  }

  next.catalog_origin = {
    ...ref.catalog_origin,
    catalog_version_id: currentCatalogVersionId,
    catalog_schema_version: ref.catalog_origin.catalog_schema_version,
    synced_at: syncedAt,
    local_overrides: [...ref.catalog_origin.local_overrides],
  };
  return next;
}

export function refreshSlotLookupKey(
  windowTypeId: string,
  elementId: string,
  slot: RefreshSlotName,
): string {
  return `${refreshElementLookupKey(windowTypeId, elementId)}:${slot}`;
}

export function refreshElementLookupKey(windowTypeId: string, elementId: string): string {
  return `${windowTypeId}:${elementId}`;
}

export function refreshActionLabel(state: RefreshSlotState): string | null {
  if (state === "drifted") return "Review refresh";
  if (state === "source_deactivated") return "Source inactive";
  return null;
}

export function frameSideFromRefreshSlot(slotName: RefreshSlotName): FrameSide | null {
  if (slotName === "frame.top") return "top";
  if (slotName === "frame.right") return "right";
  if (slotName === "frame.bottom") return "bottom";
  if (slotName === "frame.left") return "left";
  return null;
}

export function findSlotRef(
  windowTypes: WindowTypeEntry[],
  windowTypeId: string,
  elementId: string,
  slotName: RefreshSlotName,
): FrameRef | GlazingRef | null {
  const windowType = windowTypes.find((entry) => entry.id === windowTypeId);
  const element = windowType?.elements.find((entry) => entry.id === elementId);
  if (!element) return null;
  if (slotName === "glazing") return element.glazing;
  const side = frameSideFromRefreshSlot(slotName);
  return side ? element.frames[side] : null;
}

export function applyRefToWindowTypes(
  windowTypes: WindowTypeEntry[],
  windowTypeId: string,
  elementId: string,
  slotName: RefreshSlotName,
  nextRef: FrameRef | GlazingRef,
): WindowTypeEntry[] {
  return windowTypes.map((windowType) => {
    if (windowType.id !== windowTypeId) return windowType;
    return updateElementInWindowType(windowType, elementId, (element) =>
      replaceElementRef(element, slotName, nextRef),
    );
  });
}

function replaceElementRef(
  element: WindowElement,
  slotName: RefreshSlotName,
  nextRef: FrameRef | GlazingRef,
): WindowElement {
  if (slotName === "glazing") {
    return { ...element, glazing: nextRef as GlazingRef };
  }
  const side = frameSideFromRefreshSlot(slotName);
  return side
    ? { ...element, frames: { ...element.frames, [side]: nextRef as FrameRef } }
    : element;
}
