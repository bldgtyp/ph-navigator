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
  areaUnitLabel,
  heatFlowUnitLabel,
  lengthUnitLabel,
  psiUnitLabel,
  uValueUnitLabel,
} from "../../catalogs/components/unit-labels";
import { ReportTable, type ReportTableColumn, StatusPill } from "../../../shared/ui/report-table";
import { needAttentionLabel } from "../../project_document/specification-status";
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
  // Per-aperture, not one id for the whole page: with a single id, opening an
  // element under one aperture silently closed the one you were comparing it
  // against under another.
  const [expandedByAperture, setExpandedByAperture] = useState<Record<string, string | null>>({});
  const formats = useMemo(() => makeFormats(unitSystem), [unitSystem]);

  if (report.apertures.length === 0) {
    return (
      /* The blessed zero-data placeholder. This was a hand-rolled card, which
         also nested a white card inside `.apertures-body`'s white card. */
      <section className="empty-state" role="status">
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
      numeric: true,
      width: "minmax(120px, 1.1fr)",
      render: (row) => formats.dimensions(row.overall_width_m, row.overall_height_m),
    },
    {
      key: "elements",
      header: "Elements",
      // Qualified, and read off the rows themselves: the count must equal the
      // element table below it. `element_count` includes Empty panels, which
      // produce no row and are reported separately.
      unit: "glazed",
      numeric: true,
      width: "80px",
      render: (row) => row.elements.length,
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
      header: "Completeness",
      width: "140px",
      // The shared read-only status pill, so completeness reads the same here
      // as on Glazings/Frames instead of as plain text.
      render: (row) =>
        row.unfinished_count > 0 ? (
          <StatusPill status="needed">{needAttentionLabel(row.unfinished_count)}</StatusPill>
        ) : (
          <StatusPill status="complete">Complete</StatusPill>
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
        {/* Which document this report was generated from — an auditable report
            must say so. The blessed chip, not a bare grey span. */}
        <span className="chip chip--sm chip--outline">
          {report.source === "draft" ? "Current draft" : report.provenance.version_label}
        </span>
      </header>

      <ReportTable
        rows={report.apertures}
        columns={summaryColumns}
        getRowId={(row) => row.aperture_type_id}
      />

      <div className="u-value-report__sections">
        {report.apertures.map((section) => (
          <section
            key={section.aperture_type_id}
            className="u-value-report__section"
            aria-label={`${section.name} U-Value details`}
          >
            <header className="u-value-report__section-header project-section-heading">
              <div>
                <h3>{section.name}</h3>
                {/* Prose, so a <p> — `.project-section-heading span` is that
                    role's mono/uppercase count chip. */}
                <p className="u-value-report__section-meta">
                  {section.elements.length} glazed element
                  {section.elements.length === 1 ? "" : "s"}
                  {section.void_count > 0
                    ? ` · ${section.void_count} Empty panel${
                        section.void_count === 1 ? "" : "s"
                      } excluded`
                    : ""}
                </p>
              </div>
              {section.unfinished_count > 0 ? (
                <p className="u-value-report__section-note" role="note">
                  Includes {section.unfinished_count} element
                  {section.unfinished_count === 1 ? "" : "s"} needing attention as U = 0.
                </p>
              ) : null}
            </header>
            <ReportTable
              rows={section.elements}
              columns={elementColumns}
              getRowId={(row) => row.element_id}
              expandedRowId={expandedByAperture[section.aperture_type_id] ?? null}
              onToggleExpand={(id) =>
                setExpandedByAperture((current) => ({
                  ...current,
                  [section.aperture_type_id]: current[section.aperture_type_id] === id ? null : id,
                }))
              }
              renderExpansion={(row) => (
                <EdgeBreakdown edges={row.edges} warnings={row.warnings} formats={formats} />
              )}
              emptyMessage="No glazed elements"
            />
            {/* Restates the aperture's own summary row, so it must use the
                same formatters — the Builder's chip formatter rounds U-w to
                2dp and printed a different number than the U-w column above
                for the very same aperture. */}
            <footer className="u-value-report__section-footer">
              <span>
                Total area: {formats.area(section.total_area_m2)} {formats.areaUnit}
              </span>
              <strong>
                U-w: {formats.u(section.window_u_value_w_m2k)} {formats.uUnit}
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
    // All labels come from the shared vocabulary. Hand-written superscript
    // variants ("m²", "Btu/(h·°F)") put two spellings of the same unit in one
    // header row, next to the ASCII ones the formatters actually emit.
    lengthUnit: lengthUnitLabel(unitSystem),
    areaUnit: areaUnitLabel(unitSystem),
    uUnit: uValueUnitLabel(unitSystem),
    psiUnit: psiUnitLabel(unitSystem),
    qUnit: heatFlowUnitLabel(unitSystem),
    length: (value: number | null) =>
      formatLengthFromMm(value === null ? null : value * 1000, options),
    dimensions: (width: number, height: number) =>
      `${formatLengthFromMm(width * 1000, options)} × ${formatLengthFromMm(
        height * 1000,
        options,
      )}`,
    area: (value: number | null) => formatAreaFromM2(value, options),
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
      numeric: true,
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
    // One value per column, like every other column here — a composite cell
    // hid the g-value behind an ellipsis as soon as the glazing name was long.
    {
      key: "glazing",
      header: "Glazing",
      width: "minmax(160px, 1.4fr)",
      render: (row) => row.glazing_name ?? "—",
    },
    {
      key: "glazing-u",
      header: "U-g",
      unit: formats.uUnit,
      numeric: true,
      width: "100px",
      render: (row) => formats.u(row.glazing_u_w_m2k),
    },
    {
      key: "glazing-g",
      header: "g-value",
      numeric: true,
      width: "85px",
      render: (row) => formats.number(row.glazing_g_value, 3),
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
