import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  ElementSidebar,
  type ElementSidebarGroup,
  type ElementSidebarItem,
  type ElementSidebarOrganization,
} from "..";

function makeItems(...names: string[]): ElementSidebarItem[] {
  return names.map((name) => ({
    id: name.toLowerCase(),
    name,
    onRename: () => undefined,
    actions: [],
  }));
}

function makeOrg(over: Partial<ElementSidebarOrganization> = {}): ElementSidebarOrganization {
  return {
    sortMode: "alphabetical",
    onToggleSortMode: () => undefined,
    onReorder: () => undefined,
    hasGroups: false,
    groups: [],
    ungrouped: [],
    onAddGroup: () => undefined,
    onRenameGroup: () => undefined,
    onDeleteGroup: () => undefined,
    onMoveItem: () => undefined,
    onReorderGroups: () => undefined,
    onReorderGroupMembers: () => undefined,
    onToggleGroupCollapsed: () => undefined,
    ...over,
  };
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

const group = (id: string, label: string, items: ElementSidebarItem[]): ElementSidebarGroup => ({
  id,
  label,
  items,
  collapsed: false,
});

describe("ElementSidebar organization", () => {
  test("no organization renders no sort tabs and no drag handles", () => {
    renderSidebar(undefined);
    expect(screen.queryByRole("tablist", { name: "Aperture Types order" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
  });

  test("alphabetical mode shows the tabs with Alphabetical selected and no drag handles", () => {
    renderSidebar(makeOrg());
    expect(screen.getByRole("tab", { name: "Alphabetical" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Manual" })).toHaveAttribute("aria-selected", "false");
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
  });

  test("clicking Manual toggles sort mode", async () => {
    const onToggleSortMode = vi.fn();
    renderSidebar(makeOrg({ onToggleSortMode }));

    await userEvent.click(screen.getByRole("tab", { name: "Manual" }));
    expect(onToggleSortMode).toHaveBeenCalledTimes(1);

    // Clicking the already-active tab does not re-toggle.
    await userEvent.click(screen.getByRole("tab", { name: "Alphabetical" }));
    expect(onToggleSortMode).toHaveBeenCalledTimes(1);
  });

  test("manual mode with no groups renders drag handles + a New group button", () => {
    renderSidebar(makeOrg({ sortMode: "manual" }));
    expect(screen.getByRole("button", { name: "Reorder W1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder W2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New group" })).toBeInTheDocument();
    // No group headers, so no move-to-group selects yet.
    expect(screen.queryByRole("combobox", { name: /Move .* to group/ })).toBeNull();
  });

  test("New group button creates a group", async () => {
    const onAddGroup = vi.fn();
    renderSidebar(makeOrg({ sortMode: "manual", onAddGroup }));
    await userEvent.click(screen.getByRole("button", { name: "New group" }));
    expect(onAddGroup).toHaveBeenCalledTimes(1);
    // Must be called with no arguments so the click event can't become the new
    // group's label (onAddGroup's optional `label` param would otherwise capture it).
    expect(onAddGroup).toHaveBeenCalledWith();
  });

  test("grouped mode renders group sections, an Ungrouped remainder, and move selects", () => {
    const [w1, w2, w3] = makeItems("W1", "W2", "W3");
    renderSidebar(
      makeOrg({
        sortMode: "manual",
        hasGroups: true,
        groups: [group("g_north", "North", [w1!])],
        ungrouped: [w2!, w3!],
      }),
      [w1!, w2!, w3!],
    );

    expect(
      screen.getByText("North", { selector: ".element-sidebar__group-label" }),
    ).toBeInTheDocument();
    // 1A drops the collapse chevron; groups are plain dividers.
    expect(screen.queryByRole("button", { name: "Collapse North" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand North" })).toBeNull();
    expect(
      screen.getByText("Ungrouped", { selector: ".element-sidebar__group-label" }),
    ).toBeInTheDocument();
    // Each item gets a move-to-group select whose only option beyond Ungrouped is North.
    const moveSelect = screen.getByRole("combobox", { name: "Move W1 to group" });
    expect(within(moveSelect).getByRole("option", { name: "North" })).toBeInTheDocument();
    expect(within(moveSelect).getByRole("option", { name: "Ungrouped" })).toBeInTheDocument();
  });

  test("moving an item via the select reports the target group", async () => {
    const onMoveItem = vi.fn();
    const [w1, w2] = makeItems("W1", "W2");
    renderSidebar(
      makeOrg({
        sortMode: "manual",
        hasGroups: true,
        groups: [group("g_north", "North", [])],
        ungrouped: [w1!, w2!],
        onMoveItem,
      }),
      [w1!, w2!],
    );

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Move W1 to group" }),
      "g_north",
    );
    expect(onMoveItem).toHaveBeenCalledWith("w1", "g_north");
  });

  test("groups always render expanded — collapse chrome is dropped for 1A", () => {
    const [w1] = makeItems("W1");
    // Even a group whose persisted view-state marks it collapsed renders its
    // members: 1A hides the collapse affordance but keeps the field for a future 1B.
    renderSidebar(
      makeOrg({
        sortMode: "manual",
        hasGroups: true,
        groups: [{ ...group("g_north", "North", [w1!]), collapsed: true }],
        ungrouped: [],
      }),
      [w1!],
    );

    expect(screen.queryByRole("button", { name: "Collapse North" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand North" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reorder W1" })).toBeInTheDocument();
  });
});
