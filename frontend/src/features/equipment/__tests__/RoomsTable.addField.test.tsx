import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  type AddCustomFieldRequest,
  type ViewState,
} from "../../../shared/ui/data-table";
import type { RoomsSlice } from "../types";
import {
  buildCustomField,
  buildRoom,
  buildRoomsSlice,
  schemaForRooms,
  useRoomsTableSchema,
  withRoomCustomValues,
} from "../testing/testFixtures";

// Drives a refetch by swapping the slice's field_defs after the
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
  const schema = useRoomsTableSchema(slice);
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
    const slice = buildRoomsSlice({ rooms: [buildRoom()] });
    render(<Harness initialSlice={slice} />);
    const tailButton = screen.getByRole("button", { name: "Add field" });
    fireEvent.click(tailButton);
    expect(await screen.findByRole("dialog", { name: "Add field" })).toBeInTheDocument();
  });

  test("happy-path add dispatches the request and closes the modal", async () => {
    const slice = buildRoomsSlice({ rooms: [buildRoom()] });
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
    const slice = buildRoomsSlice({ rooms: [buildRoom()] });
    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaForRooms(slice)}
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
    const initialSlice = buildRoomsSlice({ rooms: [buildRoom()] });
    const notesField = buildCustomField({ field_key: "cf_notes", display_name: "Notes" });
    const postSlice = buildRoomsSlice({
      rooms: [withRoomCustomValues(buildRoom(), { cf_notes: null })],
      field_defs: [...initialSlice.field_defs, notesField],
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
