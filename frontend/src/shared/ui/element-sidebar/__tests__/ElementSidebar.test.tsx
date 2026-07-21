import { render, screen } from "@testing-library/react";
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
    onMoveItemToContainer: () => undefined,
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
  test("no organization renders no sort control and no drag handles", () => {
    renderSidebar(undefined);
    expect(screen.queryByRole("button", { name: "Aperture Types order" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
  });

  test("the sort menu shows Alphabetical checked in alphabetical mode; no drag handles", async () => {
    renderSidebar(makeOrg());
    // The control is a quiet icon trigger; the modes live behind it.
    await userEvent.click(screen.getByRole("button", { name: "Aperture Types order" }));
    expect(screen.getByRole("menuitemradio", { name: "Alphabetical" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Manual" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.queryByRole("button", { name: /^Reorder / })).toBeNull();
  });

  test("choosing Manual from the sort menu toggles sort mode", async () => {
    const onToggleSortMode = vi.fn();
    renderSidebar(makeOrg({ onToggleSortMode }));

    await userEvent.click(screen.getByRole("button", { name: "Aperture Types order" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Manual" }));
    expect(onToggleSortMode).toHaveBeenCalledTimes(1);

    // Choosing the already-active mode does not re-toggle.
    await userEvent.click(screen.getByRole("button", { name: "Aperture Types order" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: "Alphabetical" }));
    expect(onToggleSortMode).toHaveBeenCalledTimes(1);
  });

  test("manual mode with no groups renders drag handles + an Add group control", () => {
    renderSidebar(makeOrg({ sortMode: "manual" }));
    expect(screen.getByRole("button", { name: "Reorder W1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reorder W2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add group" })).toBeInTheDocument();
    // No group headers, so no move-to-group selects yet.
    expect(screen.queryByRole("combobox", { name: /Move .* to group/ })).toBeNull();
  });

  test("Add group control creates a group", async () => {
    const onAddGroup = vi.fn();
    renderSidebar(makeOrg({ sortMode: "manual", onAddGroup }));
    await userEvent.click(screen.getByRole("button", { name: "Add group" }));
    expect(onAddGroup).toHaveBeenCalledTimes(1);
    // Must be called with no arguments so the click event can't become the new
    // group's label (onAddGroup's optional `label` param would otherwise capture it).
    expect(onAddGroup).toHaveBeenCalledWith();
  });

  test("grouped mode renders group sections + an Ungrouped remainder, with draggable rows and no move select", () => {
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
    // Assignment is drag-only now: every row has a drag handle, and the old
    // per-row "move to group" select is gone.
    expect(screen.getByRole("button", { name: "Reorder W1" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Move .* to group/ })).toBeNull();
  });

  test("an empty group still renders a drop zone so items can be dragged into it", () => {
    const [w1, w2] = makeItems("W1", "W2");
    renderSidebar(
      makeOrg({
        sortMode: "manual",
        hasGroups: true,
        groups: [group("g_north", "North", [])],
        ungrouped: [w1!, w2!],
      }),
      [w1!, w2!],
    );
    // The empty group shows its dots drop-target placeholder rather than collapsing
    // away; the accessible label is preserved for screen readers.
    expect(screen.getAllByLabelText("Empty — drag items here").length).toBeGreaterThanOrEqual(1);
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
