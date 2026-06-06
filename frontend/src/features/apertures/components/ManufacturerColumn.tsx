// One checkbox column inside the ManufacturerFiltersModal. Drives both
// the frame and glazing columns — the only difference is the title and
// the in-use set, both passed in.
//
// A row is "in use" when any picked element on the document references
// that manufacturer. In-use rows are always-checked, disabled, and carry
// a tooltip explaining why; the column's Clear-all bulk action skips
// them.

import type { CatalogManufacturerEntry } from "../../catalogs/types";
import { isManufacturerEnabled } from "../lib/inUseManufacturers";

export type ManufacturerColumnProps = {
  title: string;
  roster: CatalogManufacturerEntry[];
  inUse: string[];
  enabled: string[] | null;
  readOnly?: boolean;
  onChange: (next: string[] | null) => void;
  onClearAllNote?: (skippedCount: number) => void;
};

export function ManufacturerColumn({
  title,
  roster,
  inUse,
  enabled,
  readOnly = false,
  onChange,
  onClearAllNote,
}: ManufacturerColumnProps) {
  const inUseLower = new Set(inUse.map((m) => m.trim().toLowerCase()));

  const isChecked = (name: string): boolean => {
    if (inUseLower.has(name.trim().toLowerCase())) return true;
    return isManufacturerEnabled(name, enabled);
  };

  const isLocked = (name: string): boolean => inUseLower.has(name.trim().toLowerCase());

  const toggle = (name: string) => {
    if (readOnly || isLocked(name)) return;
    const currentEnabled = effectiveEnabled(enabled, roster);
    const target = name.trim().toLowerCase();
    const without = currentEnabled.filter((m) => m.trim().toLowerCase() !== target);
    if (without.length === currentEnabled.length) {
      onChange([...currentEnabled, name]);
    } else {
      onChange(without);
    }
  };

  const selectAll = () => {
    if (readOnly) return;
    onChange(null);
  };

  const clearAll = () => {
    if (readOnly) return;
    const kept = roster.filter((r) => inUseLower.has(r.manufacturer.trim().toLowerCase()));
    const skipped = inUse.length;
    onChange(kept.map((r) => r.manufacturer));
    if (skipped > 0) onClearAllNote?.(skipped);
  };

  const enabledCount = roster.filter((r) => isChecked(r.manufacturer)).length;

  return (
    <section className="manufacturer-column" aria-label={title}>
      <header className="manufacturer-column__header">
        <h3>{title}</h3>
        <p className="manufacturer-column__count">
          {enabledCount} of {roster.length} enabled
        </p>
        <div className="manufacturer-column__bulk">
          <button type="button" onClick={selectAll} disabled={readOnly}>
            Select all
          </button>
          <button type="button" onClick={clearAll} disabled={readOnly}>
            Clear all
          </button>
        </div>
      </header>
      {roster.length === 0 ? (
        <p className="manufacturer-column__empty">No manufacturers in the catalog yet.</p>
      ) : (
        <ul className="manufacturer-column__list">
          {roster.map((row) => {
            const locked = isLocked(row.manufacturer);
            return (
              <li key={row.manufacturer} className="manufacturer-column__row">
                <label
                  title={
                    locked
                      ? "In use on an element — can't be disabled while referenced."
                      : undefined
                  }
                >
                  <input
                    type="checkbox"
                    checked={isChecked(row.manufacturer)}
                    disabled={readOnly || locked}
                    onChange={() => toggle(row.manufacturer)}
                  />
                  <span className="manufacturer-column__name">{row.manufacturer}</span>
                  <span className="manufacturer-column__badge">{row.product_count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Resolve the user-facing enabled list:
//   - ``null`` (default) is rendered as "every roster row checked".
//   - Toggling a row off from that state needs the explicit list of all
//     other rows so we can drop one and persist the rest.
function effectiveEnabled(enabled: string[] | null, roster: CatalogManufacturerEntry[]): string[] {
  if (enabled === null) return roster.map((r) => r.manufacturer);
  return enabled;
}
