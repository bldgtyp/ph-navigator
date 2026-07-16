import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ElementSidebar, type ElementSidebarItem, type ElementSidebarOrganization } from "..";

function makeItems(...names: string[]): ElementSidebarItem[] {
  return names.map((name) => ({
    id: name.toLowerCase(),
    name,
    onRename: () => undefined,
    actions: [],
  }));
}

function renderSidebar(organization?: ElementSidebarOrganization, items = makeItems("W1", "W2")) {
  return render(
    <ElementSidebar
      title="Aperture Types"
      ariaLabel="Aperture types"
      toggleNoun="aperture"
      idPrefix="aperture-sidebar"
      collapsed={false}
      onToggleCollapsed={() => undefined}
      canEdit
      actionDisabled={false}
      items={items}
      activeId={null}
      navigation={{ mode: "select", onSelect: () => undefined }}
      rename={{
        actionLabel: "Rename aperture type",
        inputLabel: "Aperture type name",
        editLabel: "Edit aperture type name",
      }}
      add={null}
      organization={organization}
    />,
  );
}

const alphabetical = (
  over: Partial<ElementSidebarOrganization> = {},
): ElementSidebarOrganization => ({
  sortMode: "alphabetical",
  onToggleSortMode: () => undefined,
  onReorder: () => undefined,
  ...over,
});

describe("ElementSidebar organization", () => {
  test("no organization renders no sort toggle and no drag handles", () => {
    renderSidebar(undefined);
    expect(screen.queryByRole("group", { name: "Aperture Types order" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
  });

  test("alphabetical mode shows the toggle with A–Z pressed and no drag handles", () => {
    renderSidebar(alphabetical());
    expect(screen.getByRole("button", { name: "A–Z" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Manual" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
  });

  test("clicking Manual toggles sort mode", async () => {
    const onToggleSortMode = vi.fn();
    renderSidebar(alphabetical({ onToggleSortMode }));

    await userEvent.click(screen.getByRole("button", { name: "Manual" }));
    expect(onToggleSortMode).toHaveBeenCalledTimes(1);

    // Clicking the already-active option does not re-toggle.
    await userEvent.click(screen.getByRole("button", { name: "A–Z" }));
    expect(onToggleSortMode).toHaveBeenCalledTimes(1);
  });

  test("manual mode renders a drag handle per row", () => {
    renderSidebar(alphabetical({ sortMode: "manual" }));
    expect(screen.getByRole("button", { name: "Reorder W1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder W2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manual" })).toHaveAttribute("aria-pressed", "true");
  });
});
