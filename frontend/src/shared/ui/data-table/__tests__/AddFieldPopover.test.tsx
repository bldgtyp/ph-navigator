import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  AddFieldPopover,
  type AddCustomFieldRequest,
} from "../components/AddFieldPopover";
import { ApiRequestError } from "../../../api/client";

type HarnessProps = {
  dispatch?: (request: AddCustomFieldRequest) => Promise<void>;
  existingFieldNames?: ReadonlyArray<string>;
  insertAfterFieldKey?: string | null;
  initialOpen?: boolean;
};

function Harness({
  dispatch = async () => undefined,
  existingFieldNames = ["Number", "Floor"],
  insertAfterFieldKey = null,
  initialOpen = true,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
        anchor
      </button>
      <AddFieldPopover
        open={open}
        onOpenChange={setOpen}
        anchorElement={anchorRef.current}
        insertAfterFieldKey={insertAfterFieldKey}
        existingFieldNames={existingFieldNames}
        dispatchAddField={dispatch}
      />
    </>
  );
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "Add field" });
}

function typeName(value: string) {
  const nameInput = within(dialog()).getByLabelText("Field name") as HTMLInputElement;
  fireEvent.change(nameInput, { target: { value } });
}

function clickPill(label: string) {
  const pill = within(dialog()).getByRole("radio", { name: label });
  fireEvent.click(pill);
}

function clickAdd() {
  fireEvent.click(within(dialog()).getByRole("button", { name: /Add field/ }));
}

describe("AddFieldPopover", () => {
  test("dispatches a short_text request for the happy path", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request).toEqual({
      displayName: "Notes",
      fieldType: "short_text",
      config: {},
      description: null,
      insertAfterFieldKey: null,
    });
  });

  test.each([
    ["Long text", "long_text"],
    ["URL", "url"],
  ] as const)("dispatches the chosen %s type", async (label, expected) => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    clickPill(label);
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.fieldType).toBe(expected);
    expect(request.config).toEqual({});
  });

  test("number type exposes a precision config that lands on the wire", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Score");
    clickPill("Number");
    const precision = within(dialog()).getByLabelText("Decimal precision") as HTMLInputElement;
    fireEvent.change(precision, { target: { value: "3" } });
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.fieldType).toBe("number");
    expect(request.config).toEqual({ precision: 3 });
  });

  test("optional description flows into the request when expanded", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    fireEvent.click(within(dialog()).getByLabelText("Add description"));
    const textarea = within(dialog()).getByLabelText("Field description") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "  Free-form notes about the room.  " } });
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.description).toBe("Free-form notes about the room.");
  });

  test("inline duplicate-name preflight blocks submit with the offending name", () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} existingFieldNames={["Notes", "Number"]} />);
    typeName("  notes  ");
    expect(
      within(dialog()).getByText(/A field named "notes" already exists/i),
    ).toBeInTheDocument();
    const addButton = within(dialog()).getByRole("button", {
      name: /Add field/,
    }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    clickAdd();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test("blank name keeps the Add button disabled", () => {
    render(<Harness />);
    typeName("   ");
    const addButton = within(dialog()).getByRole("button", {
      name: /Add field/,
    }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
  });

  test("server-side custom_field_duplicate_name leaves the popover open with an inline message", async () => {
    const response = new Response(null, { status: 422, statusText: "Unprocessable Entity" });
    const error = new ApiRequestError(response, {
      error_code: "custom_field_duplicate_name",
      message: "duplicate",
      request_id: "req",
      details: { field_name: "Notes" },
    });
    const dispatch = vi.fn().mockRejectedValue(error);
    render(<Harness dispatch={dispatch} existingFieldNames={["Number"]} />);
    typeName("Notes");
    clickAdd();
    await waitFor(() =>
      expect(within(dialog()).getByRole("alert")).toHaveTextContent(
        /A field named "Notes" already exists/i,
      ),
    );
    expect(screen.queryByRole("dialog", { name: "Add field" })).toBeInTheDocument();
  });

  test("server-side stale-fingerprint message names the recovery action", async () => {
    const response = new Response(null, { status: 409, statusText: "Conflict" });
    const error = new ApiRequestError(response, {
      error_code: "custom_field_stale_schema_fingerprint",
      message: "stale",
      request_id: "req",
      details: { expected_fingerprint: "abc", actual_fingerprint: "def" },
    });
    const dispatch = vi.fn().mockRejectedValue(error);
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    clickAdd();
    await waitFor(() =>
      expect(within(dialog()).getByRole("alert")).toHaveTextContent(/Refresh and try again/i),
    );
  });

  test("Phase-3 / 4 type pills render disabled with planned-phase tooltip", () => {
    render(<Harness />);
    const single = within(dialog()).getByRole("radio", {
      name: "Single select",
    }) as HTMLButtonElement;
    const formula = within(dialog()).getByRole("radio", {
      name: "Formula",
    }) as HTMLButtonElement;
    expect(single.disabled).toBe(true);
    expect(formula.disabled).toBe(true);
    expect(single.title).toMatch(/Phase 3/);
    expect(formula.title).toMatch(/Phase 4/);
  });

  test("Cancel closes the popover without dispatching", () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Add field" })).toBeNull();
  });

  test("Escape closes the popover", () => {
    render(<Harness />);
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Add field" })).toBeNull();
  });

  test("insertAfterFieldKey forwards verbatim to the request", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} insertAfterFieldKey="cf_existing" />);
    typeName("Notes");
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.insertAfterFieldKey).toBe("cf_existing");
  });
});
