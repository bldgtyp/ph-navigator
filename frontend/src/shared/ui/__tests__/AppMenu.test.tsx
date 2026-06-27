import { fireEvent, render, screen } from "@testing-library/react";
import { Filter, Ruler } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { AppMenu, AppMenuCheckboxItem, AppMenuItem } from "../AppMenu";

describe("AppMenu", () => {
  it("uses the shared overflow trigger and icon-text item layout", () => {
    render(
      <AppMenu label="Aperture actions" defaultOpen>
        <AppMenuItem icon={Filter}>Configure filters</AppMenuItem>
      </AppMenu>,
    );

    expect(screen.getByRole("button", { name: "Aperture actions" })).toHaveClass(
      "app-menu__trigger",
    );
    const item = screen.getByRole("menuitem", { name: "Configure filters" });
    expect(item).toHaveClass("app-menu__item");
    expect(item.querySelector(".app-menu__item-icon svg")).not.toBeNull();
  });

  it("supports a custom trigger icon", () => {
    render(
      <AppMenu label="Dimension display" triggerIcon={Ruler}>
        <AppMenuItem icon={Filter}>Configure filters</AppMenuItem>
      </AppMenu>,
    );

    expect(
      screen.getByRole("button", { name: "Dimension display" }).querySelector(".lucide-ruler"),
    ).not.toBeNull();
  });

  it("closes when clicking away", () => {
    render(
      <>
        <AppMenu label="Aperture actions">
          <AppMenuItem icon={Filter}>Configure filters</AppMenuItem>
        </AppMenu>
        <button type="button">Outside</button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aperture actions" }));
    expect(screen.getByRole("menuitem", { name: "Configure filters" })).toBeVisible();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menuitem", { name: "Configure filters" })).not.toBeInTheDocument();
  });

  it("closes when focus leaves the menu", () => {
    render(
      <>
        <AppMenu label="Aperture actions">
          <AppMenuItem icon={Filter}>Configure filters</AppMenuItem>
        </AppMenu>
        <button type="button">Outside</button>
      </>,
    );

    const trigger = screen.getByRole("button", { name: "Aperture actions" });
    fireEvent.click(trigger);
    const item = screen.getByRole("menuitem", { name: "Configure filters" });
    const outside = screen.getByRole("button", { name: "Outside" });
    fireEvent.blur(item, { relatedTarget: outside });
    expect(screen.queryByRole("menuitem", { name: "Configure filters" })).not.toBeInTheDocument();
  });

  it("closes before invoking item actions", () => {
    const onClick = vi.fn();
    render(
      <AppMenu label="Aperture actions" defaultOpen>
        <AppMenuItem icon={Filter} onClick={onClick}>
          Configure filters
        </AppMenuItem>
      </AppMenu>,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Configure filters" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "Configure filters" })).not.toBeInTheDocument();
  });

  it("renders checkbox items without closing the menu by default", () => {
    const onClick = vi.fn();
    render(
      <AppMenu label="Aperture actions" defaultOpen>
        <AppMenuCheckboxItem
          checked
          title="Filter by frame side"
          aria-description="Show side-appropriate frame rows."
          data-tooltip="Show side-appropriate frame rows."
          onClick={onClick}
        >
          Filter frames by side
        </AppMenuCheckboxItem>
      </AppMenu>,
    );

    const item = screen.getByRole("menuitemcheckbox", { name: "Filter frames by side" });
    expect(item).toHaveClass("app-menu__checkbox-item");
    expect(item).toHaveAttribute("aria-checked", "true");
    expect(item).toHaveAttribute("title", "Filter by frame side");
    expect(item).toHaveAttribute("data-tooltip", "Show side-appropriate frame rows.");
    fireEvent.click(item);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menuitemcheckbox", { name: "Filter frames by side" })).toBeVisible();
  });

  it("can close checkbox items on select when requested", () => {
    render(
      <AppMenu label="Aperture actions" defaultOpen>
        <AppMenuCheckboxItem checked={false} closeOnSelect>
          Filter frames by operation
        </AppMenuCheckboxItem>
      </AppMenu>,
    );

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Filter frames by operation" }));
    expect(
      screen.queryByRole("menuitemcheckbox", { name: "Filter frames by operation" }),
    ).not.toBeInTheDocument();
  });
});
