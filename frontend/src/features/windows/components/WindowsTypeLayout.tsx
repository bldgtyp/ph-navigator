import type { CatalogFrameType, CatalogGlazingType } from "../../catalogs/types";
import { emptyDetailMessage } from "../lib/emptyDetailMessage";
import type { RefreshSlotName, RefreshSlotReport } from "../refresh/types";
import type { WindowTypeEntry } from "../types";
import { WindowTypeDetail } from "./WindowTypeDetail";
import { WindowTypeSidebar } from "./WindowTypeSidebar";

export function WindowsTypeLayout({
  items,
  selectedId,
  selectedWindowType,
  canEdit,
  frameTypes,
  frameTypesLoading,
  glazingTypes,
  glazingTypesLoading,
  getRefreshSlot,
  onSelect,
  onReviewRefresh,
  onChange,
}: {
  items: WindowTypeEntry[];
  selectedId: string | null;
  selectedWindowType: WindowTypeEntry | null;
  canEdit: boolean;
  frameTypes: CatalogFrameType[];
  frameTypesLoading: boolean;
  glazingTypes: CatalogGlazingType[];
  glazingTypesLoading: boolean;
  getRefreshSlot: (elementId: string, slot: RefreshSlotName) => RefreshSlotReport | null;
  onSelect: (id: string) => void;
  onReviewRefresh: (elementId: string, slot: RefreshSlotName) => void;
  onChange: (next: WindowTypeEntry) => void;
}) {
  return (
    <div className="windows-layout">
      <WindowTypeSidebar items={items} selectedId={selectedId} onSelect={onSelect} />
      {selectedWindowType ? (
        <WindowTypeDetail
          windowType={selectedWindowType}
          canEdit={canEdit}
          frameTypes={frameTypes}
          frameTypesLoading={frameTypesLoading}
          glazingTypes={glazingTypes}
          glazingTypesLoading={glazingTypesLoading}
          getRefreshSlot={getRefreshSlot}
          onReviewRefresh={onReviewRefresh}
          onChange={onChange}
        />
      ) : (
        <p className="empty-state">{emptyDetailMessage(items.length, canEdit)}</p>
      )}
    </div>
  );
}
