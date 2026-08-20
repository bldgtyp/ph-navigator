import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  ProjectActionsMenu,
  VersionPathControls,
  VersionPopover,
} from "../components/VersionControlsMenus";

describe("VersionControlsMenus", () => {
  test("version action trigger uses the shared portaled tooltip", async () => {
    render(
      <VersionPathControls
        activeVersionName="Working"
        isLocked={false}
        actionsOpen={false}
        onToggleActions={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Version actions for Working" });
    expect(trigger).not.toHaveAttribute("data-tooltip");

    fireEvent.mouseEnter(trigger);

    // The version-path trigger opens on a long hover delay (anti-flicker).
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip).toHaveTextContent("Open project and version actions.");
    expect(portalRoot(tooltip)?.parentElement).toBe(document.body);
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });

  test("project action menu item tooltips portal outside the menu", async () => {
    render(
      <ProjectActionsMenu
        projectId="project-1"
        activeVersionId="version-1"
        isLocked={false}
        hasDraft
        busy={false}
        onOpenProjectSettings={vi.fn()}
        onOpenVersions={vi.fn()}
        onManageVersions={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onDiscard={vi.fn()}
        onToggleLock={vi.fn()}
        onOpenDiff={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const menu = screen.getByRole("menu", { name: "Project actions" });
    const item = screen.getByRole("menuitem", { name: "Open version..." });
    expect(item).not.toHaveAttribute("data-tooltip");

    fireEvent.mouseEnter(item);

    // Menu-item help tooltips open on a long hover delay.
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(tooltip).toHaveTextContent("Open the version list to switch or compare versions.");
    expect(menu.contains(tooltip)).toBe(false);
    expect(portalRoot(tooltip)?.parentElement).toBe(document.body);
  });

  test("version popover shows last-edited metadata and management entry", () => {
    render(
      <VersionPopover
        versions={[
          {
            id: "version-1",
            project_id: "project-1",
            name: "Working",
            kind: "working",
            locked: false,
            schema_version: 9,
            body_size_bytes: 1,
            created_at: "2026-08-19T12:00:00Z",
            updated_at: "2026-08-19T18:30:00Z",
          },
        ]}
        activeVersionId="version-1"
        defaultVersionId="version-1"
        busy={false}
        onSaveAs={vi.fn()}
        onOpenVersion={vi.fn()}
        onOpenDiff={vi.fn()}
        onManageVersions={vi.fn()}
      />,
    );

    expect(screen.getByText(/Last edited/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage versions..." })).toBeInTheDocument();
  });
});

function portalRoot(element: HTMLElement): HTMLElement | null {
  return element.closest("[data-radix-popper-content-wrapper]");
}
