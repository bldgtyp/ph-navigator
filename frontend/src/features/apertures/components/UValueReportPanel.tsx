import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  formatAreaFromM2,
  formatHeatFlowFromWK,
  formatLengthFromMm,
  formatLinearPsiFromWmK,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import {
  lengthUnitLabel,
  psiUnitLabel,
  uValueUnitLabel,
} from "../../catalogs/components/unit-labels";
import { ReportTable, type ReportTableColumn } from "../../../shared/ui/report-table";
import { formatWindowUValue } from "../format-u-value";
import type {
  ApertureUValueReport,
  ApertureUValueReportEdge,
  ApertureUValueReportElement,
  ApertureUValueReportSection,
} from "../hooks/useApertureUValueReport";
import type { ApertureUValueWarning } from "../hooks/useApertureUValues";
import "./UValueReportPanel.css";

const SIDE_LABEL = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
} as const;

export function UValueReportPanel({
  report,
  builderPath,
  canEdit,
}: {
  report: ApertureUValueReport;
  builderPath: string;
  canEdit: boolean;
}) {
  const { unitSystem } = useUnitPreference();
  const [expandedElementId, setExpandedElementId] = useState<string | null>(null);
  const formats = useMemo(() => makeFormats(unitSystem), [unitSystem]);

  if (report.apertures.length === 0) {
    return (
      <section className="u-value-report__empty" role="status">
        <h2>No apertures yet</h2>
        <p>Add an aperture type to generate its line-by-line U-value report.</p>
        {canEdit ? <Link to={builderPath}>Open Apertures builder</Link> : null}
      </section>
    );
  }

  const summaryColumns: ReportTableColumn<ApertureUValueReportSection>[] = [
    {
      key: "name",
      header: "Aperture",
      primary: true,
      width: "minmax(150px, 1.6fr)",
      render: (row) => row.name,
    },
    {
      key: "dimensions",
      header: "Overall W × H",
      unit: formats.lengthUnit,
      width: "minmax(120px, 1.1fr)",
      render: (row) => formats.dimensions(row.overall_width_m, row.overall_height_m),
    },
    {
      key: "elements",
      header: "Elements",
      numeric: true,
      width: "80px",
      render: (row) => row.element_count,
    },
    {
      key: "area",
      header: "Area",
      unit: formats.areaUnit,
      numeric: true,
      width: "100px",
      render: (row) => formats.area(row.total_area_m2),
    },
    {
      key: "u",
      header: "U-w",
      unit: formats.uUnit,
      numeric: true,
      width: "110px",
      render: (row) => formats.u(row.window_u_value_w_m2k),
    },
    {
      key: "shgc",
      header: "SHGC (glazing-area-wt)",
      numeric: true,
      width: "150px",
      render: (row) => formats.number(row.shgc_glazing_area_weighted, 3),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (row) =>
        row.unfinished_count > 0 ? (
          <span className="u-value-report__warning">{row.unfinished_count} unfinished</span>
        ) : (
          <span className="u-value-report__complete">Complete</span>
        ),
    },
  ];

  const elementColumns = makeElementColumns(formats);

  return (
    <section className="u-value-report" aria-label="Aperture U-Value report">
      <header className="u-value-report__header">
        <div>
          <h2>U-Value Detail Report</h2>
          <p>{reportLegend(report.provenance.generated_note)}</p>
        </div>
        <span>{report.source === "draft" ? "Current draft" : report.provenance.version_label}</span>
      </header>

      <div className="u-value-report__table-scroll">
        <ReportTable
          rows={report.apertures}
          columns={summaryColumns}
          getRowId={(row) => row.aperture_type_id}
        />
      </div>

      <div className="u-value-report__sections">
        {report.apertures.map((section) => (
          <section
            key={section.aperture_type_id}
            className="u-value-report__section"
            aria-label={`${section.name} U-Value details`}
          >
            <header className="u-value-report__section-header">
              <div>
                <h3>{section.name}</h3>
                <span>
                  {section.element_count} glazed element
                  {section.element_count === 1 ? "" : "s"}
                  {section.void_count > 0
                    ? ` · ${section.void_count} void panel${
                        section.void_count === 1 ? "" : "s"
                      } excluded`
                    : ""}
                </span>
              </div>
              {section.unfinished_count > 0 ? (
                <p role="note">
                  Includes {section.unfinished_count} unfinished element
                  {section.unfinished_count === 1 ? "" : "s"} as U = 0.
                </p>
              ) : null}
            </header>
            <div className="u-value-report__table-scroll">
              <ReportTable
                rows={section.elements}
                columns={elementColumns}
                getRowId={(row) => row.element_id}
                expandedRowId={expandedElementId}
                onToggleExpand={(id) =>
                  setExpandedElementId((current) => (current === id ? null : id))
                }
                renderExpansion={(row) => (
                  <EdgeBreakdown edges={row.edges} warnings={row.warnings} formats={formats} />
                )}
                emptyMessage="No glazed elements"
              />
            </div>
            <footer className="u-value-report__section-footer">
              <span>Total area: {formats.area(section.total_area_m2, true)}</span>
              <strong>
                {formatWindowUValue(
                  section.window_u_value_w_m2k,
                  unitSystem === "IP" ? "ip" : "si",
                )}
              </strong>
            </footer>
          </section>
        ))}
      </div>
    </section>
  );
}

type Formats = ReturnType<typeof makeFormats>;

function makeFormats(unitSystem: "SI" | "IP") {
  const options = { unitSystem, empty: "—", showUnit: false } as const;
  return {
    lengthUnit: lengthUnitLabel(unitSystem),
    areaUnit: unitSystem === "IP" ? "ft²" : "m²",
    uUnit: uValueUnitLabel(unitSystem),
    psiUnit: psiUnitLabel(unitSystem),
    qUnit: unitSystem === "IP" ? "Btu/(h·°F)" : "W/K",
    length: (value: number | null) =>
      formatLengthFromMm(value === null ? null : value * 1000, options),
    dimensions: (width: number, height: number) =>
      `${formatLengthFromMm(width * 1000, options)} × ${formatLengthFromMm(
        height * 1000,
        options,
      )}`,
    area: (value: number | null, showUnit = false) =>
      formatAreaFromM2(value, { ...options, showUnit }),
    u: (value: number | null) => formatUValueFromWm2K(value, options),
    psi: (value: number | null) => formatLinearPsiFromWmK(value, options),
    q: (value: number | null) => formatHeatFlowFromWK(value, options),
    number: (value: number | null, digits = 2) =>
      value === null || !Number.isFinite(value) ? "—" : value.toFixed(digits),
  };
}

function reportLegend(generatedNote: string): string {
  const convention = "edges as seen from outside";
  const note = generatedNote.replace(new RegExp(`\\s*·\\s*${convention}$`, "i"), "");
  return `Edges as seen from outside · ${note}`;
}

function makeElementColumns(formats: Formats): ReportTableColumn<ApertureUValueReportElement>[] {
  const result = (row: ApertureUValueReportElement, text: string) => (row.unfinished ? "—" : text);
  return [
    {
      key: "name",
      header: "Element",
      primary: true,
      width: "minmax(130px, 1.5fr)",
      render: (row) => {
        const rowWarnings = row.warnings.filter((warning) => warning.side === null);
        return (
          <span className={row.unfinished ? "u-value-report__unfinished" : undefined}>
            <span>{row.element_name}</span>
            {rowWarnings.length > 0 ? (
              <small className="u-value-report__row-warning">
                {rowWarnings.map((warning) => warning.message).join(" ")}
              </small>
            ) : null}
          </span>
        );
      },
    },
    { key: "grid", header: "Grid", width: "75px", render: (row) => row.grid_label },
    {
      key: "dimensions",
      header: "W × H",
      unit: formats.lengthUnit,
      width: "120px",
      render: (row) => formats.dimensions(row.width_m, row.height_m),
    },
    {
      key: "area",
      header: "Area",
      unit: formats.areaUnit,
      numeric: true,
      width: "90px",
      render: (row) => formats.area(row.area_m2),
    },
    {
      key: "glazing",
      header: "Glazing / U / SHGC",
      width: "minmax(170px, 1.4fr)",
      render: (row) =>
        row.glazing_name
          ? `${row.glazing_name} · ${formats.u(row.glazing_u_w_m2k)} · ${formats.number(
              row.glazing_g_value,
              3,
            )}`
          : "—",
    },
    {
      key: "ag",
      header: "A-glazing",
      unit: formats.areaUnit,
      numeric: true,
      width: "95px",
      render: (row) => result(row, formats.area(row.glazing_area_m2)),
    },
    {
      key: "af",
      header: "A-frame",
      unit: formats.areaUnit,
      numeric: true,
      width: "90px",
      render: (row) => result(row, formats.area(row.frame_area_m2)),
    },
    {
      key: "qg",
      header: "Q-glazing",
      unit: formats.qUnit,
      numeric: true,
      width: "95px",
      render: (row) => result(row, formats.q(row.q_glazing_w_k)),
    },
    {
      key: "qf",
      header: "Q-frame",
      unit: formats.qUnit,
      numeric: true,
      width: "90px",
      render: (row) => result(row, formats.q(row.q_frame_total_w_k)),
    },
    {
      key: "qpsi",
      header: "Q-spacer",
      unit: formats.qUnit,
      numeric: true,
      width: "95px",
      render: (row) => result(row, formats.q(row.q_spacer_total_w_k)),
    },
    {
      key: "u",
      header: "U-element",
      unit: formats.uUnit,
      numeric: true,
      width: "110px",
      render: (row) => (row.unfinished ? "—" : formats.u(row.u_value_w_m2k)),
    },
  ];
}

function EdgeBreakdown({
  edges,
  warnings,
  formats,
}: {
  edges: ApertureUValueReportEdge[];
  warnings: ApertureUValueWarning[];
  formats: Formats;
}) {
  const columns: ReportTableColumn<ApertureUValueReportEdge>[] = [
    {
      key: "side",
      header: "Edge",
      primary: true,
      width: "70px",
      render: (row) => SIDE_LABEL[row.side],
    },
    {
      key: "frame",
      header: "Frame",
      width: "minmax(120px, 1.4fr)",
      render: (row) => {
        const edgeWarnings = warnings.filter((warning) => warning.side === row.side);
        return (
          <span>
            <span>{row.frame_name ?? "—"}</span>
            {edgeWarnings.length > 0 ? (
              <small className="u-value-report__row-warning">
                {edgeWarnings.map((warning) => warning.message).join(" ")}
              </small>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "width",
      header: "Width",
      unit: formats.lengthUnit,
      numeric: true,
      render: (row) => formats.length(row.width_m),
    },
    {
      key: "uf",
      header: "U-f",
      unit: formats.uUnit,
      numeric: true,
      render: (row) => formats.u(row.u_value_w_m2k),
    },
    {
      key: "psi",
      header: "Ψ-g",
      unit: formats.psiUnit,
      numeric: true,
      render: (row) => formats.psi(row.psi_g_w_mk),
    },
    {
      key: "install",
      header: "Ψ-install (excluded from U-w)",
      unit: formats.psiUnit,
      numeric: true,
      width: "150px",
      render: (row) => formats.psi(row.psi_install_w_mk),
    },
    {
      key: "lengths",
      header: "Edge / interior L",
      unit: formats.lengthUnit,
      numeric: true,
      width: "120px",
      render: (row) =>
        `${formats.length(row.edge_length_m)} / ${formats.length(row.interior_length_m)}`,
    },
    {
      key: "areas",
      header: "Center / corners / frame A",
      unit: formats.areaUnit,
      numeric: true,
      width: "180px",
      render: (row) =>
        [row.center_strip_area_m2, row.corner_area_a_m2, row.corner_area_b_m2, row.frame_area_m2]
          .map((value) => formats.area(value))
          .join(" / "),
    },
    {
      key: "q",
      header: "Q-frame / Q-spacer",
      unit: formats.qUnit,
      numeric: true,
      width: "135px",
      render: (row) => `${formats.q(row.q_frame_w_k)} / ${formats.q(row.q_spacer_w_k)}`,
    },
  ];
  return (
    <div className="u-value-report__edge-table">
      <ReportTable rows={edges} columns={columns} getRowId={(edge) => edge.side} />
    </div>
  );
}
