import type { CatalogFrameType, CatalogGlazingType } from "../../catalogs/types";
import { updateElementInWindowType } from "../lib";
import type { RefreshSlotName, RefreshSlotReport } from "../refresh/types";
import type { WindowTypeEntry } from "../types";
import { WindowElementCard } from "./WindowElementCard";

export function WindowTypeDetail({
  windowType,
  canEdit,
  frameTypes,
  frameTypesLoading,
  glazingTypes,
  glazingTypesLoading,
  getRefreshSlot,
  onReviewRefresh,
  onChange,
}: {
  windowType: WindowTypeEntry;
  canEdit: boolean;
  frameTypes: CatalogFrameType[];
  frameTypesLoading: boolean;
  glazingTypes: CatalogGlazingType[];
  glazingTypesLoading: boolean;
  getRefreshSlot: (elementId: string, slot: RefreshSlotName) => RefreshSlotReport | null;
  onReviewRefresh: (elementId: string, slot: RefreshSlotName) => void;
  onChange: (next: WindowTypeEntry) => void;
}) {
  return (
    <div className="windows-detail">
      <header className="windows-detail-header">
        <h3>{windowType.name}</h3>
      </header>
      <div className="windows-elements">
        {windowType.elements.map((element) => (
          <WindowElementCard
            key={element.id}
            element={element}
            canEdit={canEdit}
            frameTypes={frameTypes}
            frameTypesLoading={frameTypesLoading}
            glazingTypes={glazingTypes}
            glazingTypesLoading={glazingTypesLoading}
            getRefreshSlot={getRefreshSlot}
            onReviewRefresh={onReviewRefresh}
            onChange={(nextElement) =>
              onChange(updateElementInWindowType(windowType, element.id, () => nextElement))
            }
          />
        ))}
      </div>
    </div>
  );
}
