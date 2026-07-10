import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { StatusItem } from "../types";
import { StatusItemRow } from "./StatusItemRow";

const item: StatusItem = {
  id: "milestone-1",
  project_id: "project-1",
  order_index: 0,
  title: "CAD files received",
  state: "todo",
  completion_date: "2026-07-10",
  description: "Waiting on the architect.",
  created_at: "2026-07-10T12:00:00Z",
  created_by: null,
  updated_at: "2026-07-10T12:00:00Z",
  updated_by: null,
};

function renderRow(
  isEditor: boolean,
  overrides: Partial<React.ComponentProps<typeof StatusItemRow>> = {},
) {
  const props: React.ComponentProps<typeof StatusItemRow> = {
    item,
    isCurrent: true,
    isEditor,
    canMoveUp: false,
    canMoveDown: true,
    onSetState: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onMove: vi.fn(),
    onDrop: vi.fn(),
    ...overrides,
  };
  return { ...render(<StatusItemRow {...props} />), props };
}

describe("StatusItemRow", () => {
  test("puts editor management actions in the overflow menu", async () => {
    const user = userEvent.setup();
    const { props } = renderRow(true);

    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "More actions for CAD files received" }));

    await user.click(screen.getByRole("menuitem", { name: "Mark done" }));
    expect(props.onSetState).toHaveBeenCalledWith("done");
  });

  test("keeps editor state cycling and keyboard reordering available", async () => {
    const user = userEvent.setup();
    const { props } = renderRow(true);

    await user.click(screen.getByRole("button", { name: "Set CAD files received to Done" }));
    expect(props.onSetState).toHaveBeenCalledWith("done");

    fireEvent.keyDown(screen.getByRole("article"), { key: "ArrowDown", altKey: true });
    expect(props.onMove).toHaveBeenCalledWith(1);
  });

  test("renders no management controls or disabled date button for viewers", () => {
    renderRow(false);

    expect(screen.queryByLabelText(/Drag CAD files received/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /More actions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Jul 10, 2026/ })).not.toBeInTheDocument();
    expect(screen.getByText("Jul 10, 2026")).toBeVisible();
  });
});
