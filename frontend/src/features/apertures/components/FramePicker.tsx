// Frame picker — catalog-only autocomplete filtered by the slot's
// `location` and the element's `operation`.

import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import type { CatalogFrameType } from "../../catalogs/types";
import type { FrameRef } from "../types";
import type { ApertureSide } from "../types";
import { useFrameCatalog } from "../hooks/useFrameCatalog";
import { useManufacturerFilter } from "../hooks/useManufacturerFilter";
import { locationForSide, operationForElement, type FrameLocation } from "../picker-filters";
import { catalogRowToFrameRef } from "../ref-builders";

export type FramePickerProps = {
  side: ApertureSide;
  operation: import("../types").ApertureOperation | null;
  currentName: string | null;
  currentCatalogId?: string | null;
  disabled?: boolean;
  manufacturers?: string[];
  onPick: (frame: FrameRef) => void;
};

export function FramePicker({
  side,
  operation,
  currentName,
  currentCatalogId,
  disabled = false,
  manufacturers,
  onPick,
}: FramePickerProps) {
  const location: FrameLocation = locationForSide(side);
  const operationFilter = operationForElement(operation).type;
  const contextFilter = useManufacturerFilter("frame_types");
  const effectiveManufacturers = manufacturers ?? contextFilter;
  const { rows: filteredRows } = useFrameCatalog({
    location,
    operation: operationFilter,
    manufacturers: effectiveManufacturers,
  });
  // Unfiltered lookup so the current-value chip survives even when the
  // active manufacturer/location/operation filters would drop it.
  const { rows: allRows } = useFrameCatalog();
  const visible = filteredRows;
  const selectedRow = currentCatalogId
    ? allRows.find((row) => row.id === currentCatalogId)
    : undefined;
  const optionRows =
    selectedRow && !visible.some((row) => row.id === selectedRow.id)
      ? [selectedRow, ...visible]
      : visible;
  const options = optionRows.map((row) => ({
    value: row.id,
    label: row.name,
    description: frameOptionDescription(row),
  }));

  return (
    <div className="aperture-picker" data-testid={`frame-picker-${side}`}>
      <AutocompleteSelect
        aria-label={`${side} frame`}
        className="aperture-picker__autocomplete"
        compact
        disabled={disabled}
        emptyMessage="No catalog frames available."
        placeholder={currentName ?? "Pick a frame..."}
        value={currentCatalogId ?? ""}
        options={options}
        onChange={(rowId) => {
          const row = optionRows.find((candidate) => candidate.id === rowId);
          if (row) onPick(catalogRowToFrameRef(row));
        }}
      />
    </div>
  );
}

function frameOptionDescription(row: CatalogFrameType): string | undefined {
  const parts: string[] = [];
  if (row.manufacturer) parts.push(row.manufacturer);
  if (row.location) parts.push(row.location);
  if (row.operation) parts.push(row.operation);
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}
