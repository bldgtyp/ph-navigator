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
        source_assembly_id: "asm_a",
        name: "WALL-A",
        action: "replace",
        target_assembly_id: "asm_a",
        warnings: [],
      },
      {
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
    // The foreign construction (no source id) can only be added — static chip.
    expect(screen.queryByLabelText("Action for W_NewWall")).not.toBeInTheDocument();
    expect(screen.getByText("Copy from catalog")).toBeInTheDocument();
    expect(screen.getByText(/Matched an existing project material by name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 2 constructions" })).toBeEnabled();
  });

  test("confirm sends per-construction resolutions", async () => {
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
    // Only the construction with a source id is addressable server-side.
    expect(onConfirm).toHaveBeenCalledWith([
      { source_assembly_id: "asm_a", action: "replace", target_assembly_id: "asm_a" },
    ]);
  });

  test("overriding an action to Skip drops it from the import", async () => {
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

    await userEvent.selectOptions(screen.getByLabelText("Action for WALL-A"), "skip");
    // Only the foreign add_new construction now lands.
    const button = screen.getByRole("button", { name: "Import 1 construction" });
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledWith([
      { source_assembly_id: "asm_a", action: "skip", target_assembly_id: "asm_a" },
    ]);
  });

  test("disables import when nothing lands", () => {
    render(
      <ImportConstructionsDialog
        plan={plan({
          constructions: [
            {
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
