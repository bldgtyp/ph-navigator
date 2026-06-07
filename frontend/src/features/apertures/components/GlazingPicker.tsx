// Glazing picker — catalog-only autocomplete sibling of ``FramePicker``.

import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import type { CatalogGlazingType } from "../../catalogs/types";
import type { GlazingRef } from "../types";
import { useGlazingCatalog } from "../hooks/useGlazingCatalog";
import { useManufacturerFilter } from "../hooks/useManufacturerFilter";
import { catalogRowToGlazingRef } from "../ref-builders";

export type GlazingPickerProps = {
  currentName: string | null;
  currentCatalogId?: string | null;
  disabled?: boolean;
  manufacturers?: string[];
  onPick: (glazing: GlazingRef) => void;
};

export function GlazingPicker({
  currentName,
  currentCatalogId,
  disabled = false,
  manufacturers,
  onPick,
}: GlazingPickerProps) {
  const contextFilter = useManufacturerFilter("glazing_types");
  const effectiveManufacturers = manufacturers ?? contextFilter;
  const { rows: filteredRows } = useGlazingCatalog({
    manufacturers: effectiveManufacturers,
  });
  const { rows: allRows } = useGlazingCatalog();
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
    description: glazingOptionDescription(row),
  }));

  return (
    <div className="aperture-picker" data-testid="glazing-picker">
      <AutocompleteSelect
        aria-label="Glazing"
        className="aperture-picker__autocomplete"
        compact
        disabled={disabled}
        emptyMessage="No catalog glazings available."
        placeholder={currentName ?? "Pick a glazing..."}
        value={currentCatalogId ?? ""}
        options={options}
        onChange={(rowId) => {
          const row = optionRows.find((candidate) => candidate.id === rowId);
          if (row) onPick(catalogRowToGlazingRef(row));
        }}
      />
    </div>
  );
}

function glazingOptionDescription(row: CatalogGlazingType): string | undefined {
  const parts: string[] = [];
  if (row.manufacturer) parts.push(row.manufacturer);
  if (row.u_value_w_m2k != null) parts.push(`U=${row.u_value_w_m2k.toFixed(2)}`);
  if (row.g_value != null) parts.push(`g=${row.g_value.toFixed(2)}`);
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}
