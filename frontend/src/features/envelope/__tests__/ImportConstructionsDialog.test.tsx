import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ImportConstructionsDialog } from "../components/dialogs/ImportConstructionsDialog";
import type { ImportConstructionsPreview } from "../types";

function plan(overrides: Partial<ImportConstructionsPreview> = {}): ImportConstructionsPreview {
  return {
    project_id: "p",
    version_id: "v",
    source: "version",
    version_etag: "etag",
    draft_etag: null,
    schema_version: 11,
    counts: {
      constructions_add: 1,
      constructions_replace: 1,
      constructions_skip: 0,
      materials_reused: 1,
      materials_picked_from_catalog: 1,
      materials_created: 1,
    },
    constructions: [
      {
        resolution_key: "WALL-A",
        source_assembly_id: "asm_a",
        name: "WALL-A",
        action: "replace",
        target_assembly_id: "asm_a",
        warnings: [],
      },
      {
        resolution_key: "W_NewWall",
        source_assembly_id: null,
        name: "W_NewWall",
        action: "add_new",
        target_assembly_id: null,
        warnings: [],
      },
    ],
    materials: [
      {
        source_key: "pmat_1",
        name: "Mineral wool",
        decision: "reuse_project_material",
        project_material_id: "pmat_1",
        catalog_record_id: null,
        warnings: ["name_matched_project_material"],
      },
      {
        source_key: "pmat_2",
        name: "XPS",
        decision: "pick_from_catalog",
        project_material_id: "pmat_new",
        catalog_record_id: "rec01234567890123",
        warnings: [],
      },
    ],
    warnings: [],
    ...overrides,
  };
}

describe("ImportConstructionsDialog", () => {
  test("renders the plan, a per-construction action control, and a name-match warning", () => {
    render(
      <ImportConstructionsDialog
        plan={plan()}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText("Import constructions")).toBeInTheDocument();
    expect(screen.getByText("WALL-A")).toBeInTheDocument();
    // The matched construction defaults to Replace and is editable.
    expect(screen.getByLabelText("Action for WALL-A")).toHaveValue("replace");
    // The foreign construction is now editable too (Add new / Skip).
    expect(screen.getByLabelText("Action for W_NewWall")).toHaveValue("add_new");
    expect(screen.getByText("Copy from catalog")).toBeInTheDocument();
    expect(screen.getByText(/Matched an existing project material by name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 2 constructions" })).toBeEnabled();
  });

  test("confirm sends a resolution per construction, keyed by resolution_key", async () => {
    const onConfirm = vi.fn();
    render(
      <ImportConstructionsDialog
        plan={plan()}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Import 2 constructions" }));
    expect(onConfirm).toHaveBeenCalledWith(
      [
        { resolution_key: "WALL-A", action: "replace", target_assembly_id: "asm_a" },
        { resolution_key: "W_NewWall", action: "add_new", target_assembly_id: null },
      ],
      [],
    );
  });

  test("a foreign construction can be skipped", async () => {
    const onConfirm = vi.fn();
    render(
      <ImportConstructionsDialog
        plan={plan()}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Action for W_NewWall"), "skip");
    // Only the replace construction now lands.
    await userEvent.click(screen.getByRole("button", { name: "Import 1 construction" }));
    expect(onConfirm).toHaveBeenCalledWith(
      [
        { resolution_key: "WALL-A", action: "replace", target_assembly_id: "asm_a" },
        { resolution_key: "W_NewWall", action: "skip", target_assembly_id: null },
      ],
      [],
    );
  });

  test("rejecting a material match forces a fresh copy", async () => {
    const onConfirm = vi.fn();
    render(
      <ImportConstructionsDialog
        plan={plan()}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    // "Mineral wool" defaults to reuse; reject the match.
    await userEvent.click(screen.getByLabelText("Create a new copy of Mineral wool"));
    await userEvent.click(screen.getByRole("button", { name: "Import 2 constructions" }));
    expect(onConfirm).toHaveBeenCalledWith(expect.any(Array), [
      { source_key: "pmat_1", action: "create_new" },
    ]);
  });

  test("disables import when nothing lands", () => {
    render(
      <ImportConstructionsDialog
        plan={plan({
          constructions: [
            {
              resolution_key: "WALL-A",
              source_assembly_id: "asm_a",
              name: "WALL-A",
              action: "skip",
              target_assembly_id: "asm_a",
              warnings: [],
            },
          ],
        })}
        busy={false}
        error={null}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Nothing to import" })).toBeDisabled();
  });
});
