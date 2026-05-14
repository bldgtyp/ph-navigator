import { ModalDialog } from "../../../shared/ui/ModalDialog";
import type { WindowTypeEntry } from "../types";
import { frameSideFromRefreshSlot, refreshElementLookupKey, refreshSlotLookupKey } from "./lib";
import type { RefreshSlotName, RefreshSlotReport } from "./types";

type ReviewTarget = {
  windowTypeId: string;
  elementId: string;
  slot: RefreshSlotName;
};

export function RefreshReviewAllModal({
  slots,
  windowTypes,
  onClose,
  onReview,
}: {
  slots: RefreshSlotReport[];
  windowTypes: WindowTypeEntry[];
  onClose: () => void;
  onReview: (target: ReviewTarget) => void;
}) {
  const groups = buildReviewGroups(slots, windowTypes);
  return (
    <ModalDialog
      title="Catalog Refresh Report"
      titleId="window-refresh-all-title"
      onClose={onClose}
    >
      <div className="refresh-review-all">
        {groups.length === 0 ? (
          <p className="empty-state">No catalog drift found.</p>
        ) : (
          <ul className="refresh-review-list">
            {groups.map((group) => (
              <li key={group.key} className="refresh-review-group">
                <strong>{group.windowTypeName}</strong>
                <span>{group.elementLabel}</span>
                <ul>
                  {group.rows.map((row) => (
                    <li key={row.key} className="refresh-review-row">
                      <div>
                        <span className="refresh-review-row-label">{row.slotLabel}</span>
                        <span className="refresh-review-row-meta">{row.summary}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onReview({
                            windowTypeId: row.windowTypeId,
                            elementId: row.elementId,
                            slot: row.slot,
                          })
                        }
                      >
                        Review
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

function buildReviewGroups(slots: RefreshSlotReport[], windowTypes: WindowTypeEntry[]) {
  const windowTypeNames = new Map(windowTypes.map((entry) => [entry.id, entry.name]));
  const elementLabels = new Map<string, string>();
  for (const windowType of windowTypes) {
    windowType.elements.forEach((element, index) => {
      elementLabels.set(refreshElementLookupKey(windowType.id, element.id), `Element ${index + 1}`);
    });
  }
  const groups = new Map<
    string,
    {
      key: string;
      windowTypeName: string;
      elementLabel: string;
      rows: Array<{
        key: string;
        windowTypeId: string;
        elementId: string;
        slot: RefreshSlotName;
        slotLabel: string;
        summary: string;
      }>;
    }
  >();
  for (const slot of slots) {
    const targetKey = refreshSlotLookupKey(slot.window_type_id, slot.element_id, slot.slot);
    const groupKey = refreshElementLookupKey(slot.window_type_id, slot.element_id);
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        windowTypeName: windowTypeNames.get(slot.window_type_id) ?? "Unknown window type",
        elementLabel: elementLabels.get(groupKey) ?? "Unknown element",
        rows: [],
      };
      groups.set(groupKey, group);
    }
    const changedCount = slot.fields.filter(
      (field) => field.ref_value !== field.catalog_value,
    ).length;
    group.rows.push({
      key: targetKey,
      windowTypeId: slot.window_type_id,
      elementId: slot.element_id,
      slot: slot.slot,
      slotLabel: formatSlotLabel(slot.slot),
      summary:
        slot.state === "source_deactivated"
          ? "Source inactive"
          : `${changedCount} changed ${changedCount === 1 ? "field" : "fields"}`,
    });
  }
  return Array.from(groups.values());
}

function formatSlotLabel(slot: RefreshSlotName): string {
  if (slot === "glazing") return "Glazing";
  const side = frameSideFromRefreshSlot(slot);
  return side ? `Frame ${side}` : "Frame";
}
