// The section's exterior/interior captions, promoted into the boundary-condition
// affordance (PRD §5). The thing the user already looks at is the thing they
// click — no new chrome.
//
// The two sides are deliberately asymmetric: the exterior condition is the one
// user-selectable axis, while the interior side is fully derived from
// `Assembly.type` and so is read-only here. Changing it means changing the
// assembly type, which already has its own control.
import type { Assembly, AssemblyThermalResponse, ExteriorCondition } from "../types";

const EXTERIOR_CONDITION_OPTIONS: ReadonlyArray<{ value: ExteriorCondition; label: string }> = [
  { value: "outdoor_air", label: "Exterior · Outdoor air" },
  { value: "ventilated", label: "Exterior · Ventilated" },
  { value: "ground", label: "Exterior · Ground" },
  { value: "unconditioned_space", label: "Exterior · Unconditioned space" },
];

const EXTERIOR_CONDITION_LABEL: Record<ExteriorCondition, string> = Object.fromEntries(
  EXTERIOR_CONDITION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ExteriorCondition, string>;

// Selecting this records intent, not extra fidelity: ISO 6946 gives it the same
// surface resistance as a ventilated cavity, and the temperature on the far side
// is not modelled yet. Say so rather than let the choice imply otherwise.
const UNCONDITIONED_SPACE_CAVEAT = "same Rse as ventilated; far-side temp not modelled";
const UNCONDITIONED_SPACE_CAVEAT_FULL =
  "ISO 6946 gives an unconditioned space the same surface resistance as a ventilated cavity. " +
  "The temperature on the far side is not modelled yet, so this records intent rather than extra fidelity.";

export function AssemblyBoundaryLabels({
  assembly,
  thermal,
  canEdit,
  busy,
  widthPx,
  heightPx,
  topPx,
  leftPx,
  onExteriorConditionChange,
}: {
  assembly: Assembly;
  thermal: AssemblyThermalResponse | null;
  canEdit: boolean;
  busy: boolean;
  widthPx: number;
  heightPx: number;
  topPx: number;
  leftPx: number;
  onExteriorConditionChange: (exteriorCondition: ExteriorCondition) => void;
}) {
  const exteriorAtTop = assembly.orientation === "first_layer_outside";

  const exterior = (
    <ExteriorBoundaryLabel
      position={exteriorAtTop ? "top" : "bottom"}
      exteriorCondition={assembly.exterior_condition}
      canEdit={canEdit}
      busy={busy}
      onChange={onExteriorConditionChange}
    />
  );
  const interior = (
    <InteriorBoundaryLabel
      position={exteriorAtTop ? "bottom" : "top"}
      heatFlowDirection={thermal?.heat_flow_direction ?? null}
    />
  );

  return (
    <div
      id="assembly-orientation-labels"
      className="assembly-orientation-labels"
      data-exterior-condition={assembly.exterior_condition}
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
    >
      {/* Face bands make the boundary legible without reading the text — the
          cases most likely to be silently wrong today (ground, ventilated) get
          their own treatment. */}
      <span
        className={`assembly-face-band is-${exteriorAtTop ? "top" : "bottom"} is-exterior`}
        data-condition={assembly.exterior_condition}
        aria-hidden="true"
      />
      <span
        className={`assembly-face-band is-${exteriorAtTop ? "bottom" : "top"} is-interior`}
        aria-hidden="true"
      />
      {exterior}
      {interior}
    </div>
  );
}

function ExteriorBoundaryLabel({
  position,
  exteriorCondition,
  canEdit,
  busy,
  onChange,
}: {
  position: "top" | "bottom";
  exteriorCondition: ExteriorCondition;
  canEdit: boolean;
  busy: boolean;
  onChange: (exteriorCondition: ExteriorCondition) => void;
}) {
  const caveat = exteriorCondition === "unconditioned_space" ? UNCONDITIONED_SPACE_CAVEAT : null;
  return (
    <span className={`assembly-orientation-label is-${position}`}>
      {canEdit ? (
        <select
          id="assembly-exterior-condition"
          className="assembly-boundary-select"
          aria-label="Exterior condition"
          value={exteriorCondition}
          disabled={busy}
          onChange={(event) => onChange(event.target.value as ExteriorCondition)}
        >
          {EXTERIOR_CONDITION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        // Viewers and locked versions see the same words, without the affordance.
        <span data-testid="assembly-exterior-condition-static">
          {EXTERIOR_CONDITION_LABEL[exteriorCondition]}
        </span>
      )}
      {caveat ? (
        <span
          className="assembly-boundary-caveat"
          data-testid="assembly-exterior-caveat"
          title={UNCONDITIONED_SPACE_CAVEAT_FULL}
        >
          {`· ${caveat}`}
        </span>
      ) : null}
    </span>
  );
}

function InteriorBoundaryLabel({
  position,
  heatFlowDirection,
}: {
  position: "top" | "bottom";
  heatFlowDirection: string | null;
}) {
  return (
    <span className={`assembly-orientation-label is-${position}`}>
      {/* Not editable: fully determined by the assembly type. Changing it means
          changing the assembly type, which has its own control. */}
      <span>Interior</span>
      {heatFlowDirection ? (
        <span className="assembly-boundary-caveat" data-testid="assembly-heat-flow-direction">
          {`· ${heatFlowDirection} heat flow`}
        </span>
      ) : null}
    </span>
  );
}
