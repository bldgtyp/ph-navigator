import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { CreateFieldConfigModal } from "../components/CreateFieldConfigModal";
import type { AddCustomFieldRequest } from "../types";
import { ApiRequestError } from "../../../api/client";
import { chooseAutocompleteOption } from "./helpers/autocomplete";

type HarnessProps = {
  dispatch?: (request: AddCustomFieldRequest) => Promise<void>;
  existingFieldLabels?: ReadonlyArray<string>;
  insertAfterFieldKey?: string | null;
  initialOpen?: boolean;
  formulaFieldRegistry?: ReadonlyArray<{
    field_id: string;
    display_name: string;
    origin: "core" | "custom";
    field_type: "text" | "number" | "single_select" | "formula" | "bool";
  }>;
  linkedRecordTargets?: ReadonlyArray<{ path: string[]; label: string }>;
};

function Harness({
  dispatch = async () => undefined,
  existingFieldLabels = ["Number", "Floor"],
  insertAfterFieldKey = null,
  initialOpen = true,
  formulaFieldRegistry,
  linkedRecordTargets,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
        anchor
      </button>
      <CreateFieldConfigModal
        open={open}
        onOpenChange={setOpen}
        insertAfterFieldKey={insertAfterFieldKey}
        existingFieldLabels={existingFieldLabels.map((displayName, index) => ({
          fieldKey: `field_${index}`,
          displayName,
        }))}
        dispatchAddField={dispatch}
        returnFocusTo={anchorRef.current}
        formulaFieldRegistry={formulaFieldRegistry}
        linkedRecordTargets={linkedRecordTargets}
      />
    </>
  );
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: "Add field" });
}

function typeName(value: string) {
  const nameInput = within(dialog()).getByLabelText("Name") as HTMLInputElement;
  fireEvent.change(nameInput, { target: { value } });
}

function chooseFieldType(label: string) {
  chooseAutocompleteOption("Field type", label, dialog());
}

function clickAdd() {
  fireEvent.click(within(dialog()).getByRole("button", { name: /Add field/ }));
}

describe("CreateFieldConfigModal", () => {
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
    chooseFieldType(label);
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
    chooseFieldType("Number");
    const precision = within(dialog()).getByLabelText("Decimal precision") as HTMLInputElement;
    fireEvent.change(precision, { target: { value: "3" } });
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.fieldType).toBe("number");
    expect(request.config).toEqual({ precision: 3 });
  });

  test("optional description flows into the request", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    const textarea = within(dialog()).getByLabelText("Description") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "  Free-form notes about the room.  " } });
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.description).toBe("Free-form notes about the room.");
  });

  test("inline duplicate-name preflight blocks submit with the offending name", () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} existingFieldLabels={["Notes", "Number"]} />);
    typeName("  notes  ");
    expect(within(dialog()).getByText(/A field named "notes" already exists/i)).toBeInTheDocument();
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

  test("server-side custom_field_duplicate_name leaves the modal open with an inline message", async () => {
    const response = new Response(null, { status: 422, statusText: "Unprocessable Entity" });
    const error = new ApiRequestError(response, {
      error_code: "custom_field_duplicate_name",
      message: "duplicate",
      request_id: "req",
      details: { field_name: "Notes" },
    });
    const dispatch = vi.fn().mockRejectedValue(error);
    render(<Harness dispatch={dispatch} existingFieldLabels={["Number"]} />);
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

  test("Phase 4 enables Formula alongside single_select", () => {
    render(<Harness />);
    fireEvent.focus(within(dialog()).getByRole("combobox", { name: "Field type" }));
    expect(within(dialog()).getByRole("option", { name: /^Single select/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(dialog()).getByRole("option", { name: /^Formula/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("single_select default picker lands in config.default_option_id", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Status");
    chooseFieldType("Single select");
    fireEvent.change(within(dialog()).getByLabelText("Option label 1"), {
      target: { value: "Open" },
    });
    fireEvent.focus(within(dialog()).getByRole("combobox", { name: "Default option" }));
    fireEvent.click(within(dialog()).getByRole("option", { name: "Open" }));
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    const initialOptions = request.initialOptions;
    expect(initialOptions).toBeDefined();
    const optionId = initialOptions?.[0]?.id;
    expect(optionId).toBeTruthy();
    expect(request.fieldType).toBe("single_select");
    expect(request.config).toEqual({ default_option_id: optionId });
    expect(initialOptions).toEqual([
      expect.objectContaining({ id: optionId, label: "Open", order: 1 }),
    ]);
  });

  test("single_select defaults to null when no default is picked", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    typeName("Status");
    chooseFieldType("Single select");
    fireEvent.change(within(dialog()).getByLabelText("Option label 1"), {
      target: { value: "Open" },
    });
    clickAdd();
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
    expect(request.config).toEqual({ default_option_id: null });
  });

  test("Cancel closes the modal without dispatching", () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />);
    typeName("Notes");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Add field" })).toBeNull();
  });

  test("Escape closes the modal", () => {
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

  describe("formula pill (P4.9)", () => {
    const registry = [
      { field_id: "name", display_name: "Name", origin: "core", field_type: "text" },
      { field_id: "number", display_name: "Number", origin: "core", field_type: "text" },
    ] as const;

    test("selecting Formula reveals the expression input", () => {
      render(<Harness formulaFieldRegistry={registry} />);
      chooseFieldType("Formula");
      expect(within(dialog()).getByLabelText("Expression")).toBeInTheDocument();
    });

    test("Submit dispatches a formula request with parsed AST + deps", async () => {
      const dispatch = vi.fn().mockResolvedValue(undefined);
      render(<Harness dispatch={dispatch} formulaFieldRegistry={registry} />);
      typeName("Label");
      chooseFieldType("Formula");
      const expression = within(dialog()).getByLabelText("Expression") as HTMLInputElement;
      fireEvent.change(expression, { target: { value: '{Number} & " - " & upper({Name})' } });
      clickAdd();
      await waitFor(() => expect(dispatch).toHaveBeenCalled());
      const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
      expect(request.fieldType).toBe("formula");
      expect(request.config.source).toBe('{Number} & " - " & upper({Name})');
      expect(Array.isArray((request.config as { deps?: unknown[] }).deps)).toBe(true);
      expect((request.config as { deps: string[] }).deps).toEqual(["number", "name"]);
      expect((request.config as { ast: unknown }).ast).toBeTruthy();
    });

    test("Submit stays disabled while the formula is unparseable", () => {
      const dispatch = vi.fn();
      render(<Harness dispatch={dispatch} formulaFieldRegistry={registry} />);
      typeName("Label");
      chooseFieldType("Formula");
      const expression = within(dialog()).getByLabelText("Expression") as HTMLInputElement;
      fireEvent.change(expression, { target: { value: "upper(" } });
      const submit = within(dialog()).getByRole("button", {
        name: /Add field/,
      }) as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
      const alert = within(dialog()).getByRole("alert");
      expect(alert).toHaveTextContent("Formula syntax error");
      expect(alert).toHaveTextContent(/Add an operator such as \+, -, \*, \//);
    });

    test("Submit surfaces missing-ref errors locally", () => {
      render(<Harness formulaFieldRegistry={registry} />);
      typeName("Label");
      chooseFieldType("Formula");
      const expression = within(dialog()).getByLabelText("Expression") as HTMLInputElement;
      fireEvent.change(expression, { target: { value: "upper({Nonexistent})" } });
      const submit = within(dialog()).getByRole("button", {
        name: /Add field/,
      }) as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
      const alert = within(dialog()).getByRole("alert");
      expect(alert).toHaveTextContent("Field not found");
      expect(alert).toHaveTextContent('No field named "Nonexistent" exists in this table.');
    });

    test("unsupported functions list available alternatives", () => {
      render(<Harness formulaFieldRegistry={registry} />);
      typeName("Label");
      clickPill("Formula");
      const expression = within(dialog()).getByLabelText("Expression") as HTMLInputElement;
      fireEvent.change(expression, { target: { value: "missing({Name})" } });
      const alert = within(dialog()).getByRole("alert");
      expect(alert).toHaveTextContent("Function not supported");
      expect(alert).toHaveTextContent("Available functions: concat, len, lower");
    });

    test("autocomplete inserts a reference at the textarea caret", () => {
      render(<Harness formulaFieldRegistry={registry} />);
      clickPill("Formula");
      const expression = within(dialog()).getByLabelText("Expression") as HTMLTextAreaElement;
      fireEvent.change(expression, { target: { value: "upper()" } });
      expression.focus();
      expression.setSelectionRange(6, 6);
      fireEvent.change(expression, { target: { value: "upper({N)" } });
      expression.setSelectionRange(8, 8);
      fireEvent.select(expression);
      fireEvent.click(within(dialog()).getByRole("option", { name: "Name Text column" }));
      expect(expression.value).toBe("upper({Name})");
    });
  });

  // §A3 regression: the "+" create flow had no linked_record branch at
  // all, so a Phase-1 user couldn't create a linked_record field
  // through the only on-grid add affordance. These tests pin the
  // section render, the Save gate, and the dispatched request shape.
  describe("linked_record", () => {
    const TARGETS = [{ path: ["equipment", "pumps"], label: "Pumps" }];

    test("Save stays disabled until a target table is picked", () => {
      render(<Harness linkedRecordTargets={TARGETS} />);
      typeName("Pumps");
      chooseFieldType("Linked record");
      const submit = within(dialog()).getByRole("button", {
        name: /Add field/,
      }) as HTMLButtonElement;
      expect(submit.disabled).toBe(true);
    });

    test("dispatches a linked_record request with target_table_path + max_links", async () => {
      const dispatch = vi.fn().mockResolvedValue(undefined);
      render(<Harness dispatch={dispatch} linkedRecordTargets={TARGETS} />);
      typeName("Pumps");
      chooseFieldType("Linked record");
      const select = within(dialog()).getByLabelText("Target table") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "equipment/pumps" } });
      clickAdd();
      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
      const request = dispatch.mock.calls[0]?.[0] as AddCustomFieldRequest;
      expect(request.fieldType).toBe("linked_record");
      expect(request.config).toEqual({
        target_table_path: ["equipment", "pumps"],
        max_links: 1,
      });
    });
  });
});
