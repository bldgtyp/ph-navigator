import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { emptyViewState } from "../../../shared/ui/data-table";
import { SpaceTypesTable } from "../components/SpaceTypesTable";
import type { SpaceTypesSlice } from "../types";
import { buildSpaceType, buildSpaceTypesSlice, schemaForSpaceTypes } from "../testing/testFixtures";

describe("SpaceTypesTable", () => {
  test("renders Tag and Name columns", () => {
    const slice = buildSpaceTypesSlice({
      space_types: [buildSpaceType({ id: "st_office", tag: "Office", name: "Open Office" })],
    });

    renderTable(slice);

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.getByText("Open Office")).toBeInTheDocument();
  });

  test("renders reverse Rooms links with resolved room labels and forwards clicks", async () => {
    const user = userEvent.setup();
    const onInversePillClick = vi.fn();
    const slice = buildSpaceTypesSlice({
      space_types: [buildSpaceType({ id: "st_office", tag: "Office" })],
      inverse_link_fields: [
        {
          source_key: "rooms.space_type_id",
          source_table_path: ["rooms"],
          source_table_display: "Rooms",
          source_field_key: "space_type_id",
          source_field_display_name: "Space Type",
        },
      ],
      inverse_links: {
        st_office: {
          "rooms.space_type_id": ["rm_101"],
        },
      },
    });

    renderTable(slice, {
      resolveLinkedRoom: (rowId) => ({ recordId: rowId === "rm_101" ? "101 - Office" : rowId }),
      onInversePillClick,
    });

    expect(screen.getByRole("columnheader", { name: /Rooms ← Space Type/ })).toBeInTheDocument();
    // The first click activates the grid cell; the second opens the linked row.
    await user.click(screen.getByRole("button", { name: "101 - Office" }));
    await user.click(screen.getByRole("button", { name: "101 - Office" }));
    expect(onInversePillClick).toHaveBeenCalledWith(slice.inverse_link_fields[0], "rm_101");
  });

  test("shows the shared add affordance for editable reverse Rooms links", async () => {
    const user = userEvent.setup();
    const onInverseLinkEdit = vi.fn();
    const slice = buildSpaceTypesSlice({
      space_types: [buildSpaceType({ id: "st_office", tag: "Office" })],
      inverse_link_fields: [
        {
          source_key: "rooms.space_type_id",
          source_table_path: ["rooms"],
          source_table_display: "Rooms",
          source_field_key: "space_type_id",
          source_field_display_name: "Space Type",
        },
      ],
      inverse_links: {
        st_office: {
          "rooms.space_type_id": [],
        },
      },
    });
    const { container } = renderTable(slice, { onInverseLinkEdit });

    await user.click(getGridCell(container, "st_office", "inverse:rooms.space_type_id"));
    await user.click(screen.getByRole("button", { name: "Add linked record" }));

    expect(onInverseLinkEdit).toHaveBeenCalledWith(
      slice.inverse_link_fields[0],
      slice.space_types[0],
    );
  });

  test("viewer mode renders without edit affordances", () => {
    renderTable(buildSpaceTypesSlice(), { isEditor: false });

    expect(screen.getByText("No Space-Types are published in this version.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Space-Type" })).not.toBeInTheDocument();
  });
});

function renderTable(
  slice: SpaceTypesSlice,
  overrides: {
    isEditor?: boolean;
    resolveLinkedRoom?: (rowId: string) => { recordId: string | null } | null;
    onInversePillClick?: Parameters<typeof SpaceTypesTable>[0]["onInversePillClick"];
    onInverseLinkEdit?: Parameters<typeof SpaceTypesTable>[0]["onInverseLinkEdit"];
  } = {},
) {
  return render(
    <SpaceTypesTable
      spaceTypesSlice={slice}
      tableSchema={schemaForSpaceTypes(slice)}
      isEditor={overrides.isEditor ?? true}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      resolveLinkedRoom={overrides.resolveLinkedRoom ?? (() => null)}
      onInversePillClick={overrides.onInversePillClick}
      onInverseLinkEdit={overrides.onInverseLinkEdit}
    />,
  );
}

function getGridCell(container: HTMLElement, rowId: string, fieldKey: string): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `td[data-row-id="${rowId}"][data-field-key="${fieldKey}"]`,
  );
  if (!cell) throw new Error(`Expected grid cell ${rowId}/${fieldKey}.`);
  return cell;
}
