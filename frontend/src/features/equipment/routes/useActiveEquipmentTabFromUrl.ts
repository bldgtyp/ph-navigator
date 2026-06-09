// §A7 — Reconciles `activeTab` state with the `?tab=` URL parameter.
// The lazy `useState` initializer the page previously used only ran at
// mount, so a Rooms→Pumps pill click that only mutated `?tab=` (same
// route segment) left `activeTab` stale and forwarded `?focus=` to the
// wrong slot. This hook reseeds `activeTab` whenever the URL key
// changes. In-page tab clicks stay local — `setActiveTab` does not
// write back to the URL, matching the pre-existing UX.
import { useEffect, useState } from "react";
import { EQUIPMENT_TABS, type EquipmentTabKey } from "./equipmentPageConfig";

const DEFAULT_TAB: EquipmentTabKey = "ventilators";

function resolveTab(requested: string | null | undefined): EquipmentTabKey | null {
  const match = EQUIPMENT_TABS.find((entry) => entry.key === requested);
  return match ? match.key : null;
}

export function useActiveEquipmentTabFromUrl(
  requestedTabKey: string | null | undefined,
): [EquipmentTabKey, (next: EquipmentTabKey) => void] {
  const [activeTab, setActiveTab] = useState<EquipmentTabKey>(
    () => resolveTab(requestedTabKey) ?? DEFAULT_TAB,
  );
  // Only sync when the URL carries an explicit, recognized tab — an
  // empty `?tab=` should NOT clobber the user's local in-page click.
  useEffect(() => {
    const next = resolveTab(requestedTabKey);
    if (next === null) return;
    setActiveTab((current) => (current === next ? current : next));
  }, [requestedTabKey]);
  return [activeTab, setActiveTab];
}
