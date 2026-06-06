// Bottom-of-picker hint that surfaces a non-default manufacturer filter.
//
// Renders only when the picker is rendering fewer manufacturers than the
// catalog roster — counting *unique* manufacturer names rather than
// rows so a multi-product manufacturer doesn't inflate the visible
// count. The link opens the Configure-filters modal.

export type PickerFilterHintProps = {
  visibleManufacturers: number;
  rosterManufacturers: number;
  onOpenFilters: () => void;
};

export function PickerFilterHint({
  visibleManufacturers,
  rosterManufacturers,
  onOpenFilters,
}: PickerFilterHintProps) {
  if (rosterManufacturers === 0) return null;
  if (visibleManufacturers >= rosterManufacturers) return null;
  return (
    <div className="aperture-picker-filter-hint" role="status">
      <span>
        Showing {visibleManufacturers} of {rosterManufacturers} manufacturers
      </span>
      <button type="button" onClick={onOpenFilters}>
        Adjust filter
      </button>
    </div>
  );
}
