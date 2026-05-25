import { fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type EditCustomFieldDescriptionRequest,
  type RenameCustomFieldRequest,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { roomsTableFieldDefs } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

function buildCustomField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_paint",
    field_key: null,
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

function renderEditorTable(
  slice: RoomsSlice,
  handlers: Partial<{
    onRenameCustomField: (request: RenameCustomFieldRequest) => Promise<void>;
    onDuplicateCustomField: (fieldKey: string) => Promise<{ newFieldKey: string } | void>;
    onSetCustomFieldDescription: (request: EditCustomFieldDescriptionRequest) => Promise<void>;
  }> = {},
) {
  return render(
    <RoomsTable
      roomsSlice={slice}
      tableSchema={schemaFor(slice)}
      isEditor
      onEdit={vi.fn()}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      onRenameCustomField={handlers.onRenameCustomField}
      onDuplicateCustomField={handlers.onDuplicateCustomField}
      onSetCustomFieldDescription={handlers.onSetCustomFieldDescription}
    />,
  );
}

function openPaintMenu() {
  fireEvent.contextMenu(screen.getByRole("columnheader", { name: /^Paint\b/ }));
}

describe("RoomsTable custom-field schema editor (plan-15 P2.7)", () => {
  test("Rename field submits a trimmed display name", async () => {
    const onRenameCustomField = vi.fn().mockResolvedValue(undefined);
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildCustomField()],
    });
    renderEditorTable(slice, { onRenameCustomField });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename field" }));
    const input = await screen.findByLabelText("Rename Paint");
    fireEvent.change(input, { target: { value: "  Finish  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() =>
      expect(onRenameCustomField).toHaveBeenCalledWith({
        fieldKey: "cf_paint",
        displayName: "Finish",
      }),
    );
  });

  test("Rename field rejects duplicate names before dispatch", async () => {
    const onRenameCustomField = vi.fn().mockResolvedValue(undefined);
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildCustomField()],
    });
    renderEditorTable(slice, { onRenameCustomField });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename field" }));
    const input = await screen.findByLabelText("Rename Paint");
    fireEvent.change(input, { target: { value: "Name" } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'A field named "Name" already exists in this table.',
    );
    expect(onRenameCustomField).not.toHaveBeenCalled();
  });

  test("Rename field closes without dispatching when the name is unchanged", async () => {
    const onRenameCustomField = vi.fn().mockResolvedValue(undefined);
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildCustomField()],
    });
    renderEditorTable(slice, { onRenameCustomField });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename field" }));
    const input = await screen.findByLabelText("Rename Paint");
    fireEvent.change(input, { target: { value: "  Paint  " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => expect(screen.queryByLabelText("Rename Paint")).toBeNull());
    expect(onRenameCustomField).not.toHaveBeenCalled();
  });

  test("Duplicate field routes through the custom-field callback", async () => {
    const onDuplicateCustomField = vi.fn().mockResolvedValue({ newFieldKey: "cf_paint_copy" });
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField()],
    });
    renderEditorTable(slice, { onDuplicateCustomField });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate field" }));

    await waitFor(() => expect(onDuplicateCustomField).toHaveBeenCalledWith("cf_paint"));
  });

  test("Edit description opens the field-description popover", async () => {
    const onSetCustomFieldDescription = vi.fn().mockResolvedValue(undefined);
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [
        buildCustomField({
          description: "Existing note",
        }),
      ],
    });
    renderEditorTable(slice, { onSetCustomFieldDescription });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit description" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit description for Paint" });
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Existing note");
  });

  test("Edit description closes without dispatching when unchanged", async () => {
    const onSetCustomFieldDescription = vi.fn().mockResolvedValue(undefined);
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [
        buildCustomField({
          description: "Existing note",
        }),
      ],
    });
    renderEditorTable(slice, { onSetCustomFieldDescription });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit description" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit description for Paint" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit description for Paint" })).toBeNull(),
    );
    expect(onSetCustomFieldDescription).not.toHaveBeenCalled();
  });
});
