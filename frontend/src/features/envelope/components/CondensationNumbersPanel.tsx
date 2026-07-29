import { useMemo, useState } from "react";
import { numberUnitsForType, type NumberUnitsConfig } from "../../../lib/units";
import {
  ALL_FIELD_LOCKS,
  DataTable,
  emptyViewState,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
} from "../../../shared/ui/data-table";
import {
  defaultProfileMonth,
  monthByNumber,
  orderedCondensationMonths,
} from "../condensation-chart-data";
import {
  buildCondensationInterfaceRows,
  buildCondensationLayerRows,
  buildCondensationMonthlyRows,
  type CondensationInterfaceRow,
  type CondensationLayerRow,
  type CondensationMonthlyRow,
} from "../condensation-number-data";
import type { AssemblyCondensationResponse } from "../condensation-types";
import type { Assembly, ProjectMaterial } from "../types";

export function CondensationNumbersPanel({
  assembly,
  materials,
  result,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  result: AssemblyCondensationResponse;
}) {
  const [selectedMonth, setSelectedMonth] = useState(() => defaultProfileMonth(result));
  const month = monthByNumber(result, selectedMonth) ?? result.monthly[0] ?? null;
  const layerRows = useMemo(
    () => (month ? buildCondensationLayerRows(assembly, materials, result, month) : []),
    [assembly, materials, month, result],
  );
  const monthlyRows = useMemo(() => buildCondensationMonthlyRows(result), [result]);
  const interfaceRows = useMemo(
    () => buildCondensationInterfaceRows(assembly, materials, result),
    [assembly, materials, result],
  );

  if (!month) {
    return <p className="condensation-risk-empty">No monthly intermediates were returned.</p>;
  }

  return (
    <div className="condensation-numbers">
      <section>
        <header className="condensation-tier-heading">
          <div>
            <h3>Layer intermediates</h3>
            <p>Worst path · temperatures and pressures after each layer.</p>
          </div>
          <label>
            <span>Month</span>
            <select
              aria-label="Numbers month"
              value={month.month}
              onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
            >
              {orderedCondensationMonths(result).map((item) => (
                <option key={item.month} value={item.month}>
                  {item.month_name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <CondensationDataTable
          tableName={`Condensation layers ${month.month_name}`}
          rows={layerRows}
          fieldDefs={LAYER_FIELDS}
          columnDefs={LAYER_COLUMNS}
          emptyMessage="No layer intermediates."
        />
      </section>

      <section>
        <header className="condensation-tier-heading">
          <div>
            <h3>Monthly cycle</h3>
            <p>Net gc, accumulated Ma, active interfaces, and each monthly criterion.</p>
          </div>
        </header>
        <CondensationDataTable
          tableName="Condensation monthly cycle"
          rows={monthlyRows}
          fieldDefs={MONTHLY_FIELDS}
          columnDefs={MONTHLY_COLUMNS}
          emptyMessage="No monthly cycle."
        />
      </section>

      <section>
        <header className="condensation-tier-heading">
          <div>
            <h3>Per-interface breakdown</h3>
            <p>Monthly gc and Ma at each interface carried by the worst path.</p>
          </div>
        </header>
        <CondensationDataTable
          tableName="Condensation interfaces"
          rows={interfaceRows}
          fieldDefs={INTERFACE_FIELDS}
          columnDefs={INTERFACE_COLUMNS}
          emptyMessage="No condensing interfaces."
        />
      </section>
    </div>
  );
}

function CondensationDataTable<TRow extends { id: string }>({
  tableName,
  rows,
  fieldDefs,
  columnDefs,
  emptyMessage,
}: {
  tableName: string;
  rows: TRow[];
  fieldDefs: FieldDef[];
  columnDefs: DataTableColumnDef<TRow>[];
  emptyMessage: string;
}) {
  const [view, setView] = useState<ViewState>(() => emptyViewState());
  return (
    <div className="condensation-data-table">
      <DataTable
        tableName={tableName}
        rows={rows}
        getRowId={condensationRowId}
        fieldDefs={fieldDefs}
        columnDefs={columnDefs}
        view={view}
        onViewChange={setView}
        readOnly
        showViewControls={false}
        canDownloadCsv={false}
        density="compact"
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

function condensationRowId(row: { id: string }): string {
  return row.id;
}

const UNITS = {
  thickness: fixedUnits("length_mm", 1, 2),
  conductivity: fixedUnits("conductivity", 3, 3),
  resistance: fixedUnits("thermal_resistance", 2, 2),
  vaporMu: fixedUnits("vapor_diffusion_resistance", 1, 2),
  vaporSd: fixedUnits("vapor_sd", 2, 2),
  temperature: fixedUnits("temperature", 1, 1),
  pressure: fixedUnits("pressure", 0, 0),
  percentage: fixedUnits("percentage", 1, 1),
  surfaceMass: fixedUnits("surface_mass", 1, 1),
  surfaceMassFlux: fixedUnits("surface_mass_flux", 10, 7),
} satisfies Record<string, NumberUnitsConfig>;

const LAYER_FIELDS = fields([
  ["layer", "Layer"],
  ["material", "Material"],
  ["thickness", "d", "number", UNITS.thickness],
  ["conductivity", "λ", "number", UNITS.conductivity],
  ["resistance", "R", "number", UNITS.resistance],
  ["vapor_mu", "µ / permeability", "number", UNITS.vaporMu],
  ["vapor_sd", "sd / permeance", "number", UNITS.vaporSd],
  ["temperature", "θ", "number", UNITS.temperature],
  ["psat", "psat", "number", UNITS.pressure],
  ["pv", "pv", "number", UNITS.pressure],
  ["rh", "RH", "number", UNITS.percentage],
]);

const MONTHLY_FIELDS = fields([
  ["month", "Month", "number"],
  ["gc", "gc", "number", UNITS.surfaceMassFlux],
  ["delta_ma", "ΔMa", "number", UNITS.surfaceMass],
  ["ma", "Ma", "number", UNITS.surfaceMass],
  ["interface_count", "Interfaces", "number"],
  ["surface", "Surface"],
  ["mold", "Mould"],
  ["frsi", "fRsi"],
  ["interstitial", "Interstitial"],
]);

const INTERFACE_FIELDS = fields([
  ["month", "Month", "number"],
  ["interface", "Interface"],
  ["gc", "gc", "number", UNITS.surfaceMassFlux],
  ["delta_ma", "ΔMa", "number", UNITS.surfaceMass],
  ["ma", "Ma", "number", UNITS.surfaceMass],
]);

function fields(
  items: [string, string, FieldDef["field_type"]?, NumberUnitsConfig?][],
): FieldDef[] {
  return items.map(([field_key, display_name, fieldType = "text", numberUnits]) => ({
    field_key,
    field_type: fieldType,
    display_name,
    ...(numberUnits ? { numberUnits } : {}),
    read_only: true,
    built_in: true,
    locked: ALL_FIELD_LOCKS,
  }));
}

function fixedUnits(
  unit_type: NumberUnitsConfig["unit_type"],
  precision_si: number,
  precision_ip: number,
): NumberUnitsConfig {
  return numberUnitsForType(unit_type, { mode: "fixed", precision_si, precision_ip });
}

const LAYER_COLUMNS: DataTableColumnDef<CondensationLayerRow>[] = [
  column("layer", "Layer", (row) => row.layer, 100, true),
  column("material", "Material", (row) => row.material, 180),
  unitColumn("thickness", "d", (row) => row.thicknessMm, 105),
  unitColumn("conductivity", "λ", (row) => row.conductivityWmK, 140),
  unitColumn("resistance", "R", (row) => row.resistanceM2KW, 130),
  unitColumn("vapor_mu", "µ", (row) => row.vaporMu, 110),
  unitColumn("vapor_sd", "sd", (row) => row.vaporSdM, 110),
  unitColumn("temperature", "θ", (row) => row.temperatureC, 100),
  unitColumn("psat", "psat", (row) => row.saturationPressurePa, 105),
  unitColumn("pv", "pv", (row) => row.vaporPressurePa, 105),
  unitColumn("rh", "RH", (row) => row.relativeHumidity * 100, 90),
];

const MONTHLY_COLUMNS: DataTableColumnDef<CondensationMonthlyRow>[] = [
  numericColumn(
    "month",
    "Month",
    (row) => row.month,
    (row) => row.monthName,
    110,
    true,
  ),
  unitColumn("gc", "gc", (row) => row.condensationRateKgM2S, 150),
  unitColumn("delta_ma", "ΔMa", (row) => row.moistureChangeGM2, 120),
  unitColumn("ma", "Ma", (row) => row.accumulatedMoistureGM2, 120),
  numericColumn(
    "interface_count",
    "Interfaces",
    (row) => row.interfaceCount,
    (row) => String(row.interfaceCount),
    95,
  ),
  column("surface", "Surface", (row) => row.surfaceState, 100),
  column("mold", "Mould", (row) => row.moldState, 100),
  column("frsi", "fRsi", (row) => row.frsiState, 100),
  column("interstitial", "Interstitial", (row) => row.interstitialState, 115),
];

const INTERFACE_COLUMNS: DataTableColumnDef<CondensationInterfaceRow>[] = [
  numericColumn(
    "month",
    "Month",
    (row) => row.month,
    (row) => row.monthName,
    110,
    true,
  ),
  column("interface", "Interface", (row) => row.interface, 240),
  unitColumn("gc", "gc", (row) => row.condensationRateKgM2S, 150),
  unitColumn("delta_ma", "ΔMa", (row) => row.moistureChangeGM2, 120),
  unitColumn("ma", "Ma", (row) => row.accumulatedMoistureGM2, 120),
];

function column<TRow>(
  id: string,
  header: string,
  accessor: (row: TRow) => string,
  defaultWidth: number,
  isIdentifier = false,
): DataTableColumnDef<TRow> {
  return { id, fieldKey: id, header, accessor, defaultWidth, isIdentifier };
}

function numericColumn<TRow>(
  id: string,
  header: string,
  accessor: (row: TRow) => number | null,
  format: (row: TRow) => string,
  defaultWidth: number,
  isIdentifier = false,
): DataTableColumnDef<TRow> {
  return {
    id,
    fieldKey: id,
    header,
    accessor,
    render: (row) => format(row),
    measureText: format,
    defaultWidth,
    isIdentifier,
  };
}

function unitColumn<TRow>(
  id: string,
  header: string,
  accessor: (row: TRow) => number | null,
  defaultWidth: number,
): DataTableColumnDef<TRow> {
  return { id, fieldKey: id, header, accessor, defaultWidth };
}
