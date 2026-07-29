import { AccumulatedMoistureChart } from "./CondensationCharts";
import type {
  AssemblyCondensationResponse,
  CondensationCaveat,
  CondensationCriterion,
} from "../condensation-types";
import { formatNumberWithUnit } from "../../../lib/units/format";

const CRITERIA: {
  key: keyof NonNullable<AssemblyCondensationResponse["criteria"]>;
  label: string;
}[] = [
  { key: "surface_condensation", label: "Surface condensation" },
  { key: "mold_growth", label: "Mould growth" },
  { key: "frsi", label: "fRsi" },
  { key: "interstitial", label: "Interstitial accumulation" },
];

export function CondensationVerdictPanel({ result }: { result: AssemblyCondensationResponse }) {
  const criteria = result.criteria;
  const multipleInterfaces = result.caveats.some(
    (caveat) => caveat.code === "multiple_condensing_interfaces",
  );
  const worstPath = result.path_summaries.find((path) => path.path_id === result.worst_path_id);

  return (
    <div className="condensation-verdict">
      <div className="condensation-verdict__lead">
        <h3>{verdictSentence(result)}</h3>
        {result.paths_evaluated > 1 && worstPath ? <p>Worst path: {worstPath.label}</p> : null}
        {multipleInterfaces ? (
          <p>
            {result.interface_count} interfaces carry moisture; a precise accumulated-moisture
            headline is not reliable.
          </p>
        ) : (
          <p>
            Peak accumulated moisture: {formatMass(result.peak_accumulated_moisture_g_m2)} ·
            selected limit {formatMass(result.settings.ma_limit_g_m2)}
          </p>
        )}
      </div>

      {result.caveats.length > 0 ? (
        <div className="condensation-caveats" aria-label="Method caveats">
          {result.caveats.map((caveat) => (
            <CaveatCallout
              key={`${caveat.code}-${caveat.material_ids.join("-")}`}
              caveat={caveat}
              interfaceCount={result.interface_count}
            />
          ))}
        </div>
      ) : null}

      {criteria ? (
        <div className="condensation-criteria">
          {CRITERIA.map(({ key, label }) => (
            <CriterionTile key={key} label={label} criterion={criteria[key]} />
          ))}
        </div>
      ) : null}

      <AccumulatedMoistureChart result={result} />

      <p className="condensation-method-statement">
        ISO 13788 monthly steady-state assessment. It ignores capillary and sorption effects,
        driving rain, and air leakage — which typically moves more moisture than diffusion does.
      </p>
    </div>
  );
}

function CriterionTile({ label, criterion }: { label: string; criterion: CondensationCriterion }) {
  return (
    <article className="condensation-criterion">
      <div className="condensation-criterion__heading">
        <h4>{label}</h4>
        <span
          className="chip chip--sm condensation-criterion__chip"
          data-tone={criterion.is_clear ? "success" : "warning"}
        >
          {criterion.is_clear ? "Clear" : "Review"} · {criterion.worst_month_name}
        </span>
      </div>
      {criterion.margin !== null ? <p>{criterionMargin(label, criterion.margin)}</p> : null}
    </article>
  );
}

function CaveatCallout({
  caveat,
  interfaceCount,
}: {
  caveat: CondensationCaveat;
  interfaceCount: number;
}) {
  if (caveat.code === "high_storage_masonry") {
    return (
      <aside className="condensation-caveat" data-kind="high-storage">
        <strong>High-storage masonry</strong>
        <p>
          This screen omits driving rain and material storage effects. It is not sufficient for this
          assembly; use an EN 15026 / WUFI analysis.
        </p>
      </aside>
    );
  }
  if (caveat.code === "multiple_condensing_interfaces") {
    return (
      <aside className="condensation-caveat" data-kind="multiple-interfaces">
        <strong>Multiple condensing interfaces</strong>
        <p>
          {interfaceCount} interfaces were identified. The Glaser result is low-confidence;
          re-design or use a dynamic method rather than relying on a precise Ma value.
        </p>
      </aside>
    );
  }
  return (
    <aside className="condensation-caveat" data-kind="climate">
      <strong>Climate humidity constrained</strong>
      <p>One or more derived monthly relative-humidity values were clamped to a physical range.</p>
    </aside>
  );
}

function verdictSentence(result: AssemblyCondensationResponse): string {
  if (result.verdict === "d1") {
    return "This screen predicts no interstitial condensation over the modelled year.";
  }
  if (result.verdict === "d2") {
    return "This screen predicts seasonal interstitial condensation, with annual dry-out indicated.";
  }
  if (result.verdict === "d3") {
    return "Predicted accumulated moisture rises above the selected limit; review the assembly or model it dynamically.";
  }
  return "Predicted moisture does not dry out over the modelled year; review the assembly or model it dynamically.";
}

function criterionMargin(label: string, margin: number): string {
  if (label === "fRsi") return `Margin: ${margin.toFixed(3)}`;
  if (label === "Interstitial accumulation") return `Limit margin: ${margin.toFixed(1)} g/m²`;
  return `Temperature margin: ${margin.toFixed(1)} K`;
}

function formatMass(value: number | null): string {
  return formatNumberWithUnit(value, "g/m²", { unitSystem: "SI", fractionDigits: 1 });
}
