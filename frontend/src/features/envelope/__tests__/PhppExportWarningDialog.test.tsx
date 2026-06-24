import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PhppExportWarningDialog } from "../components/PhppExportWarningDialog";
import type { PhppPreflightItem } from "../types";

const blocked: PhppPreflightItem[] = [
  { id: "asm_0", name: "Thick Wall", exportable: false, reason: "too_many_layers" },
  { id: "asm_1", name: "Stud Madness", exportable: false, reason: "too_many_pathways" },
  { id: "asm_2", name: "Unfinished", exportable: false, reason: "incomplete_materials" },
];

describe("PhppExportWarningDialog", () => {
  test("lists each blocked assembly with a friendly reason", () => {
    render(
      <PhppExportWarningDialog
        blocked={blocked}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Thick Wall")).toBeInTheDocument();
    expect(screen.getByText(/more than 8 layers/)).toBeInTheDocument();
    expect(screen.getByText(/more than 3 heat-flow pathways/)).toBeInTheDocument();
    expect(screen.getByText(/missing materials or conductivities/)).toBeInTheDocument();
  });

  test("'Download anyway' confirms; 'Cancel' closes without confirming", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <PhppExportWarningDialog
        blocked={blocked}
        busy={false}
        error={null}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Download anyway" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("disables the confirm button while busy", () => {
    render(
      <PhppExportWarningDialog
        blocked={blocked}
        busy={true}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Download anyway" })).toBeDisabled();
  });
});
