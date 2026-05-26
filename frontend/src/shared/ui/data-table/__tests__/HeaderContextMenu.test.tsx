import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, type RefObject } from "react";
import { describe, expect, test, vi } from "vitest";
import { HeaderContextMenu, type HeaderContextMenuProps } from "../components/HeaderContextMenu";
import type { FieldDef } from "../types";

// Wraps the menu in a real `<button>` trigger so the `triggerRef`
// effect can attach `contextmenu` / `keydown` listeners just like it
// would in production. The wrapper exposes both the trigger and the
// ref so individual tests can dispatch events against the same node
// the menu listens on.

type RenderArgs = Partial<Omit<HeaderContextMenuProps, "fieldDef" | "triggerRef">> & {
  fieldDef?: FieldDef;
};

function Wrapper(props: RenderArgs) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const customField: FieldDef = {
    field_key: "cf_notes",
    field_type: "text",
    display_name: "Notes",
  };
  const fieldDef = props.fieldDef ?? customField;
  return (
    <>
      <button ref={triggerRef} type="button" data-testid="header-trigger">
        {fieldDef.display_name}
      </button>
      <HeaderContextMenu
        fieldDef={fieldDef}
        triggerRef={triggerRef as RefObject<HTMLElement | null>}
        isViewer={props.isViewer ?? false}
        onSortAsc={props.onSortAsc ?? vi.fn()}
        onSortDesc={props.onSortDesc ?? vi.fn()}
        onFilterBy={props.onFilterBy ?? vi.fn()}
        onGroupBy={props.onGroupBy ?? vi.fn()}
        onHide={props.onHide ?? vi.fn()}
        onDeleteField={props.onDeleteField}
        onDuplicateField={props.onDuplicateField}
        onEditFieldConfig={props.onEditFieldConfig}
        onInsertFieldLeft={props.onInsertFieldLeft}
        onInsertFieldRight={props.onInsertFieldRight}
      />
    </>
  );
}

function openViaContextMenu() {
  const trigger = screen.getByTestId("header-trigger");
  fireEvent.contextMenu(trigger, { clientX: 100, clientY: 50 });
}

describe("HeaderContextMenu", () => {
  test("right-click on a fully-locked built-in header surfaces only view-state items", () => {
    const coreField: FieldDef = {
      field_key: "name",
      field_type: "text",
      display_name: "Name",
      built_in: true,
      locked: ["delete", "duplicate"],
    };
    // `onDeleteField` is wired but the lock list suppresses it. No
    // `onEditFieldConfig` is wired, so Edit field… is also absent.
    render(<Wrapper fieldDef={coreField} onDeleteField={vi.fn()} />);
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      "Sort A → Z",
      "Sort Z → A",
      "Filter by this field",
      "Group by this field",
      "Hide field",
    ]);
    expect(items).not.toContain("Delete field");
  });

  test("right-click on a custom-field header shows unified edit before view-state items", () => {
    render(
      <Wrapper onEditFieldConfig={vi.fn()} onDeleteField={vi.fn()} onDuplicateField={vi.fn()} />,
    );
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      "Edit field…",
      "Delete field",
      "Duplicate field",
      "Sort A → Z",
      "Sort Z → A",
      "Filter by this field",
      "Group by this field",
      "Hide field",
    ]);
  });

  test("Edit field… opens the unified config modal handler on custom fields", () => {
    const onEditFieldConfig = vi.fn();
    render(<Wrapper onEditFieldConfig={onEditFieldConfig} />);
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items[0]).toBe("Edit field…");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit field…" }));
    expect(onEditFieldConfig).toHaveBeenCalledTimes(1);
  });

  test("Edit field… IS available on built-in fields (Phase 1a — modal disables locked sections)", () => {
    const coreField: FieldDef = {
      field_key: "name",
      field_type: "text",
      display_name: "Name",
      built_in: true,
      locked: ["delete", "duplicate"],
    };
    render(<Wrapper fieldDef={coreField} onEditFieldConfig={vi.fn()} />);
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items[0]).toBe("Edit field…");
  });

  test("Delete field is suppressed when the lock list includes 'delete'", () => {
    const built: FieldDef = {
      field_key: "name",
      field_type: "text",
      display_name: "Name",
      built_in: true,
      locked: ["delete", "duplicate"],
    };
    render(<Wrapper fieldDef={built} onDeleteField={vi.fn()} onDuplicateField={vi.fn()} />);
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).not.toContain("Delete field");
    expect(items).not.toContain("Duplicate field");
  });

  test("Delete field surfaces when the lock list omits 'delete'", () => {
    const unlocked: FieldDef = {
      field_key: "unlocked_builtin",
      field_type: "text",
      display_name: "Unlocked",
      built_in: true,
      locked: [],
    };
    render(<Wrapper fieldDef={unlocked} onDeleteField={vi.fn()} />);
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toContain("Delete field");
  });

  test("viewer mode never opens the menu (browser default surfaces instead)", () => {
    render(<Wrapper isViewer onDeleteField={vi.fn()} />);
    openViaContextMenu();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  test("Shift+F10 on the trigger opens the menu", () => {
    render(<Wrapper onDeleteField={vi.fn()} />);
    const trigger = screen.getByTestId("header-trigger");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
  });

  test("ContextMenu key opens the menu", () => {
    render(<Wrapper onDeleteField={vi.fn()} />);
    const trigger = screen.getByTestId("header-trigger");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ContextMenu" });
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  test("clicking Delete field invokes the onDeleteField callback and closes the menu", () => {
    const onDeleteField = vi.fn();
    render(<Wrapper onDeleteField={onDeleteField} />);
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete field" }));
    expect(onDeleteField).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("clicking Edit field opens the modal handler and closes the menu", async () => {
    const user = userEvent.setup();
    const onEditFieldConfig = vi.fn();
    render(<Wrapper onEditFieldConfig={onEditFieldConfig} />);
    openViaContextMenu();
    await user.click(screen.getByRole("menuitem", { name: "Edit field…" }));
    expect(onEditFieldConfig).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("clicking a view-state item still restores focus to the header trigger", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    openViaContextMenu();
    await user.click(screen.getByRole("menuitem", { name: "Sort A → Z" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("header-trigger")).toHaveFocus();
  });

  test("ArrowDown / ArrowUp move focus across items; Escape closes the menu", () => {
    render(<Wrapper onDeleteField={vi.fn()} />);
    openViaContextMenu();
    const menu = screen.getByRole("menu");
    // The first item gets focus on open; ArrowDown shifts to the
    // second. Active focus reflects the visible focus indicator users
    // see when driving via keyboard.
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    // Items 0,1,2 = Delete, Sort A→Z, Sort Z→A — focus index 2.
    expect(document.activeElement?.textContent).toBe("Sort Z → A");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  test("Insert field left / right appear on both core and custom fields when wired", () => {
    const onInsertFieldLeft = vi.fn();
    const onInsertFieldRight = vi.fn();
    const coreField: FieldDef = {
      field_key: "name",
      field_type: "text",
      display_name: "Name",
      built_in: true,
      locked: ["delete", "duplicate"],
    };
    render(
      <Wrapper
        fieldDef={coreField}
        onInsertFieldLeft={onInsertFieldLeft}
        onInsertFieldRight={onInsertFieldRight}
      />,
    );
    openViaContextMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      "Sort A → Z",
      "Sort Z → A",
      "Filter by this field",
      "Group by this field",
      "Hide field",
      "Insert field left",
      "Insert field right",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Insert field right" }));
    expect(onInsertFieldRight).toHaveBeenCalledTimes(1);
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Insert field left" }));
    expect(onInsertFieldLeft).toHaveBeenCalledTimes(1);
  });

  test("each view-state item routes to its callback", () => {
    const onSortAsc = vi.fn();
    const onSortDesc = vi.fn();
    const onFilterBy = vi.fn();
    const onGroupBy = vi.fn();
    const onHide = vi.fn();
    render(
      <Wrapper
        onSortAsc={onSortAsc}
        onSortDesc={onSortDesc}
        onFilterBy={onFilterBy}
        onGroupBy={onGroupBy}
        onHide={onHide}
      />,
    );
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sort A → Z" }));
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sort Z → A" }));
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Filter by this field" }));
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Group by this field" }));
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide field" }));
    expect(onSortAsc).toHaveBeenCalledTimes(1);
    expect(onSortDesc).toHaveBeenCalledTimes(1);
    expect(onFilterBy).toHaveBeenCalledTimes(1);
    expect(onGroupBy).toHaveBeenCalledTimes(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  test("formula fields use the same Edit field… item", () => {
    const formulaField: FieldDef = {
      field_key: "cf_label",
      field_type: "computed",
      display_name: "Label",
    };
    const onEditFieldConfig = vi.fn();
    render(<Wrapper fieldDef={formulaField} onEditFieldConfig={onEditFieldConfig} />);
    openViaContextMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit field…" }));
    expect(onEditFieldConfig).toHaveBeenCalledTimes(1);
  });

  test("Edit field… is absent when handler is omitted", () => {
    const formulaField: FieldDef = {
      field_key: "cf_label",
      field_type: "computed",
      display_name: "Label",
    };
    render(<Wrapper fieldDef={formulaField} />);
    openViaContextMenu();
    expect(screen.queryByRole("menuitem", { name: "Edit field…" })).toBeNull();
  });
});
