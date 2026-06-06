// Glazing picker — sibling of ``FramePicker`` without location /
// operation filters (Phase 11 adds the manufacturer-filter wiring on
// top of this picker too).

import { useState } from "react";
import type { CatalogGlazingType } from "../../catalogs/types";
import type { GlazingRef } from "../types";
import { useGlazingCatalog } from "../hooks/useGlazingCatalog";
import { useManufacturerFilter, useOpenManufacturerFilters } from "../hooks/useManufacturerFilter";
import { useManufacturerRoster } from "../hooks/useManufacturerRoster";
import { catalogRowToGlazingRef, blankHandEnterGlazingRef } from "../ref-builders";
import { PickerFilterHint } from "./PickerFilterHint";

export type GlazingPickerProps = {
  currentName: string | null;
  disabled?: boolean;
  manufacturers?: string[];
  onPick: (glazing: GlazingRef) => void;
};

export function GlazingPicker({
  currentName,
  disabled = false,
  manufacturers,
  onPick,
}: GlazingPickerProps) {
  const contextFilter = useManufacturerFilter("glazing_types");
  const effectiveManufacturers = manufacturers ?? contextFilter;
  const { rows: filteredRows, totalRows } = useGlazingCatalog({
    manufacturers: effectiveManufacturers,
  });
  const { rows: allRows } = useGlazingCatalog();
  const roster = useManufacturerRoster("glazing_types");
  const openFilters = useOpenManufacturerFilters();
  const [filterCleared, setFilterCleared] = useState(false);
  const visible = filterCleared ? allRows : filteredRows;
  const excluded = !filterCleared && filteredRows.length < totalRows;
  const triggerLabel = currentName ?? "Pick a glazing…";

  if (disabled) {
    return (
      <div className="aperture-picker aperture-picker--disabled" data-testid="glazing-picker">
        <span className="aperture-picker__label">{triggerLabel}</span>
      </div>
    );
  }

  return (
    <details className="aperture-picker" data-testid="glazing-picker">
      <summary className="aperture-picker__trigger">{triggerLabel}</summary>
      <div className="aperture-picker__panel" role="listbox">
        {visible.length === 0 && (
          <div className="aperture-picker__empty">No catalog glazings available.</div>
        )}
        {visible.map((row) => (
          <button
            key={row.id}
            type="button"
            className="aperture-picker__option"
            onClick={() => onPick(catalogRowToGlazingRef(row))}
            data-testid={`glazing-picker-option-${row.id}`}
          >
            <strong>{row.name}</strong>
            <GlazingOptionSecondaryLine row={row} />
          </button>
        ))}
        <hr className="aperture-picker__separator" />
        <button
          type="button"
          className="aperture-picker__option aperture-picker__option--hand-enter"
          onClick={() => onPick(blankHandEnterGlazingRef())}
          data-testid="glazing-picker-hand-enter"
        >
          + Hand-enter
        </button>
        {excluded && (
          <div className="aperture-picker__footer">
            Showing {filteredRows.length} of {totalRows} glazings ·{" "}
            <button type="button" onClick={() => setFilterCleared(true)}>
              Clear filter
            </button>
          </div>
        )}
        {openFilters ? (
          <PickerFilterHint
            visibleManufacturers={distinctManufacturers(visible)}
            rosterManufacturers={roster.roster.length}
            onOpenFilters={openFilters}
          />
        ) : null}
      </div>
    </details>
  );
}

function distinctManufacturers(rows: CatalogGlazingType[]): number {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.manufacturer && r.manufacturer.trim()) set.add(r.manufacturer.trim().toLowerCase());
  }
  return set.size;
}

function GlazingOptionSecondaryLine({ row }: { row: CatalogGlazingType }) {
  const parts: string[] = [];
  if (row.manufacturer) parts.push(row.manufacturer);
  if (row.u_value_w_m2k != null) parts.push(`U=${row.u_value_w_m2k.toFixed(2)}`);
  if (row.g_value != null) parts.push(`g=${row.g_value.toFixed(2)}`);
  if (parts.length === 0) return null;
  return <small className="aperture-picker__option-meta">{parts.join(" · ")}</small>;
}
