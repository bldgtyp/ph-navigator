// Which surface-film convention the whole project calculates under.
//
// Project-wide rather than per-assembly, and versioned with the document:
// mixing conventions inside one project would make its U-values incomparable
// with each other. It sits in the tab header for that reason — beside the
// sub-nav, not beside any one assembly's numbers.
import { useThermalStandardsQuery } from "../hooks";
import type { EnvelopeReadSource, ThermalStandard } from "../types";

export function ThermalStandardSelect({
  projectId,
  versionId,
  source,
  canEdit,
  busy,
  onChange,
}: {
  projectId: string;
  versionId: string | null;
  source: EnvelopeReadSource;
  canEdit: boolean;
  busy: boolean;
  onChange: (thermalStandard: ThermalStandard) => void;
}) {
  const { data } = useThermalStandardsQuery(projectId, versionId, source);
  if (!data) return null;

  const active = data.options.find((option) => option.thermal_standard === data.active);
  // A standard with no published table on this deployment is offered as a
  // disabled option rather than hidden: the absence is an operator task, and
  // silently omitting it reads as "PHN does not support ASHRAE".
  const anyUnavailable = data.options.some((option) => !option.available);

  return (
    <label className="thermal-standard-select" title={SURFACE_FILM_HELP}>
      <span className="thermal-standard-select__label">Films</span>
      {canEdit ? (
        <select
          id="envelope-thermal-standard"
          aria-label="Surface film standard"
          value={data.active}
          disabled={busy}
          onChange={(event) => onChange(event.target.value as ThermalStandard)}
        >
          {data.options.map((option) => (
            <option
              key={option.thermal_standard}
              value={option.thermal_standard}
              disabled={!option.available}
            >
              {option.available ? option.label : `${option.label} — not published here`}
            </option>
          ))}
        </select>
      ) : (
        <span data-testid="envelope-thermal-standard-static">{active?.label ?? data.active}</span>
      )}
      {anyUnavailable ? (
        <span className="sr-only">
          Some standards are unavailable because no surface-film table is published on this
          deployment.
        </span>
      ) : null}
    </label>
  );
}

// States the one thing a user cannot infer from the numbers themselves: the
// ventilated/unconditioned rule is ISO's, applied whichever table is loaded.
const SURFACE_FILM_HELP =
  "Which surface-film resistances every U-value in this project is calculated with. " +
  "Changing it moves every assembly. Note that ventilated and unconditioned-space faces " +
  "use the ISO 6946 rule (Rse = Rsi) under any standard.";
