import { useMemo, useState } from "react";
import {
  formatConductivityFromWmK,
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  formatTemperatureFromC,
  formatVaporMu,
  formatVaporSd,
  useUnitPreference,
  type UnitSystem,
} from "../../../lib/units";
import { formatNumberWithUnit } from "../../../lib/units/format";
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
import { formatCondensationPercent } from "../condensation-format";
import type { AssemblyCondensationResponse } from "../condensation-types";
import type { Assembly, ProjectMaterial } from "../types";

const GRAINS_FT2_PER_G_M2 = 1.433076;
const GRAINS_FT2_PER_KG_M2 = GRAINS_FT2_PER_G_M2 * 1000;

export function CondensationNumbersPanel({
  assembly,
  materials,
  result,
}: {
  assembly: Assembly;
  materials: ProjectMaterial[];
  result: AssemblyCondensationResponse;
}) {
  const { unitSystem } = useUnitPreference();
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
  const layerColumnDefs = useMemo(() => layerColumns(unitSystem), [unitSystem]);
  const monthlyColumnDefs = useMemo(() => monthlyColumns(unitSystem), [unitSystem]);
  const interfaceColumnDefs = useMemo(() => interfaceColumns(unitSystem), [unitSystem]);

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
          columnDefs={layerColumnDefs}
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
          columnDefs={monthlyColumnDefs}
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
          columnDefs={interfaceColumnDefs}
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

const LAYER_FIELDS = fields([
  ["layer", "Layer"],
  ["material", "Material"],
  ["thickness", "d", "number"],
  ["conductivity", "λ", "number"],
  ["resistance", "R", "number"],
  ["vapor_mu", "µ / permeability", "number"],
  ["vapor_sd", "sd / permeance", "number"],
  ["temperature", "θ", "number"],
  ["psat", "psat", "number"],
  ["pv", "pv", "number"],
  ["rh", "RH", "number"],
]);

const MONTHLY_FIELDS = fields([
  ["month", "Month", "number"],
  ["gc", "gc", "number"],
  ["delta_ma", "ΔMa", "number"],
  ["ma", "Ma", "number"],
  ["interface_count", "Interfaces", "number"],
  ["surface", "Surface"],
  ["mold", "Mould"],
  ["frsi", "fRsi"],
  ["interstitial", "Interstitial"],
]);

const INTERFACE_FIELDS = fields([
  ["month", "Month", "number"],
  ["interface", "Interface"],
  ["gc", "gc", "number"],
  ["delta_ma", "ΔMa", "number"],
  ["ma", "Ma", "number"],
]);

function fields(items: [string, string, FieldDef["field_type"]?][]): FieldDef[] {
  return items.map(([field_key, display_name, fieldType = "text"]) => ({
    field_key,
    field_type: fieldType,
    display_name,
    read_only: true,
    built_in: true,
    locked: ALL_FIELD_LOCKS,
  }));
}

function layerColumns(unitSystem: UnitSystem): DataTableColumnDef<CondensationLayerRow>[] {
  const options = { unitSystem };
  return [
    column("layer", "Layer", (row) => row.layer, 100, true),
    column("material", "Material", (row) => row.material, 180),
    numericColumn(
      "thickness",
      "d",
      (row) => row.thicknessMm,
      (row) => formatLengthFromMm(row.thicknessMm, options),
      105,
    ),
    numericColumn(
      "conductivity",
      "λ",
      (row) => row.conductivityWmK,
      (row) => formatConductivityFromWmK(row.conductivityWmK, options),
      140,
    ),
    numericColumn(
      "resistance",
      "R",
      (row) => row.resistanceM2KW,
      (row) => formatRValueFromM2KPerW(row.resistanceM2KW, options),
      130,
    ),
    numericColumn(
      "vapor_mu",
      "µ",
      (row) => row.vaporMu,
      (row) => formatVaporMu(row.vaporMu, options),
      110,
    ),
    numericColumn(
      "vapor_sd",
      "sd",
      (row) => row.vaporSdM,
      (row) => formatVaporSd(row.vaporSdM, options),
      110,
    ),
    numericColumn(
      "temperature",
      "θ",
      (row) => row.temperatureC,
      (row) => formatTemperatureFromC(row.temperatureC, options),
      100,
    ),
    numericColumn(
      "psat",
      "psat",
      (row) => row.saturationPressurePa,
      (row) => formatPressure(row.saturationPressurePa),
      105,
    ),
    numericColumn(
      "pv",
      "pv",
      (row) => row.vaporPressurePa,
      (row) => formatPressure(row.vaporPressurePa),
      105,
    ),
    numericColumn(
      "rh",
      "RH",
      (row) => row.relativeHumidity,
      (row) => formatCondensationPercent(row.relativeHumidity),
      90,
    ),
  ];
}

function monthlyColumns(unitSystem: UnitSystem): DataTableColumnDef<CondensationMonthlyRow>[] {
  return [
    numericColumn(
      "month",
      "Month",
      (row) => row.month,
      (row) => row.monthName,
      110,
      true,
    ),
    numericColumn(
      "gc",
      "gc",
      (row) => row.condensationRateKgM2S,
      (row) => formatRate(row.condensationRateKgM2S, unitSystem),
      150,
    ),
    numericColumn(
      "delta_ma",
      "ΔMa",
      (row) => row.moistureChangeGM2,
      (row) => formatMass(row.moistureChangeGM2, unitSystem),
      120,
    ),
    numericColumn(
      "ma",
      "Ma",
      (row) => row.accumulatedMoistureGM2,
      (row) => formatMass(row.accumulatedMoistureGM2, unitSystem),
      120,
    ),
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
}

function interfaceColumns(unitSystem: UnitSystem): DataTableColumnDef<CondensationInterfaceRow>[] {
  return [
    numericColumn(
      "month",
      "Month",
      (row) => row.month,
      (row) => row.monthName,
      110,
      true,
    ),
    column("interface", "Interface", (row) => row.interface, 240),
    numericColumn(
      "gc",
      "gc",
      (row) => row.condensationRateKgM2S,
      (row) => formatRate(row.condensationRateKgM2S, unitSystem),
      150,
    ),
    numericColumn(
      "delta_ma",
      "ΔMa",
      (row) => row.moistureChangeGM2,
      (row) => formatMass(row.moistureChangeGM2, unitSystem),
      120,
    ),
    numericColumn(
      "ma",
      "Ma",
      (row) => row.accumulatedMoistureGM2,
      (row) => formatMass(row.accumulatedMoistureGM2, unitSystem),
      120,
    ),
  ];
}

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

function formatPressure(value: number): string {
  return formatNumberWithUnit(value, "Pa", { unitSystem: "SI", fractionDigits: 0 });
}

function formatMass(valueGM2: number, unitSystem: UnitSystem): string {
  return unitSystem === "IP"
    ? formatNumberWithUnit(valueGM2 * GRAINS_FT2_PER_G_M2, "gr/ft²", {
        unitSystem,
        fractionDigits: 1,
      })
    : formatNumberWithUnit(valueGM2, "g/m²", { unitSystem, fractionDigits: 1 });
}

function formatRate(valueKgM2S: number, unitSystem: UnitSystem): string {
  const value = unitSystem === "IP" ? valueKgM2S * GRAINS_FT2_PER_KG_M2 : valueKgM2S;
  return `${value.toExponential(3)} ${unitSystem === "IP" ? "gr/(ft²·s)" : "kg/(m²·s)"}`;
}
