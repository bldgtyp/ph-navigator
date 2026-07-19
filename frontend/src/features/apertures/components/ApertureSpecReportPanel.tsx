// @size-exception: planning/features/apertures-glazings-frames-reports/phases/phase-02-wire-and-retire-modal.md
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownAZ, ArrowUpAZ, Group, X } from "lucide-react";
import {
  formatLengthFromMm,
  formatLinearPsiFromWmK,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { AutocompleteSelect } from "../../../shared/ui/AutocompleteSelect";
import { naturalSortByName } from "../../../shared/lib/sort";
import {
  AttachmentChipCell,
  ReportTable,
  StatusDot,
  StatusFilterChips,
  StatusPill,
  type ReportStatusKey,
  type ReportTableColumn,
  type StatusFilterOption,
  type StatusFilterValue,
} from "../../../shared/ui/report-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { useAssetUrls } from "../../assets/hooks";
import {
  DATASHEET_ATTACHMENT_CONFIG,
  SITE_PHOTO_ATTACHMENT_CONFIG,
  uniqueAttachmentAssetIds,
} from "../../assets/lib";
import {
  lengthUnitLabel,
  psiUnitLabel,
  uValueUnitLabel,
} from "../../catalogs/components/unit-labels";
import type { ApertureDriftEntry, DriftTarget } from "../drift-types";
import type {
  ApertureAttachmentChangeArgs,
  ApertureProductCommand,
  ApertureSide,
  ProjectFrameRead,
  ProjectFrameUseSite,
  ProjectGlazingRead,
  ProjectGlazingUseSite,
  SpecificationStatus,
} from "../types";

type ApertureSpecProduct = ProjectGlazingRead | ProjectFrameRead;
type ApertureUseSite = ProjectGlazingUseSite | ProjectFrameUseSite;
type ProductKind = "glazing" | "frame";
type FrameGroupingField = "manufacturer" | "brand";
type FrameGrouping = {
  field: FrameGroupingField;
  direction: "asc" | "desc";
};
type ProductGroup<TProduct> = {
  id: string;
  label: string;
  rows: TProduct[];
};
type UseSiteApertureGroup = {
  id: string;
  name: string;
  sites: ApertureUseSite[];
};
type UseSiteTypeGroup = {
  id: string;
  name: string;
  apertures: UseSiteApertureGroup[];
  siteCount: number;
};

const STATUSES: SpecificationStatus[] = ["missing", "question", "complete", "na"];

const STATUS_LABEL: Record<SpecificationStatus, string> = {
  missing: "Needed",
  question: "Question",
  complete: "Complete",
  na: "N/A",
};

const SIDE_LABEL: Record<ApertureSide, string> = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
};

const PRODUCT_CONFIG = {
  glazing: {
    tableKey: "project_glazings",
    makeUpdateCommand: (
      id: string,
      specification_status: SpecificationStatus,
    ): ApertureProductCommand => ({
      kind: "update_project_glazing",
      project_glazing_id: id,
      specification_status,
    }),
    makeRemoveCommand: (id: string): ApertureProductCommand => ({
      kind: "remove_project_glazing",
      project_glazing_id: id,
    }),
  },
  frame: {
    tableKey: "project_frames",
    makeUpdateCommand: (
      id: string,
      specification_status: SpecificationStatus,
    ): ApertureProductCommand => ({
      kind: "update_project_frame",
      project_frame_id: id,
      specification_status,
    }),
    makeRemoveCommand: (id: string): ApertureProductCommand => ({
      kind: "remove_project_frame",
      project_frame_id: id,
    }),
  },
} as const;

export function ApertureSpecReportPanel<TProduct extends ApertureSpecProduct>({
  rows,
  kind,
  productLabel,
  productColumnLabel,
  emptyMessage,
  projectId,
  isViewer,
  canEdit,
  busy,
  driftEntries,
  onCommand,
  onAttachmentChange,
  onRefreshEntry,
}: {
  rows: TProduct[];
  kind: ProductKind;
  productLabel: string;
  productColumnLabel: string;
  emptyMessage: string;
  projectId: string;
  isViewer: boolean;
  canEdit: boolean;
  busy: boolean;
  driftEntries: ApertureDriftEntry[];
  onCommand: (command: ApertureProductCommand) => void;
  onAttachmentChange: (change: ApertureAttachmentChangeArgs) => Promise<void> | void;
  onRefreshEntry: (entry: ApertureDriftEntry) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [useSitesProductId, setUseSitesProductId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue<ReportStatusKey>>("all");
  const [frameGrouping, setFrameGrouping] = useState<FrameGrouping | null>(() =>
    kind === "frame" ? { field: "manufacturer", direction: "asc" } : null,
  );
  const productConfig = PRODUCT_CONFIG[kind];

  const visibleRows = useMemo(() => {
    const filtered = isViewer
      ? rows.filter((row) => row.specification_status !== "na" && row.use_sites.length > 0)
      : rows;
    return sortProducts(filtered);
  }, [isViewer, rows]);

  const statusCounts = useMemo(() => {
    const counts: Record<SpecificationStatus, number> = {
      missing: 0,
      question: 0,
      complete: 0,
      na: 0,
    };
    for (const row of visibleRows) counts[row.specification_status] += 1;
    return counts;
  }, [visibleRows]);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return visibleRows;
    return visibleRows.filter((row) => row.specification_status === statusFilter);
  }, [statusFilter, visibleRows]);

  const { activeRows, backgroundRows, unusedRows } = useMemo(() => {
    const active: TProduct[] = [];
    const background: TProduct[] = [];
    const unused: TProduct[] = [];
    for (const row of filteredRows) {
      if (row.use_sites.length === 0) unused.push(row);
      else if (row.specification_status === "na") background.push(row);
      else active.push(row);
    }
    return { activeRows: active, backgroundRows: background, unusedRows: unused };
  }, [filteredRows]);

  const driftByProductId = useMemo(() => {
    const entriesByUseSite = indexDriftEntries(driftEntries);
    return new Map(
      visibleRows.map((row) => [row.id, driftEntriesForProduct(row, kind, entriesByUseSite)]),
    );
  }, [driftEntries, kind, visibleRows]);
  const expandedRow = useMemo(
    () => visibleRows.find((row) => row.id === expandedProductId) ?? null,
    [expandedProductId, visibleRows],
  );
  const useSitesRow = useMemo(
    () => visibleRows.find((row) => row.id === useSitesProductId) ?? null,
    [useSitesProductId, visibleRows],
  );
  const assetIds = expandedRow
    ? uniqueAttachmentAssetIds(
        [expandedRow],
        (row) => row.datasheet_asset_ids,
        (row) => row.photo_asset_ids,
      )
    : [];
  const assetUrls = useAssetUrls(projectId, assetIds);
  const assetUrlById = useMemo(
    () => new Map((assetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [assetUrls.data],
  );

  useEffect(() => {
    if (useSitesProductId && !useSitesRow) setUseSitesProductId(null);
  }, [useSitesProductId, useSitesRow]);

  if (visibleRows.length === 0) {
    return (
      <div className="envelope-empty" role="status">
        <h2>No project {productLabel.toLowerCase()}</h2>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const resolvedCount = statusCounts.complete + statusCounts.na;
  const totalCount = visibleRows.length;
  const filterOptions: StatusFilterOption<ReportStatusKey>[] = [
    { value: "all", label: "All", count: totalCount },
    ...STATUSES.map((status) => ({
      value: status,
      status,
      label: STATUS_LABEL[status],
      count: statusCounts[status],
    })),
  ];
  const columns = buildColumns({
    kind,
    productColumnLabel,
    unitSystem,
    canEdit,
    busy,
    onCommand,
  });

  const showActiveSection = activeRows.length > 0 || filteredRows.length === 0;
  const showBackgroundSection =
    backgroundRows.length > 0 || (filteredRows.length === 0 && statusFilter === "na");
  const showUnusedSection = unusedRows.length > 0;

  const renderRowAction = (row: TProduct, unused: boolean) => {
    if (!unused) return null;
    return (
      <button
        type="button"
        className="data-table-toolbar-button data-table-toolbar-button--icon materials-panel__remove-unused"
        aria-label={`Remove unused ${kind} ${row.name}`}
        title={`Remove unused ${kind} from project`}
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          onCommand(productConfig.makeRemoveCommand(row.id));
        }}
      >
        <X size={16} aria-hidden="true" />
      </button>
    );
  };

  const renderTable = (
    tableRows: TProduct[],
    message: string,
    options: { unused?: boolean } = {},
  ) => (
    <ReportTable
      rows={tableRows}
      columns={columns}
      getRowId={(row) => row.id}
      expandedRowId={expandedProductId}
      onToggleExpand={(id) => setExpandedProductId((current) => (current === id ? null : id))}
      emptyMessage={message}
      renderRowAction={canEdit && options.unused ? (row) => renderRowAction(row, true) : undefined}
      renderExpansion={(row) => {
        const rowDriftEntries = driftByProductId.get(row.id) ?? [];
        return (
          <div className="spec-expansion">
            <header className="spec-expansion__header">
              <div>
                <ApertureDriftBadge entries={rowDriftEntries} />
              </div>
            </header>
            <div className="spec-expansion__columns">
              <div className="spec-expansion__left">
                <section className="spec-evidence" aria-label={`${row.name} datasheets`}>
                  <h3>Datasheets</h3>
                  <AttachmentCell
                    projectId={projectId}
                    value={row.datasheet_asset_ids}
                    config={DATASHEET_ATTACHMENT_CONFIG}
                    readOnly={!canEdit || row.specification_status === "na" || busy}
                    assetUrlById={assetUrlById}
                    variant="card"
                    showInlineEmptyButton={canEdit && row.specification_status !== "na"}
                    onChange={(nextAssetIds) =>
                      onAttachmentChange({
                        tableKey: productConfig.tableKey,
                        rowId: row.id,
                        fieldKey: "datasheet_asset_ids",
                        currentAssetIds: row.datasheet_asset_ids,
                        nextAssetIds,
                      })
                    }
                  />
                </section>
                <section className="spec-evidence" aria-label={`${row.name} site photos`}>
                  <h3>Site photos</h3>
                  <AttachmentCell
                    projectId={projectId}
                    value={row.photo_asset_ids}
                    config={SITE_PHOTO_ATTACHMENT_CONFIG}
                    readOnly={!canEdit || row.specification_status === "na" || busy}
                    assetUrlById={assetUrlById}
                    variant="card"
                    showInlineEmptyButton={canEdit && row.specification_status !== "na"}
                    onChange={(nextAssetIds) =>
                      onAttachmentChange({
                        tableKey: productConfig.tableKey,
                        rowId: row.id,
                        fieldKey: "photo_asset_ids",
                        currentAssetIds: row.photo_asset_ids,
                        nextAssetIds,
                      })
                    }
                  />
                </section>
                {row.comments ? <p className="spec-notes">{row.comments}</p> : null}
              </div>
              <div className="spec-expansion__right">
                <section className="spec-evidence" aria-label={`${row.name} use sites`}>
                  <h3>{formatUseSitesCount(row.use_sites.length)}</h3>
                  {row.use_sites.length === 0 ? (
                    <p className="spec-evidence__empty">Not used by an aperture element.</p>
                  ) : (
                    <div className="aperture-use-sites-summary">
                      <p>{summarizeUseSiteGroups(row.use_sites)}</p>
                      <button
                        type="button"
                        className="secondary-button aperture-use-sites-summary__button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setUseSitesProductId(row.id);
                        }}
                      >
                        View
                      </button>
                    </div>
                  )}
                </section>
                {rowDriftEntries.length > 0 ? (
                  <section className="spec-evidence" aria-label={`${row.name} catalog drift`}>
                    <h3>Catalog review</h3>
                    <ul className="spec-expansion__use-sites">
                      {rowDriftEntries.map((entry) => (
                        <li key={`${entry.element_id}:${entry.target}`}>
                          <strong>{entry.element_name}</strong>
                          <span>{formatDriftEntry(entry)}</span>
                          {canEdit && entry.kind === "field_delta" ? (
                            <button
                              type="button"
                              className="text-button"
                              disabled={busy}
                              onClick={() => onRefreshEntry(entry)}
                            >
                              Refresh from catalog
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
  const renderGroupedTables = (
    tableRows: TProduct[],
    message: string,
    options: { unused?: boolean } = {},
  ) => {
    const groups = groupProducts(tableRows, kind === "frame" ? frameGrouping : null);
    if (groups.length === 0) return renderTable(tableRows, message, options);
    return (
      <div className="report-table-groups" role="list">
        {groups.map((group) => (
          <section key={group.id} className="report-table-group" role="listitem">
            <header className="report-table-group__header">
              <span>{group.label}</span>
              <em>
                {group.rows.length}{" "}
                {group.rows.length === 1 ? productColumnLabel.toLowerCase() : productLabel}
              </em>
            </header>
            {renderTable(group.rows, message, options)}
          </section>
        ))}
      </div>
    );
  };

  return (
    <>
      <StatusFilterChips
        options={filterOptions}
        value={statusFilter}
        onChange={setStatusFilter}
        summary={`${resolvedCount}/${totalCount} resolved`}
      />
      {kind === "frame" ? (
        <FrameGroupingToolbar grouping={frameGrouping} onChange={setFrameGrouping} />
      ) : null}
      <div className="materials-panel__sections">
        {showActiveSection ? (
          <section
            className="materials-panel__section"
            aria-labelledby={`${productLabel}-active-heading`}
          >
            <header className="materials-panel__section-header">
              <h2 id={`${productLabel}-active-heading`}>In scope</h2>
              <span>{activeRows.length}</span>
            </header>
            {renderGroupedTables(
              activeRows,
              `No in-scope ${productLabel} match the current filter.`,
            )}
          </section>
        ) : null}
        {showBackgroundSection ? (
          <section
            className="materials-panel__section materials-panel__section--background"
            aria-labelledby={`${productLabel}-background-heading`}
          >
            <header className="materials-panel__section-header">
              <h2 id={`${productLabel}-background-heading`}>N/A</h2>
              <span>{backgroundRows.length}</span>
            </header>
            {renderGroupedTables(
              backgroundRows,
              `No N/A ${productLabel} match the current filter.`,
            )}
          </section>
        ) : null}
        {showUnusedSection ? (
          <section
            className="materials-panel__section materials-panel__section--unused"
            aria-labelledby={`${productLabel}-unused-heading`}
          >
            <header className="materials-panel__section-header">
              <h2 id={`${productLabel}-unused-heading`}>Unused</h2>
              <span>{unusedRows.length}</span>
            </header>
            {renderGroupedTables(
              unusedRows,
              `No unused ${productLabel} match the current filter.`,
              {
                unused: true,
              },
            )}
          </section>
        ) : null}
      </div>
      {useSitesRow ? (
        <ApertureUseSitesDrawer
          row={useSitesRow}
          kind={kind}
          onClose={() => setUseSitesProductId(null)}
        />
      ) : null}
    </>
  );
}

function FrameGroupingToolbar({
  grouping,
  onChange,
}: {
  grouping: FrameGrouping | null;
  onChange: (next: FrameGrouping | null) => void;
}) {
  const fieldValue = grouping?.field ?? "none";
  const direction = grouping?.direction ?? "asc";
  return (
    <div className="report-group-toolbar" role="group" aria-label="Frame grouping controls">
      <div className="report-group-toolbar__label">
        <Group size={15} aria-hidden="true" />
        <span>Group by</span>
      </div>
      <label className="report-group-toolbar__select">
        <span className="sr-only">Frame group field</span>
        <select
          value={fieldValue}
          onChange={(event) => {
            const next = event.target.value;
            onChange(isFrameGroupingField(next) ? { field: next, direction } : null);
          }}
        >
          <option value="manufacturer">Manufacturer</option>
          <option value="brand">Brand</option>
          <option value="none">No grouping</option>
        </select>
      </label>
      <button
        type="button"
        className="report-group-toolbar__direction"
        aria-label={direction === "asc" ? "Sort groups ascending" : "Sort groups descending"}
        disabled={!grouping}
        onClick={() =>
          grouping
            ? onChange({
                ...grouping,
                direction: grouping.direction === "asc" ? "desc" : "asc",
              })
            : undefined
        }
      >
        {direction === "asc" ? (
          <ArrowDownAZ size={15} aria-hidden="true" />
        ) : (
          <ArrowUpAZ size={15} aria-hidden="true" />
        )}
        <span>{direction === "asc" ? "A-Z" : "Z-A"}</span>
      </button>
    </div>
  );
}

function isFrameGroupingField(value: string): value is FrameGroupingField {
  return value === "manufacturer" || value === "brand";
}

function ApertureUseSitesDrawer({
  row,
  kind,
  onClose,
}: {
  row: ApertureSpecProduct;
  kind: ProductKind;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const groups = groupUseSites(row.use_sites);

  return (
    <div className="aperture-use-sites-drawer__backdrop" role="presentation" onClick={onClose}>
      <aside
        className="aperture-use-sites-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aperture-use-sites-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="aperture-use-sites-drawer__header">
          <div>
            <p>{kind === "glazing" ? "Glazing use sites" : "Frame use sites"}</p>
            <h2 id="aperture-use-sites-drawer-title">{row.name}</h2>
            <span>{formatUseSitesCount(row.use_sites.length)}</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close use sites"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="aperture-use-sites-drawer__body">
          {groups.map((group) => (
            <section key={group.id} className="aperture-use-sites-group">
              <header>
                <h3>{group.name}</h3>
                <span>{formatApertureGroupCount(group)}</span>
              </header>
              <ul className="aperture-use-sites-tree">
                {group.apertures.map((aperture) => (
                  <li key={aperture.id} className="aperture-use-sites-aperture">
                    <div className="aperture-use-sites-aperture__header">
                      <span>{aperture.name}</span>
                      <em>{formatNestedUseSiteCount(aperture.sites, kind)}</em>
                    </div>
                    {aperture.sites.some((site) => "side" in site) ? (
                      <ul>
                        {aperture.sites.map((site) => (
                          <li key={formatUseSiteKey(site)}>
                            {"side" in site ? <span>{SIDE_LABEL[site.side]}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

function buildColumns<TProduct extends ApertureSpecProduct>({
  kind,
  productColumnLabel,
  unitSystem,
  canEdit,
  busy,
  onCommand,
}: {
  kind: ProductKind;
  productColumnLabel: string;
  unitSystem: ReturnType<typeof useUnitPreference>["unitSystem"];
  canEdit: boolean;
  busy: boolean;
  onCommand: (command: ApertureProductCommand) => void;
}): ReportTableColumn<TProduct>[] {
  const common: ReportTableColumn<TProduct>[] = [
    {
      key: "product",
      header: productColumnLabel,
      primary: true,
      width: "minmax(180px, 2fr)",
      render: (row) => <span title={row.name}>{row.name}</span>,
    },
    {
      key: "manufacturer",
      header: "Manufacturer",
      width: "minmax(120px, 1.1fr)",
      render: (row) => <span>{row.manufacturer ?? "Unspecified"}</span>,
    },
  ];
  const numeric =
    kind === "glazing" ? glazingColumns<TProduct>(unitSystem) : frameColumns<TProduct>(unitSystem);
  return [
    ...common,
    ...numeric,
    {
      key: "datasheet",
      header: "Datasheet",
      width: "80px",
      render: (row) => (
        <AttachmentChipCell count={row.datasheet_asset_ids.length} noun="datasheet" />
      ),
    },
    {
      key: "site_photos",
      header: "Site photos",
      width: "80px",
      render: (row) => <AttachmentChipCell count={row.photo_asset_ids.length} noun="site photo" />,
    },
    {
      key: "status",
      header: "Status",
      width: "minmax(120px, 1fr)",
      render: (row) => renderStatus(row, kind, canEdit, busy, onCommand),
    },
  ];
}

function glazingColumns<TProduct extends ApertureSpecProduct>(
  unitSystem: ReturnType<typeof useUnitPreference>["unitSystem"],
): ReportTableColumn<TProduct>[] {
  return [
    {
      key: "u_value",
      header: "U-value",
      unit: uValueUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (row) => (
        <span>
          {formatUValueFromWm2K(row.u_value_w_m2k, {
            unitSystem,
            showUnit: false,
            empty: "--",
          })}
        </span>
      ),
    },
    {
      key: "g_value",
      header: "g-value",
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (row) => <span>{formatDecimal((row as ProjectGlazingRead).g_value, 2)}</span>,
    },
  ];
}

function frameColumns<TProduct extends ApertureSpecProduct>(
  unitSystem: ReturnType<typeof useUnitPreference>["unitSystem"],
): ReportTableColumn<TProduct>[] {
  return [
    {
      key: "u_value",
      header: "U-value",
      unit: uValueUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (row) => (
        <span>
          {formatUValueFromWm2K(row.u_value_w_m2k, {
            unitSystem,
            showUnit: false,
            empty: "--",
          })}
        </span>
      ),
    },
    {
      key: "psi_install",
      header: "Psi-install",
      unit: psiUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (row) => (
        <span>
          {formatLinearPsiFromWmK((row as ProjectFrameRead).psi_install_w_mk, {
            unitSystem,
            showUnit: false,
            empty: "--",
          })}
        </span>
      ),
    },
    {
      key: "width",
      header: "Width",
      unit: lengthUnitLabel(unitSystem),
      numeric: true,
      width: "minmax(80px, 0.7fr)",
      render: (row) => (
        <span>
          {formatLengthFromMm((row as ProjectFrameRead).width_mm, {
            unitSystem,
            showUnit: false,
            empty: "--",
          })}
        </span>
      ),
    },
  ];
}

function renderStatus(
  row: ApertureSpecProduct,
  kind: ProductKind,
  canEdit: boolean,
  busy: boolean,
  onCommand: (command: ApertureProductCommand) => void,
): ReactNode {
  if (!canEdit) {
    return (
      <StatusPill status={row.specification_status}>
        {STATUS_LABEL[row.specification_status]}
      </StatusPill>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }}>
      <StatusDot status={row.specification_status} />
      <AutocompleteSelect
        ariaLabel="Status"
        value={row.specification_status}
        disabled={busy}
        compact
        listboxPlacement="portal"
        options={STATUSES.map((status) => ({
          value: status,
          label: STATUS_LABEL[status],
        }))}
        onChange={(nextStatus) => {
          if (isSpecificationStatus(nextStatus)) {
            onCommand(PRODUCT_CONFIG[kind].makeUpdateCommand(row.id, nextStatus));
          }
        }}
      />
    </span>
  );
}

function sortProducts<TProduct extends ApertureSpecProduct>(rows: TProduct[]): TProduct[] {
  return [0, 1, 2, 3].flatMap((priority) =>
    naturalSortByName(rows.filter((row) => productSortPriority(row) === priority)),
  );
}

function groupProducts<TProduct extends ApertureSpecProduct>(
  rows: TProduct[],
  grouping: FrameGrouping | null,
): ProductGroup<TProduct>[] {
  if (!grouping || rows.length === 0) return [];
  const groups = new Map<string, ProductGroup<TProduct>>();
  for (const row of rows) {
    const rawValue = grouping.field === "manufacturer" ? row.manufacturer : row.brand;
    const label = rawValue?.trim() || "Unspecified";
    const id = label.toLocaleLowerCase();
    const group = groups.get(id);
    if (group) group.rows.push(row);
    else groups.set(id, { id, label, rows: [row] });
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.label === "Unspecified") return 1;
    if (b.label === "Unspecified") return -1;
    const result = a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    return grouping.direction === "asc" ? result : -result;
  });
}

function productSortPriority(row: ApertureSpecProduct): number {
  if (row.use_sites.length === 0) return 3;
  if (row.specification_status === "complete") return 1;
  if (row.specification_status === "na") return 2;
  return 0;
}

function driftEntriesForProduct(
  row: ApertureSpecProduct,
  kind: ProductKind,
  entriesByUseSite: ReadonlyMap<string, ApertureDriftEntry[]>,
): ApertureDriftEntry[] {
  return row.use_sites.flatMap((site) => entriesByUseSite.get(driftUseSiteKey(kind, site)) ?? []);
}

function indexDriftEntries(driftEntries: ApertureDriftEntry[]): Map<string, ApertureDriftEntry[]> {
  const entriesByUseSite = new Map<string, ApertureDriftEntry[]>();
  for (const entry of driftEntries) {
    const key = `${entry.element_id}:${entry.target}`;
    const existing = entriesByUseSite.get(key);
    if (existing) existing.push(entry);
    else entriesByUseSite.set(key, [entry]);
  }
  return entriesByUseSite;
}

function driftUseSiteKey(kind: ProductKind, site: ApertureUseSite): string {
  const target: DriftTarget =
    kind === "glazing" ? "glazing" : (`frame.${(site as ProjectFrameUseSite).side}` as DriftTarget);
  return `${site.element_id}:${target}`;
}

function formatUseSiteKey(site: ApertureUseSite): string {
  return "side" in site
    ? `${site.aperture_type_id}:${site.element_id}:${site.side}`
    : `${site.aperture_type_id}:${site.element_id}`;
}

function formatUseSitesCount(count: number): string {
  return `Used in ${count} ${count === 1 ? "element" : "elements"}`;
}

function summarizeUseSiteGroups(sites: ApertureUseSite[]): string {
  const groups = groupUseSites(sites);
  const onlyGroup = groups[0];
  if (groups.length === 1 && onlyGroup) {
    return `Grouped under ${onlyGroup.name} across ${onlyGroup.apertures.length} ${
      onlyGroup.apertures.length === 1 ? "aperture" : "apertures"
    }.`;
  }
  return `Grouped under ${groups.length} aperture types.`;
}

function formatApertureGroupCount(group: UseSiteTypeGroup): string {
  const apertureLabel = group.apertures.length === 1 ? "aperture" : "apertures";
  return `${group.apertures.length} ${apertureLabel} · ${formatUseSitesCount(group.siteCount)}`;
}

function formatNestedUseSiteCount(sites: ApertureUseSite[], kind: ProductKind): string {
  if (kind === "frame") return `${sites.length} ${sites.length === 1 ? "side" : "sides"}`;
  return formatUseSitesCount(sites.length);
}

function groupUseSites(sites: ApertureUseSite[]): UseSiteTypeGroup[] {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      apertures: Map<string, UseSiteApertureGroup>;
      siteCount: number;
    }
  >();
  for (const site of sites) {
    let group = groups.get(site.aperture_type_id);
    if (!group) {
      group = {
        id: site.aperture_type_id,
        name: site.aperture_type_name,
        apertures: new Map(),
        siteCount: 0,
      };
      groups.set(site.aperture_type_id, group);
    }
    group.siteCount += 1;

    const existingAperture = group.apertures.get(site.element_id);
    if (existingAperture) {
      existingAperture.sites.push(site);
    } else {
      group.apertures.set(site.element_id, {
        id: site.element_id,
        name: site.element_name,
        sites: [site],
      });
    }
  }
  return Array.from(groups.values()).map((group) => ({
    id: group.id,
    name: group.name,
    apertures: Array.from(group.apertures.values()),
    siteCount: group.siteCount,
  }));
}

function formatDriftEntry(entry: ApertureDriftEntry): string {
  const target = entry.target.startsWith("frame.")
    ? `Frame ${SIDE_LABEL[entry.target.replace("frame.", "") as ApertureSide]}`
    : "Glazing";
  if (entry.kind === "catalog_row_missing") return `${target} catalog row removed`;
  const count = entry.deltas.length;
  return `${target} · ${count} field${count === 1 ? "" : "s"} differ${count === 1 ? "s" : ""}`;
}

function ApertureDriftBadge({ entries }: { entries: ApertureDriftEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <span className="chip chip--sm material-drift-badge drifted">
      {entries.length} catalog drift{entries.length === 1 ? "" : "s"}
    </span>
  );
}

function formatDecimal(value: number | null | undefined, digits: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(digits);
}

function isSpecificationStatus(value: string): value is SpecificationStatus {
  return (STATUSES as readonly string[]).includes(value);
}
