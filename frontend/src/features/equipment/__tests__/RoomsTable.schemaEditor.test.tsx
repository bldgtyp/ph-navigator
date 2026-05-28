import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import { emptyViewState, type EditCustomFieldBundleRequest } from "../../../shared/ui/data-table";
import type { RoomsSlice } from "../types";
import {
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  roomsFieldDefs,
  schemaForRooms,
  withRoomCustomValues,
} from "../testing/testFixtures";

function renderEditorTable(
  slice: RoomsSlice,
  handlers: Partial<{
    onDuplicateCustomField: (fieldKey: string) => Promise<{ newFieldKey: string } | void>;
    onEditCustomFieldBundle: (request: EditCustomFieldBundleRequest) => Promise<void>;
  }> = {},
) {
  return render(
    <RoomsTable
      roomsSlice={slice}
      tableSchema={schemaForRooms(slice)}
      isEditor
      onEdit={vi.fn()}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      onDuplicateCustomField={handlers.onDuplicateCustomField}
      onEditCustomFieldBundle={handlers.onEditCustomFieldBundle}
    />,
  );
}

function openPaintMenu() {
  fireEvent.contextMenu(screen.getByRole("columnheader", { name: /^Paint\b/ }));
}

async function openPaintConfigDialog(): Promise<HTMLElement> {
  openPaintMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit field…" }));
  return screen.findByRole("dialog", { name: /Edit field/ });
}

describe("RoomsTable custom-field schema editor (plan-15 P2.7)", () => {
  test("Edit field modal submits a trimmed display name through the bundle path", async () => {
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(buildCustomField()),
    });
    renderEditorTable(slice, { onEditCustomFieldBundle });

    const dialog = await openPaintConfigDialog();
    const input = within(dialog).getByLabelText("Name");
    fireEvent.change(input, { target: { value: "  Finish  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(onEditCustomFieldBundle).toHaveBeenCalledWith({
        fieldKey: "cf_paint",
        displayName: "Finish",
        description: null,
      }),
    );
  });

  test("Edit field modal rejects duplicate names before dispatch", async () => {
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(buildCustomField()),
    });
    renderEditorTable(slice, { onEditCustomFieldBundle });

    const dialog = await openPaintConfigDialog();
    const input = within(dialog).getByLabelText("Name");
    fireEvent.change(input, { target: { value: "Name" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'A field named "Name" already exists in this table.',
    );
    expect(onEditCustomFieldBundle).not.toHaveBeenCalled();
  });

  test("Edit field modal keeps Save disabled when the field is unchanged", async () => {
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(buildCustomField()),
    });
    renderEditorTable(slice, { onEditCustomFieldBundle });

    const dialog = await openPaintConfigDialog();
    const input = within(dialog).getByLabelText("Name");
    fireEvent.change(input, { target: { value: "  Paint  " } });

    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(onEditCustomFieldBundle).not.toHaveBeenCalled();
  });

  test("Duplicate field routes through the custom-field callback", async () => {
    const onDuplicateCustomField = vi.fn().mockResolvedValue({ newFieldKey: "cf_paint_copy" });
    const slice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_paint: "blue" })],
      field_defs: roomsFieldDefs(buildCustomField()),
    });
    renderEditorTable(slice, { onDuplicateCustomField });

    openPaintMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate field" }));

    await waitFor(() => expect(onDuplicateCustomField).toHaveBeenCalledWith("cf_paint"));
  });

  test("Edit field modal seeds the current description", async () => {
    const onEditCustomFieldBundle = vi.fn().mockResolvedValue(undefined);
    const slice = buildRoomsSlice({
      rooms: [buildRoom()],
      field_defs: roomsFieldDefs(
        buildCustomField({
          description: "Existing note",
        }),
      ),
    });
    renderEditorTable(slice, { onEditCustomFieldBundle });

    const dialog = await openPaintConfigDialog();
    expect(within(dialog).getByLabelText("Description")).toHaveValue("Existing note");
  });
});
