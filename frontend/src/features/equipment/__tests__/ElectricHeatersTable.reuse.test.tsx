import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { emptyViewState } from "../../../shared/ui/data-table";
import { ElectricHeatersTable } from "../components/ElectricHeatersTable";
import {
  buildElectricHeater,
  buildElectricHeatersSlice,
  schemaForElectricHeaters,
} from "../testing/testFixtures";

describe("ElectricHeatersTable DataTable reuse", () => {
  test("renders requested columns and URL values", () => {
    const slice = buildElectricHeatersSlice({
      electric_heaters: [
        buildElectricHeater({
          url: "https://example.com/heater.pdf",
          notes: "Basis of design.",
        }),
      ],
    });

    render(
      <ElectricHeatersTable
        electricHeatersSlice={slice}
        tableSchema={schemaForElectricHeaters(slice)}
        isEditor
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={() => undefined}
      />,
    );

    for (const label of ["Tag", "Name", "Model", "Manufacturer", "Watt", "URL", "Notes"]) {
      expect(screen.getByRole("columnheader", { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "example.com/heater.pdf" })).toHaveAttribute(
      "href",
      "https://example.com/heater.pdf",
    );
  });

  test("commits inline edits through DataTable writes", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    const slice = buildElectricHeatersSlice({
      electric_heaters: [buildElectricHeater({ id: "heatr_1" })],
    });

    render(
      <ElectricHeatersTable
        electricHeatersSlice={slice}
        tableSchema={schemaForElectricHeaters(slice)}
        isEditor
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const wattCell = document.querySelector('[data-field-key="watt"]');
    expect(wattCell).not.toBeNull();
    await user.dblClick(wattCell as HTMLElement);
    const input = within(wattCell as HTMLElement).getByRole("textbox");
    await user.clear(input);
    await user.type(input, "1250");
    await user.keyboard("{Enter}");

    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "heatr_1", fieldKey: "watt", value: 1250 }],
    });
  });
});
