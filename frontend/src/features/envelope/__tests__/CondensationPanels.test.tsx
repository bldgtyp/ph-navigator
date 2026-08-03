import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CondensationVerdictPanel } from "../components/CondensationVerdictPanel";
import { CondensationWherePanel } from "../components/CondensationWherePanel";
import {
  condensationAssembly,
  condensationMaterials,
  screenedCondensationResult,
} from "./condensation-test-fixture";

vi.mock("../components/CondensationCharts", () => ({
  AccumulatedMoistureChart: () => <div>Accumulated moisture chart</div>,
  PressureProfileChart: ({ month, axis }: { month: { month_name: string }; axis: string }) => (
    <div>
      Pressure profile · {month.month_name} · Horizontal axis: {axis}
    </div>
  ),
  TemperatureProfileChart: ({ month, axis }: { month: { month_name: string }; axis: string }) => (
    <div>
      Temperature profile · {month.month_name} · Horizontal axis: {axis}
    </div>
  ),
}));

describe("condensation result panels", () => {
  test.each([
    ["d1", "This screen predicts no interstitial condensation over the modelled year."],
    [
      "d2",
      "This screen predicts seasonal interstitial condensation, with annual dry-out indicated.",
    ],
    [
      "d3",
      "Predicted accumulated moisture rises above the selected limit; review the assembly or model it dynamically.",
    ],
    [
      "d4",
      "Predicted moisture does not dry out over the modelled year; review the assembly or model it dynamically.",
    ],
  ] as const)("frames %s as a risk screen without pass/fail copy", (verdict, sentence) => {
    const { container } = render(
      <CondensationVerdictPanel result={screenedCondensationResult({ verdict })} />,
    );

    expect(screen.getByRole("heading", { name: sentence })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b(pass|fail)\b/i);
  });

  test("renders risk framing, criterion states, caveats, and the persistent method statement", () => {
    const result = screenedCondensationResult({
      caveats: [
        { code: "high_storage_masonry", material_ids: ["material-osb"] },
        { code: "multiple_condensing_interfaces", material_ids: [] },
      ],
      interface_count: 2,
    });
    const { container } = render(<CondensationVerdictPanel result={result} />);

    expect(
      screen.getByRole("heading", {
        name: "This screen predicts seasonal interstitial condensation, with annual dry-out indicated.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Worst path: 1: OSB · 2: Wood stud")).toBeInTheDocument();
    expect(screen.getByText("High-storage masonry")).toBeInTheDocument();
    expect(screen.getByText("Multiple condensing interfaces")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Surface condensation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mould growth" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "fRsi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Interstitial accumulation" })).toBeInTheDocument();
    expect(screen.queryByText(/Peak accumulated moisture/)).not.toBeInTheDocument();
    expect(screen.getByText(/ISO 13788 monthly steady-state assessment/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\b(pass|fail)\b/i);
  });

  test("defaults to the worst month and physical thickness, then toggles both profiles to sd", () => {
    render(
      <CondensationWherePanel
        assembly={condensationAssembly}
        materials={condensationMaterials}
        result={screenedCondensationResult()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Profile month" })).toHaveValue("3");
    expect(screen.getByRole("radio", { name: "Real thickness" })).toBeChecked();
    expect(screen.getAllByText(/Horizontal axis: thickness/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("radio", { name: "Vapour resistance (sd)" }));

    expect(screen.getByRole("radio", { name: "Vapour resistance (sd)" })).toBeChecked();
    expect(screen.getAllByText(/Horizontal axis: sd/)).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox", { name: "Profile month" }), {
      target: { value: "1" },
    });
    expect(screen.getAllByText(/January/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pressure profile · January/)).toBeInTheDocument();
  });
});
