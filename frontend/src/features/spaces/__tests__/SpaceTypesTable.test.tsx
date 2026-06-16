import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  buildTableSchema,
  emptyViewState,
  RECORD_ID_FIELD_KEY,
  type TableFieldDef,
} from "../../../shared/ui/data-table";
import { SpaceTypesTable } from "../components/SpaceTypesTable";
import {
  SPACE_TYPE_NAME_FIELD_KEY,
  SPACE_TYPES_TABLE_NAME,
  type SpaceTypeRow,
  type SpaceTypesSlice,
} from "../types";

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
    await user.click(screen.getByRole("button", { name: "101 - Office" }));
    expect(onInversePillClick).toHaveBeenCalledWith(slice.inverse_link_fields[0], "rm_101");
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
  } = {},
) {
  return render(
    <SpaceTypesTable
      spaceTypesSlice={slice}
      tableSchema={buildTableSchema({
        tableKey: SPACE_TYPES_TABLE_NAME,
        fieldDefs: slice.field_defs,
        singleSelectOptions: slice.single_select_options,
      })}
      isEditor={overrides.isEditor ?? true}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      resolveLinkedRoom={overrides.resolveLinkedRoom ?? (() => null)}
      onInversePillClick={overrides.onInversePillClick}
    />,
  );
}

function buildSpaceTypesSlice(overrides: Partial<SpaceTypesSlice> = {}): SpaceTypesSlice {
  const fieldDefs: TableFieldDef[] = [
    fieldDef(RECORD_ID_FIELD_KEY, "Tag"),
    fieldDef(SPACE_TYPE_NAME_FIELD_KEY, "Name"),
  ];
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    space_types: [],
    field_defs: fieldDefs,
    single_select_options: {},
    rows_computed: {},
    inverse_links: {},
    inverse_link_fields: [],
    inverse_links_fingerprint: "",
    ...overrides,
  };
}

function fieldDef(fieldKey: string, displayName: string): TableFieldDef {
  return {
    field_key: fieldKey,
    display_name: displayName,
    field_type: "short_text",
    config: {},
    description: null,
    origin: "built_in",
    created_at: "2026-06-16T00:00:00Z",
    created_by: null,
  };
}

function buildSpaceType({
  id = "st_1",
  tag = "Office",
  name = "Office",
}: {
  id?: string;
  tag?: string;
  name?: string;
} = {}): SpaceTypeRow {
  return {
    id,
    custom_values: {
      [RECORD_ID_FIELD_KEY]: tag,
      [SPACE_TYPE_NAME_FIELD_KEY]: name,
    },
    custom_links: {},
  };
}
