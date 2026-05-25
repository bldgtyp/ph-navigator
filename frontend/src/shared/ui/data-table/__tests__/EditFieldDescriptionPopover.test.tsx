import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { EditFieldDescriptionPopover } from "../components/EditFieldDescriptionPopover";

function renderPopover(dispatchDescription = vi.fn().mockResolvedValue(undefined)) {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  render(
    <EditFieldDescriptionPopover
      open
      onOpenChange={vi.fn()}
      anchorElement={anchor}
      fieldKey="cf_paint"
      fieldDisplayName="Paint"
      initialDescription="Existing note"
      dispatchDescription={dispatchDescription}
    />,
  );
  return dispatchDescription;
}

describe("EditFieldDescriptionPopover", () => {
  test("saves a clamped description", async () => {
    const dispatchDescription = renderPopover();
    const dialog = screen.getByRole("dialog", { name: "Edit description for Paint" });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "x".repeat(400) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(dispatchDescription).toHaveBeenCalledWith({
        fieldKey: "cf_paint",
        description: "x".repeat(280),
      }),
    );
  });

  test("saves null for an empty description", async () => {
    const dispatchDescription = renderPopover();
    const dialog = screen.getByRole("dialog", { name: "Edit description for Paint" });
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "   " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(dispatchDescription).toHaveBeenCalledWith({
        fieldKey: "cf_paint",
        description: null,
      }),
    );
  });
});
