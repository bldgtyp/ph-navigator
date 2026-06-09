import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndoorEquipRowModal } from "../components/IndoorEquipRowModal";
import { buildEmptyIndoorEquipRow } from "../lib";
import type { HeatPumpIndoorEquipRow } from "../types";

describe("IndoorEquipRowModal", () => {
  test("blocks save when model number is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    render(
      <IndoorEquipRowModal
        mode="add"
        row={buildEmptyIndoorEquipRow()}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create indoor equipment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Model number is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("rejects negative numeric values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const row = buildEmptyIndoorEquipRow({ model_number: "PLA-A12EA8", cooling_btuh: -1 });

    render(
      <IndoorEquipRowModal
        mode="edit"
        row={row}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save indoor equipment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("0 or greater");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("rejects nominal_tons === 0 because PRD requires strictly positive", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const row = buildEmptyIndoorEquipRow({ model_number: "PLA-A12EA8", nominal_tons: 0 });

    render(
      <IndoorEquipRowModal
        mode="edit"
        row={row}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save indoor equipment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nominal tons must be greater than 0",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("slugifies free-text install_type on submit", async () => {
    const user = userEvent.setup();
    let submitted: HeatPumpIndoorEquipRow | null = null;
    const onSubmit = vi.fn(async (row: HeatPumpIndoorEquipRow) => {
      submitted = row;
    });

    render(
      <IndoorEquipRowModal
        mode="add"
        row={buildEmptyIndoorEquipRow()}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Model number"), "PLA-A12EA8");
    await user.type(screen.getByLabelText("Install type"), "Cassette");
    await user.click(screen.getByRole("button", { name: "Create indoor equipment" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitted).not.toBeNull();
    expect(submitted!.install_type).toBe("opt_cassette");
    expect(submitted!.model_number).toBe("PLA-A12EA8");
  });

  test("read-only mode hides editing affordances", () => {
    render(
      <IndoorEquipRowModal
        mode="edit"
        row={buildEmptyIndoorEquipRow({ model_number: "PLA-A12EA8" })}
        readOnly={true}
        onCancel={() => undefined}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.queryByRole("button", { name: "Save indoor equipment" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Model number")).toBeDisabled();
  });
});
