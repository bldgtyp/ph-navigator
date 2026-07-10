import { useContext, type CSSProperties } from "react";
import { formatNumberUnitsDisplay, type NumberUnitsConfig } from "../../../../lib/units";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";
import { COMPUTED_ERROR_MESSAGES, isComputedErrorValue } from "../lib/formula";

export type ComputedCellProps = {
  value: unknown;
  computedType?: "text" | "number";
  numberPrecision?: number;
  // A numeric formula's display unit (D4). When present and the value is a
  // finite number, the (canonical SI) overlay value formats through the same
  // SI/IP path as number cells; `unitSystem` comes from the shared preference
  // context so every table inherits the toggle without per-table wiring.
  numberUnits?: NumberUnitsConfig;
  className?: string;
  style?: CSSProperties;
};

export function ComputedCell({
  value,
  computedType = "text",
  numberPrecision,
  numberUnits,
  className,
  style,
}: ComputedCellProps) {
  const unitSystem = useContext(UnitPreferenceContext)?.unitSystem ?? "SI";
  if (isComputedErrorValue(value)) {
    const message = COMPUTED_ERROR_MESSAGES[value.error];
    return (
      <span
        className={joinClassNames("computed-cell", "computed-cell-error", className)}
        style={style}
        role="img"
        aria-label={`Formula error: ${message}`}
        title={message}
        data-error-code={value.error}
      >
        #ERROR
      </span>
    );
  }
  if (value === null || value === undefined) {
    return (
      <span
        className={joinClassNames("computed-cell", "computed-cell-empty", className)}
        style={style}
        aria-hidden
      />
    );
  }
  return (
    <span className={joinClassNames("computed-cell", className)} style={style}>
      {formatComputedValue(value, computedType, numberPrecision, numberUnits, unitSystem)}
    </span>
  );
}

function formatComputedValue(
  value: unknown,
  computedType: "text" | "number",
  numberPrecision: number | undefined,
  numberUnits: NumberUnitsConfig | undefined,
  unitSystem: "SI" | "IP",
): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    // A unit-tagged numeric formula formats through the SI/IP path (suffix +
    // per-system precision); the plain precision path handles unit-less ones.
    if (numberUnits && Number.isFinite(value)) {
      return formatNumberUnitsDisplay(value, numberUnits, unitSystem);
    }
    if (
      computedType === "number" &&
      numberPrecision !== undefined &&
      numberPrecision >= 0 &&
      Number.isFinite(value)
    ) {
      return value.toFixed(numberPrecision);
    }
    return String(value);
  }
  if (typeof value === "string") return value;
  return String(value);
}

function joinClassNames(...parts: ReadonlyArray<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
