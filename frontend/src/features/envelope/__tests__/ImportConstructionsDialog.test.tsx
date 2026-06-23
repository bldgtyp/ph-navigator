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
  test("renders the plan summary, action labels, and a name-match warning", () => {
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
    expect(screen.getByText("Replace existing")).toBeInTheDocument();
    expect(screen.getByText("Copy from catalog")).toBeInTheDocument();
    // The fuzzy name match is surfaced for confirmation.
    expect(screen.getByText(/Matched an existing project material by name/)).toBeInTheDocument();
    // 1 add + 1 replace land.
    expect(screen.getByRole("button", { name: "Import 2 constructions" })).toBeEnabled();
  });

  test("confirm fires onConfirm", async () => {
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
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  test("disables import when nothing lands (all skipped)", () => {
    render(
      <ImportConstructionsDialog
        plan={plan({
          counts: {
            constructions_add: 0,
            constructions_replace: 0,
            constructions_skip: 2,
            materials_reused: 0,
            materials_picked_from_catalog: 0,
            materials_created: 0,
          },
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
