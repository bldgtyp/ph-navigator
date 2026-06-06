// Frame picker — read-only trigger + dropdown of catalog rows filtered
// by the slot's `location` and the element's `operation`. The dropdown
// also surfaces a `+ Hand-enter` row that builds a placeholder
// ``FrameRef`` with ``catalog_origin: null``; the inline override
// fields on the card then become the user's data-entry surface.
//
// The dropdown is implemented with a `<details>` element instead of a
// custom Popper so the picker stays fully native-keyboard-navigable and
// doesn't add a heavyweight dependency. Filtering happens client-side
// from the unfiltered universe so the "Showing N of M · Clear filter"
// footnote can recompute without a round-trip when the user dismisses
// the filter.

import { useState } from "react";
import type { CatalogFrameType } from "../../catalogs/types";
import type { FrameRef } from "../types";
import type { ApertureSide } from "../types";
import { useFrameCatalog } from "../hooks/useFrameCatalog";
import { useManufacturerFilter, useOpenManufacturerFilters } from "../hooks/useManufacturerFilter";
import { useManufacturerRoster } from "../hooks/useManufacturerRoster";
import { locationForSide, operationForElement, type FrameLocation } from "../picker-filters";
import { catalogRowToFrameRef, blankHandEnterFrameRef } from "../ref-builders";
import { PickerFilterHint } from "./PickerFilterHint";

export type FramePickerProps = {
  side: ApertureSide;
  operation: import("../types").ApertureOperation | null;
  currentName: string | null;
  disabled?: boolean;
  manufacturers?: string[];
  onPick: (frame: FrameRef) => void;
};

export function FramePicker({
  side,
  operation,
  currentName,
  disabled = false,
  manufacturers,
  onPick,
}: FramePickerProps) {
  const location: FrameLocation = locationForSide(side);
  const operationFilter = operationForElement(operation).type;
  const contextFilter = useManufacturerFilter("frame_types");
  const effectiveManufacturers = manufacturers ?? contextFilter;
  const { rows: filteredRows, totalRows } = useFrameCatalog({
    location,
    operation: operationFilter,
    manufacturers: effectiveManufacturers,
  });
  const { rows: allRows } = useFrameCatalog({ manufacturers: effectiveManufacturers });
  const roster = useManufacturerRoster("frame_types");
  const openFilters = useOpenManufacturerFilters();
  const [filterCleared, setFilterCleared] = useState(false);
  const visible = filterCleared ? allRows : filteredRows;
  const excluded = !filterCleared && filteredRows.length < totalRows;
  const triggerLabel = currentName ?? "Pick a frame…";

  if (disabled) {
    return (
      <div
        className="aperture-picker aperture-picker--disabled"
        data-testid={`frame-picker-${side}`}
      >
        <span className="aperture-picker__label">{triggerLabel}</span>
      </div>
    );
  }

  return (
    <details className="aperture-picker" data-testid={`frame-picker-${side}`}>
      <summary className="aperture-picker__trigger">{triggerLabel}</summary>
      <div className="aperture-picker__panel" role="listbox">
        {visible.length === 0 && (
          <div className="aperture-picker__empty">No catalog frames available.</div>
        )}
        {visible.map((row) => (
          <button
            key={row.id}
            type="button"
            className="aperture-picker__option"
            onClick={() => onPick(catalogRowToFrameRef(row))}
            data-testid={`frame-picker-${side}-option-${row.id}`}
          >
            <strong>{row.name}</strong>
            <FrameOptionSecondaryLine row={row} />
          </button>
        ))}
        <hr className="aperture-picker__separator" />
        <button
          type="button"
          className="aperture-picker__option aperture-picker__option--hand-enter"
          onClick={() => onPick(blankHandEnterFrameRef())}
          data-testid={`frame-picker-${side}-hand-enter`}
        >
          + Hand-enter
        </button>
        {excluded && (
          <div className="aperture-picker__footer">
            Showing {filteredRows.length} of {totalRows} frames ·{" "}
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

function distinctManufacturers(rows: CatalogFrameType[]): number {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.manufacturer && r.manufacturer.trim()) set.add(r.manufacturer.trim().toLowerCase());
  }
  return set.size;
}

function FrameOptionSecondaryLine({ row }: { row: CatalogFrameType }) {
  const parts: string[] = [];
  if (row.manufacturer) parts.push(row.manufacturer);
  if (row.location) parts.push(row.location);
  if (row.operation) parts.push(row.operation);
  if (parts.length === 0) return null;
  return <small className="aperture-picker__option-meta">{parts.join(" · ")}</small>;
}
