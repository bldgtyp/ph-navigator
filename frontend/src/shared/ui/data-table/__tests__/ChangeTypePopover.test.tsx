import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { ChangeTypePopover, type ChangeTypeRequest } from "../components/ChangeTypePopover";
import type { CustomFieldType } from "../hooks/useTableSchema";
import type { FieldDef } from "../types";

// Plan-18 §5b F2 — ChangeTypePopover was shipped without a component
// test. These cases pin the preflight counter, the acknowledgement
// gating, and the dispatched mutation shape.

type Row = { id: string; value: unknown };

const FIELD_DEF: FieldDef = {
  field_key: "cf_v",
  field_type: "text",
  display_name: "Val",
};

type HarnessProps = {
  fromType?: CustomFieldType;
  rows?: ReadonlyArray<Row>;
  dispatch?: (request: ChangeTypeRequest) => Promise<void>;
  initialOpen?: boolean;
};

function Harness({
  fromType = "short_text",
  rows = [
    { id: "rm_1", value: "42" },
    { id: "rm_2", value: "abc" },
    { id: "rm_3", value: "7.5" },
  ],
  dispatch = async () => undefined,
  initialOpen = true,
}: HarnessProps) {
  const [open, setOpen] = useState(initialOpen);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchorRef} type="button" data-testid="change-type-anchor">
        anchor
      </button>
      <ChangeTypePopover<Row>
        open={open}
        onOpenChange={setOpen}
        anchorElement={anchorRef.current}
        fieldDef={FIELD_DEF}
        fromType={fromType}
        rows={rows}
        getRowId={(row) => row.id}
        accessor={(row) => row.value}
        dispatchChangeType={dispatch}
      />
    </>
  );
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: /Change type of Val/ });
}

function pickTarget(label: string) {
  fireEvent.click(within(dialog()).getByRole("radio", { name: label }));
}

describe("ChangeTypePopover (plan-18 §5b F2)", () => {
  test("a clean preflight enables Convert without the acknowledgement checkbox", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        rows={[
          { id: "rm_1", value: "42" },
          { id: "rm_2", value: "7.5" },
        ]}
        dispatch={dispatch}
      />,
    );
    pickTarget("Number");

    // No "I understand…" checkbox appears for a clean preflight.
    expect(
      within(dialog()).queryByLabelText(/I understand the listed values will be cleared/),
    ).toBeNull();

    const submit = within(dialog()).getByRole("button", { name: "Convert" });
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch.mock.calls[0]?.[0]).toEqual({
      fieldKey: "cf_v",
      fromType: "short_text",
      toType: "number",
      acknowledgeDestructive: false,
    });
  });

  test("incompatible rows trigger the acknowledgement gate and show the counter", () => {
    render(<Harness />);
    pickTarget("Number");

    // 2 of 3 coerce ("42" and "7.5"); the "abc" row is incompatible.
    expect(
      within(dialog()).getByText(/2 of 3 rows will keep their value; 1 will be cleared/),
    ).toBeInTheDocument();

    const submit = within(dialog()).getByRole("button", {
      name: /Convert anyway \(1 cleared\)/,
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const ack = within(dialog()).getByLabelText(
      /I understand the listed values will be cleared/,
    ) as HTMLInputElement;
    expect(ack.checked).toBe(false);
    fireEvent.click(ack);
    expect(submit.disabled).toBe(false);
  });

  test("incompatible row table lists the row id, raw value, and reason", () => {
    render(<Harness />);
    pickTarget("Number");
    const list = within(dialog()).getByRole("list");
    const item = within(list).getByText("rm_2");
    expect(item).toBeInTheDocument();
    // The raw "abc" appears alongside.
    expect(within(list).getByText("abc")).toBeInTheDocument();
  });

  test("Convert anyway dispatches with acknowledgeDestructive: true", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatch={dispatch} />);
    pickTarget("Number");
    fireEvent.click(
      within(dialog()).getByLabelText(/I understand the listed values will be cleared/),
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: /Convert anyway/ }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    expect(dispatch.mock.calls[0]?.[0]).toEqual({
      fieldKey: "cf_v",
      fromType: "short_text",
      toType: "number",
      acknowledgeDestructive: true,
    });
  });

  test("illegal target pill is disabled with an explanatory tooltip", () => {
    // number → url is forbidden by the conversion matrix (plan-13 D19).
    render(<Harness fromType="number" />);
    const urlPill = within(dialog()).getByRole("radio", { name: "URL" }) as HTMLButtonElement;
    expect(urlPill.disabled).toBe(true);
    expect(urlPill.title.toLowerCase()).toContain("cannot convert number");
  });

  test("server preflight envelope re-renders the popover with the server's row list", async () => {
    // Simulate the backend returning `custom_field_coercion_preflight_required`
    // with structured details. The popover should swap to the server
    // payload and require an ack matching the server's row count.
    const error = Object.assign(new Error("preflight"), {
      details: {
        incompatible_rows: [{ rowId: "rm_x", rawValue: "from-server", reason: "type_mismatch" }],
        total_row_count: 4,
      },
    });
    const dispatch = vi.fn().mockRejectedValueOnce(error);
    render(
      <Harness
        rows={[
          { id: "rm_1", value: "42" },
          { id: "rm_2", value: "7.5" },
        ]}
        dispatch={dispatch}
      />,
    );
    pickTarget("Number");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Convert" }));

    await waitFor(() =>
      expect(
        within(dialog()).getByText(/3 of 4 rows will keep their value; 1 will be cleared/),
      ).toBeInTheDocument(),
    );
    // Server-supplied row id surfaces in the list.
    expect(within(dialog()).getByText("rm_x")).toBeInTheDocument();
    expect(within(dialog()).getByText("from-server")).toBeInTheDocument();
  });

  test("Cancel closes the popover without dispatching", () => {
    const dispatch = vi.fn();
    render(<Harness dispatch={dispatch} />);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /Change type of Val/ })).toBeNull();
  });
});
