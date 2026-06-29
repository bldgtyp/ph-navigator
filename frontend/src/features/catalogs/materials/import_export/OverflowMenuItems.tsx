// Two `<button>` items mounted into the DataTable toolbar's
// `overflowMenuActions` slot. The DataTable's ViewMenuOverflow renders
// them inside its Radix Popover with the same focus/keyboard behavior
// as the built-in Reset-view item.

export type CatalogImportExportMenuProps = {
  onExport: () => void;
  onImport?: () => void;
  exportDisabled?: boolean;
};

export function CatalogImportExportMenu({
  onExport,
  onImport,
  exportDisabled = false,
}: CatalogImportExportMenuProps) {
  return (
    <>
      <button
        type="button"
        className="data-table-overflow-menu-item"
        onClick={onExport}
        disabled={exportDisabled}
      >
        Export JSON
      </button>
      {onImport ? (
        <button type="button" className="data-table-overflow-menu-item" onClick={onImport}>
          Import JSON…
        </button>
      ) : null}
    </>
  );
}
