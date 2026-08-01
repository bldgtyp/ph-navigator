import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import type { ProjectSummary } from "../../types";
import { ProjectList } from "../ProjectList";

const OWNER_ID = "owner-ed";

function project(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "project-1",
    owner_id: OWNER_ID,
    owner_display_name: "Ed May",
    name: "West Stockbridge House",
    public_alias: null,
    display_name: "West Stockbridge House",
    bt_number: "2426",
    client: "May",
    cert_programs: ["phi"],
    phius_number: null,
    phius_dropbox_url: null,
    active_version_id: null,
    last_saved_at: null,
    created_at: "2026-08-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    ...overrides,
  };
}

function renderList({
  projects,
  grouped,
  selectedProjectIds = new Set<string>(),
  selectableProjectIds = new Set(
    projects.filter((item) => item.owner_id === OWNER_ID).map((item) => item.id),
  ),
}: {
  projects: ProjectSummary[];
  grouped: boolean;
  selectedProjectIds?: Set<string>;
  selectableProjectIds?: Set<string>;
}) {
  return render(
    <MemoryRouter>
      <ProjectList
        isLoading={false}
        error={null}
        projects={projects}
        grouped={grouped}
        onCreateProject={vi.fn()}
        selectedProjectIds={selectedProjectIds}
        selectableProjectIds={selectableProjectIds}
        selectedCount={selectedProjectIds.size}
        isDeleting={false}
        onToggleProject={vi.fn()}
        onToggleAllProjects={vi.fn()}
        onDeleteSelected={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("ProjectList", () => {
  test("keeps the ungrouped project-list DOM free of owner headings", () => {
    const projects = [project()];

    const { container } = renderList({ projects, grouped: false });

    expect(container.querySelectorAll(".project-list > .project-row")).toHaveLength(1);
    expect(container.querySelector(".project-owner-heading")).toBeNull();
    expect(screen.getByRole("checkbox", { name: /Select project 2426/ })).toBeEnabled();
  });

  test("renders server-ordered owner headings, counts, and disabled foreign selection", () => {
    const projects = [
      project({ id: "ed-2", bt_number: "2402" }),
      project({ id: "ed-1", bt_number: "2401" }),
      project({
        id: "john-1",
        owner_id: "owner-john",
        owner_display_name: "John Mitchell",
        bt_number: "2501",
      }),
    ];

    renderList({
      projects,
      grouped: true,
      selectedProjectIds: new Set(["ed-1", "ed-2"]),
    });

    const ownerHeadings = screen.getAllByRole("heading", { level: 3 });
    expect(ownerHeadings.map((heading) => heading.textContent)).toEqual([
      "Ed May",
      "John Mitchell",
    ]);
    expect(within(ownerHeadings[0]!.parentElement!).getByText("2 projects")).toBeVisible();
    expect(within(ownerHeadings[1]!.parentElement!).getByText("1 project")).toBeVisible();

    const foreignCheckbox = screen.getByRole("checkbox", {
      name: /Select project 2501/,
    });
    expect(foreignCheckbox).toBeDisabled();
    expect(foreignCheckbox).toHaveAttribute("title", "Only the owner can delete this project");
    expect(foreignCheckbox).toHaveAccessibleDescription("Only the owner can delete this project");
    expect(screen.getByRole("checkbox", { name: "Select all projects" })).toBeChecked();
  });

  test("disables select all when every visible project belongs to another owner", () => {
    renderList({
      projects: [
        project({
          id: "john-1",
          owner_id: "owner-john",
          owner_display_name: "John Mitchell",
        }),
      ],
      grouped: true,
    });

    const selectAll = screen.getByRole("checkbox", { name: "Select all projects" });
    expect(selectAll).toBeDisabled();
    expect(selectAll).toHaveAccessibleDescription("Only the owner can delete this project");
  });
});
