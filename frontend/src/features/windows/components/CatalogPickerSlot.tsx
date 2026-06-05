import { useId } from "react";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { OVERRIDE_TRACKER_FIELD, applyUValueOverride } from "../lib";
import { refreshActionLabel } from "../refresh/lib";
import type { RefreshSlotReport } from "../refresh/types";
import type { CatalogPickableRow, PickableRef } from "../types";
import { UValueOverrideInput } from "./UValueOverrideInput";

export function CatalogPickerSlot<TRow extends CatalogPickableRow, TRef extends PickableRef>({
  label,
  ariaLabel,
  testId,
  className,
  value,
  canEdit,
  catalogRows,
  catalogRowsLoading,
  refFromCatalogRow,
  refreshSlot,
  onReviewRefresh,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  testId: string;
  className?: string;
  value: TRef | null;
  canEdit: boolean;
  catalogRows: TRow[];
  catalogRowsLoading: boolean;
  refFromCatalogRow: (row: TRow) => TRef;
  refreshSlot?: RefreshSlotReport | null;
  onReviewRefresh: () => void;
  onChange: (next: TRef | null) => void;
}) {
  const selectId = useId();
  const overrides = value?.catalog_origin?.local_overrides ?? [];
  const refreshLabel = canEdit && refreshSlot ? refreshActionLabel(refreshSlot.state) : null;
  return (
    <div className={className ? `window-slot ${className}` : "window-slot"}>
      <AutocompleteSelect
        id={selectId}
        label={label}
        className="window-slot-picker"
        value={value?.catalog_origin?.catalog_record_id ?? ""}
        disabled={!canEdit || catalogRowsLoading}
        placeholder={catalogRowsLoading ? "Loading catalog..." : "(none)"}
        options={[
          { value: "", label: "(none)" },
          ...catalogRows.map((row) => ({ value: row.id, label: row.name })),
        ]}
        onChange={(recordId) => {
          if (!recordId) {
            onChange(null);
            return;
          }
          const row = catalogRows.find((entry) => entry.id === recordId);
          if (!row) return;
          onChange(refFromCatalogRow(row));
        }}
      />
      {value ? (
        <div className="window-slot-detail">
          {value.catalog_origin ? (
            <span className="catalog-origin-badge" data-testid={testId}>
              Catalog
            </span>
          ) : null}
          {refreshLabel ? (
            <button
              type="button"
              className="text-button refresh-slot-button"
              onClick={onReviewRefresh}
            >
              {refreshLabel}
            </button>
          ) : null}
          <UValueOverrideInput
            value={value.u_value_w_m2k}
            canEdit={canEdit}
            isOverridden={overrides.includes(OVERRIDE_TRACKER_FIELD)}
            onChange={(nextValue) => onChange(applyUValueOverride(value, nextValue))}
            ariaLabel={ariaLabel}
          />
        </div>
      ) : null}
    </div>
  );
}
