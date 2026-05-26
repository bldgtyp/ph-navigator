import type { CatalogFrameType, CatalogGlazingType } from "../../catalogs/types";
import { FRAME_SIDES, frameRefFromCatalog, glazingRefFromCatalog } from "../lib";
import type { RefreshSlotName, RefreshSlotReport } from "../refresh/types";
import type { WindowElement } from "../types";
import { CatalogPickerSlot } from "./CatalogPickerSlot";

export function WindowElementCard({
  element,
  canEdit,
  frameTypes,
  frameTypesLoading,
  glazingTypes,
  glazingTypesLoading,
  getRefreshSlot,
  onReviewRefresh,
  onChange,
}: {
  element: WindowElement;
  canEdit: boolean;
  frameTypes: CatalogFrameType[];
  frameTypesLoading: boolean;
  glazingTypes: CatalogGlazingType[];
  glazingTypesLoading: boolean;
  getRefreshSlot: (elementId: string, slot: RefreshSlotName) => RefreshSlotReport | null;
  onReviewRefresh: (elementId: string, slot: RefreshSlotName) => void;
  onChange: (next: WindowElement) => void;
}) {
  return (
    <article className="window-element-card">
      <h4>Element</h4>
      <div className="window-element-frames">
        {FRAME_SIDES.map((side) => (
          <CatalogPickerSlot
            key={side}
            label={`Frame · ${side}`}
            ariaLabel={`Frame ${side} U-value`}
            testId={`frame-${side}-catalog-origin`}
            value={element.frames[side]}
            canEdit={canEdit}
            catalogRows={frameTypes}
            catalogRowsLoading={frameTypesLoading}
            refFromCatalogRow={frameRefFromCatalog}
            refreshSlot={getRefreshSlot(element.id, `frame.${side}`)}
            onReviewRefresh={() => onReviewRefresh(element.id, `frame.${side}`)}
            onChange={(next) =>
              onChange({ ...element, frames: { ...element.frames, [side]: next } })
            }
          />
        ))}
      </div>
      <CatalogPickerSlot
        label="Glazing"
        ariaLabel="Glazing U-value"
        testId="glazing-catalog-origin"
        className="window-slot-glazing"
        value={element.glazing}
        canEdit={canEdit}
        catalogRows={glazingTypes}
        catalogRowsLoading={glazingTypesLoading}
        refFromCatalogRow={glazingRefFromCatalog}
        refreshSlot={getRefreshSlot(element.id, "glazing")}
        onReviewRefresh={() => onReviewRefresh(element.id, "glazing")}
        onChange={(next) => onChange({ ...element, glazing: next })}
      />
    </article>
  );
}
