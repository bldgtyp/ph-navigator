import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatusItemModal } from "./StatusItemModal";

describe("StatusItemModal", () => {
  it("switches the description editor and preview with a radio group", () => {
    render(
      <StatusItemModal title="Edit milestone" onCancel={() => undefined} onSubmit={vi.fn()} />,
    );

    expect(screen.getByRole("radiogroup", { name: "Description mode" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Edit" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));

    expect(screen.getByRole("radio", { name: "Preview" })).toBeChecked();
    expect(screen.getByText("No description.")).toBeInTheDocument();
  });
});
