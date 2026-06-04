// Two `<button>` items mounted into the DataTable toolbar's
// `overflowMenuActions` slot. Mirrors the Materials catalog control.

export type CatalogImportExportMenuProps = {
  onExport: () => void;
  onImport: () => void;
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
      <button type="button" className="data-table-overflow-menu-item" onClick={onImport}>
        Import JSON…
      </button>
    </>
  );
}
