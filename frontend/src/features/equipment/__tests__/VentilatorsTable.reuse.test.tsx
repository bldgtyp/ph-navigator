import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyViewState } from "../../../shared/ui/data-table";
import { VentilatorsTable } from "../components/VentilatorsTable";
import {
  buildVentilator,
  buildVentilatorsSlice,
  schemaForVentilators,
} from "../testing/testFixtures";

describe("VentilatorsTable DataTable reuse", () => {
  test("renders AirTable-matched ventilator columns, units, and single-select labels", () => {
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Airflow Rate/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Electrical Efficiency/ })).toBeInTheDocument();
    expect(screen.getByText("m3/h")).toBeInTheDocument();
    expect(screen.getByText("Wh/m3")).toBeInTheDocument();
    expect(screen.getByText("ERV-1")).toBeInTheDocument();
    expect(screen.getByText("Inside")).toBeInTheDocument();
  });

  test("renders Linked HP indoor count from the reverse-lookup map", () => {
    const ventilator = buildVentilator({ id: "vent_n2" });
    const slice = buildVentilatorsSlice({ ventilators: [ventilator] });
    const tableSchema = schemaForVentilators(slice);
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        linkedHpIndoorCountById={new Map([["vent_n2", 3]])}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Linked HP indoor/i })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    const onWrite = vi.fn().mockResolvedValue(undefined);
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    await user.dblClick(screen.getByText("ERV-1"));
    await user.keyboard("{Control>}a{/Control}ERV-2{Enter}");

    expect(onWrite).toHaveBeenCalled();
  });
});
