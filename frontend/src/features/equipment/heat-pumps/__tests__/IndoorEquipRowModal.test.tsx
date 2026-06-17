import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndoorEquipRowModal } from "../components/IndoorEquipRowModal";
import { buildEmptyIndoorEquipRow } from "../lib";
import type { HeatPumpIndoorEquipRow } from "../types";

describe("IndoorEquipRowModal", () => {
  test("blocks save when tag is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);

    render(
      <IndoorEquipRowModal
        mode="add"
        row={buildEmptyIndoorEquipRow()}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create indoor equipment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tag is required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("rejects negative numeric values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    const row = buildEmptyIndoorEquipRow({ tag: "IE-1", cooling_btuh: -1 });

    render(
      <IndoorEquipRowModal
        mode="edit"
        row={row}
        options={{}}
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
    const row = buildEmptyIndoorEquipRow({ tag: "IE-1", nominal_tons: 0 });

    render(
      <IndoorEquipRowModal
        mode="edit"
        row={row}
        options={{}}
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

  test("picks install_type from the project options list", async () => {
    const user = userEvent.setup();
    let submitted: HeatPumpIndoorEquipRow | null = null;
    const onSubmit = vi.fn(async (row: HeatPumpIndoorEquipRow) => {
      submitted = row;
    });

    render(
      <IndoorEquipRowModal
        mode="add"
        row={buildEmptyIndoorEquipRow({ tag: "IE-1" })}
        options={{
          "heat_pumps.install_type": [
            { id: "opt_wall_mounted", label: "Wall Mounted", color: "#3b82f6", order: 0 },
            { id: "opt_ceiling_recessed", label: "Ceiling Recessed", color: "#10b981", order: 1 },
          ],
        }}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Model number"), "PLA-A12EA8");
    await user.click(screen.getByLabelText("Install type"));
    await user.click(screen.getByRole("option", { name: "Ceiling Recessed" }));
    await user.click(screen.getByRole("button", { name: "Create indoor equipment" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitted).not.toBeNull();
    expect(submitted!.install_type).toBe("opt_ceiling_recessed");
    expect(submitted!.model_number).toBe("PLA-A12EA8");
  });

  test("read-only mode hides editing affordances", () => {
    render(
      <IndoorEquipRowModal
        mode="edit"
        row={buildEmptyIndoorEquipRow({ tag: "IE-1", model_number: "PLA-A12EA8" })}
        options={{}}
        readOnly={true}
        onCancel={() => undefined}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.queryByRole("button", { name: "Save indoor equipment" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Tag")).toBeDisabled();
  });
});
