import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, test } from "vitest";
import { ComputedCell } from "../components/ComputedCell";
import { COMPUTED_ERROR_MESSAGES, isComputedErrorValue } from "../lib/formula";
import type { NumberUnitsConfig } from "../../../../lib/units";
import { UnitPreferenceContext } from "../../../../lib/units/preference-context";

const AIRFLOW_UNITS: NumberUnitsConfig = {
  mode: "editable",
  unit_type: "airflow",
  si_unit: "m3_h",
  ip_unit: "cfm",
  precision_si: 1,
  precision_ip: 1,
};

function renderWithUnitSystem(node: ReactElement, unitSystem: "SI" | "IP") {
  return render(
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "local",
        error: null,
        setUnitSystem: () => {},
        toggleUnitSystem: () => {},
      }}
    >
      {node}
    </UnitPreferenceContext.Provider>,
  );
}

describe("ComputedCell", () => {
  test("renders a blank cell for null", () => {
    const { container } = render(<ComputedCell value={null} />);
    const span = container.querySelector(".computed-cell-empty");
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe("");
  });

  test("renders a plain text scalar", () => {
    render(<ComputedCell value="101 — MASTER BEDROOM" />);
    expect(screen.getByText("101 — MASTER BEDROOM")).toBeInTheDocument();
  });

  test("renders a numeric scalar with precision", () => {
    render(<ComputedCell value={42.125} computedType="number" numberPrecision={2} />);
    expect(screen.getByText("42.13")).toBeInTheDocument();
  });

  test("renders a numeric scalar without precision when none given", () => {
    render(<ComputedCell value={42} computedType="number" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("renders a boolean scalar as canonical text", () => {
    const { rerender } = render(<ComputedCell value={true} />);
    expect(screen.getByText("true")).toBeInTheDocument();
    rerender(<ComputedCell value={false} />);
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  test.each([
    "div_by_zero",
    "type_mismatch",
    "missing_ref",
    "fuse_tripped",
    "output_too_long",
  ] as const)("renders the structured error state for %s", (code) => {
    render(<ComputedCell value={{ error: code }} />);
    const errorSpan = screen.getByText("#ERROR");
    expect(errorSpan).toBeInTheDocument();
    expect(errorSpan.getAttribute("aria-label")).toBe(
      `Formula error: ${COMPUTED_ERROR_MESSAGES[code]}`,
    );
    expect(errorSpan.getAttribute("data-error-code")).toBe(code);
    expect(errorSpan.getAttribute("title")).toBe(COMPUTED_ERROR_MESSAGES[code]);
  });

  test("formats a numeric formula value through the unit path per system (Phase 3)", () => {
    // The overlay value is canonical SI (259.7 m³/h); IP flips to cfm.
    const { rerender } = renderWithUnitSystem(
      <ComputedCell value={259.7} computedType="number" numberUnits={AIRFLOW_UNITS} />,
      "SI",
    );
    expect(screen.getByText("259.7")).toBeInTheDocument();
    rerender(
      <UnitPreferenceContext.Provider
        value={{
          unitSystem: "IP",
          source: "local",
          error: null,
          setUnitSystem: () => {},
          toggleUnitSystem: () => {},
        }}
      >
        <ComputedCell value={259.7} computedType="number" numberUnits={AIRFLOW_UNITS} />
      </UnitPreferenceContext.Provider>,
    );
    expect(screen.getByText("152.9")).toBeInTheDocument();
  });

  test("a formula without units still renders a plain number (no regression)", () => {
    renderWithUnitSystem(
      <ComputedCell value={42.5} computedType="number" numberPrecision={1} />,
      "IP",
    );
    expect(screen.getByText("42.5")).toBeInTheDocument();
  });

  test("a formula error overlay is never unit-formatted", () => {
    renderWithUnitSystem(
      <ComputedCell
        value={{ error: "div_by_zero" }}
        computedType="number"
        numberUnits={AIRFLOW_UNITS}
      />,
      "IP",
    );
    expect(screen.getByText("#ERROR")).toBeInTheDocument();
  });

  test("isComputedErrorValue rejects unknown codes and non-objects", () => {
    expect(isComputedErrorValue({ error: "div_by_zero" })).toBe(true);
    expect(isComputedErrorValue({ error: "not_a_real_code" })).toBe(false);
    expect(isComputedErrorValue({})).toBe(false);
    expect(isComputedErrorValue(null)).toBe(false);
    expect(isComputedErrorValue("error")).toBe(false);
  });
});
