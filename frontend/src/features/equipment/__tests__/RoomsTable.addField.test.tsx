import { fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type AddCustomFieldRequest,
  type CustomFieldDef,
  type TableSchema,
  type ViewState,
} from "../../../shared/ui/data-table";
import { roomsTableFieldDefs } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

function buildCustomField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_paint",
    field_key: "cf_paint",
    display_name: "Paint",
    field_type: "short_text",
    config: {},
    description: null,
    created_at: "2026-05-24T12:00:00Z",
    created_by: null,
    ...overrides,
  };
}

function buildRoom(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "rm_1",
    number: "101",
    name: "Living Room",
    floor_level: "opt_ground",
    building_zone: null,
    num_people: 0,
    num_bedrooms: 0,
    icfa_factor: 1,
    erv_unit_ids: [],
    catalog_origin: null,
    notes: null,
    custom: {},
    ...overrides,
  };
}

function buildSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return {
    project_id: "00000000-0000-0000-0000-000000000001",
    version_id: "00000000-0000-0000-0000-000000000002",
    source: "draft",
    version_etag: "v-etag",
    draft_etag: "d-etag",
    rooms: [],
    custom_fields: [],
    single_select_options: {
      "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
      "rooms.building_zone": [],
    },
    ...overrides,
  };
}

function schemaFor(slice: RoomsSlice): TableSchema {
  return renderHook(() =>
    useTableSchema({
      tableKey: ROOMS_TABLE_NAME,
      coreFieldDefs: roomsTableFieldDefs(slice),
      customFields: slice.custom_fields,
    }),
  ).result.current;
}

// Drives a refetch by swapping the slice's custom_fields after the
// add dispatch resolves — the production code path achieves the same
// effect by invalidating the rooms query.
function Harness({
  initialSlice,
  postAddSlice,
  onDispatch,
}: {
  initialSlice: RoomsSlice;
  postAddSlice?: RoomsSlice;
  onDispatch?: (request: AddCustomFieldRequest) => Promise<{ newFieldKey: string }>;
}) {
  const [slice, setSlice] = useState(initialSlice);
  const [view, setView] = useState<ViewState>(emptyViewState());
  const schema = useTableSchema({
    tableKey: ROOMS_TABLE_NAME,
    coreFieldDefs: roomsTableFieldDefs(slice),
    customFields: slice.custom_fields,
  });
  return (
    <RoomsTable
      roomsSlice={slice}
      tableSchema={schema}
      isEditor
      onEdit={vi.fn()}
      view={view}
      onViewChange={setView}
      onWrite={vi.fn()}
      onAddCustomField={
        onDispatch ??
        (async () => {
          const newFieldKey = "cf_notes";
          if (postAddSlice) setSlice(postAddSlice);
          return { newFieldKey };
        })
      }
    />
  );
}

describe("RoomsTable add custom field (plan-15 P2.6)", () => {
  test("tail + button opens the add-field modal", async () => {
    const slice = buildSlice({ rooms: [buildRoom()] });
    render(<Harness initialSlice={slice} />);
    const tailButton = screen.getByRole("button", { name: "Add field" });
    fireEvent.click(tailButton);
    expect(await screen.findByRole("dialog", { name: "Add field" })).toBeInTheDocument();
  });

  test("happy-path add dispatches the request and closes the modal", async () => {
    const slice = buildSlice({ rooms: [buildRoom()] });
    const dispatch = vi.fn().mockResolvedValue({ newFieldKey: "cf_notes" });
    render(<Harness initialSlice={slice} onDispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const dialog = await screen.findByRole("dialog", { name: "Add field" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Notes" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.displayName).toBe("Notes");
    expect(request.fieldType).toBe("short_text");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add field" })).toBeNull());
  });

  test("viewer mode hides the add-field affordance", () => {
    const slice = buildSlice({ rooms: [buildRoom()] });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor={false}
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        // No onAddCustomField — viewer mode never wires it.
      />,
    );
    expect(screen.queryByRole("button", { name: "Add field" })).toBeNull();
  });

  test("after a successful add, the new column appears in the grid", async () => {
    const initialSlice = buildSlice({ rooms: [buildRoom()] });
    const postSlice = buildSlice({
      rooms: [buildRoom({ custom: { cf_notes: null } })],
      custom_fields: [buildCustomField({ field_key: "cf_notes", display_name: "Notes" })],
    });
    render(<Harness initialSlice={initialSlice} postAddSlice={postSlice} />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const dialog = await screen.findByRole("dialog", { name: "Add field" });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: "Notes" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Add field/ }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add field" })).toBeNull());
    expect(screen.getByRole("columnheader", { name: /^Notes\b/ })).toBeInTheDocument();
  });
});
