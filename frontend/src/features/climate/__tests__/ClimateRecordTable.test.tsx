import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ClimateRecordTable } from "../components/ClimateRecordTable";
import { makeClimateRecord } from "../testing/recordFixture";

describe("ClimateRecordTable", () => {
  test("renders the three series tables with 12 monthly columns", () => {
    render(<ClimateRecordTable record={makeClimateRecord()} unitSystem="SI" />);

    expect(screen.getByText("Monthly temperatures")).toBeInTheDocument();
    expect(screen.getByText("Monthly radiation")).toBeInTheDocument();
    expect(screen.getByText("Design conditions")).toBeInTheDocument();

    // Air row: 1 header cell + 12 month cells.
    const airRow = screen.getByRole("row", { name: /^Air/ });
    expect(within(airRow).getAllByRole("cell")).toHaveLength(12);
  });

  test("temperatures follow the SI/IP toggle (10 °C ⇒ 50 °F)", () => {
    const { rerender } = render(
      <ClimateRecordTable record={makeClimateRecord()} unitSystem="SI" />,
    );
    const siCell = within(screen.getByRole("row", { name: /^Air/ })).getAllByRole("cell")[0];
    expect(siCell?.textContent).toContain("10");
    expect(siCell?.textContent).toContain("deg C");

    rerender(<ClimateRecordTable record={makeClimateRecord()} unitSystem="IP" />);
    const ipCell = within(screen.getByRole("row", { name: /^Air/ })).getAllByRole("cell")[0];
    expect(ipCell?.textContent).toContain("50");
    expect(ipCell?.textContent).toContain("deg F");
  });

  test("radiation stays SI regardless of unit system", () => {
    render(<ClimateRecordTable record={makeClimateRecord()} unitSystem="IP" />);
    const globalRow = screen.getByRole("row", { name: /^Global/ });
    // Radiation has no IP form — the global series value is unchanged.
    expect(within(globalRow).getAllByRole("cell")[0]?.textContent).toBe("120");
  });
});
