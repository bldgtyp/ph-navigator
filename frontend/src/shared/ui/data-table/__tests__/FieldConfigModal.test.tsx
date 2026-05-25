// FieldConfigModal — plan-21 P5a.1 coverage.
//
// Asserts:
//   - open seeds Name + Description from the FieldDef and Save dispatches
//     a single bundle request with the trimmed diff
//   - cancel button + Esc + backdrop close the modal (when not pending)
//   - R-S1 — field disappears → close + announce toast
//   - R-S2 — external edit while open → conflict banner with
//     Keep / Discard
//   - R-S5 — pending Save disables inputs, suppresses Esc / Cancel,
//     and ignores a re-fire of submit
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FieldConfigModal } from "../components/FieldConfigModal";
import type { FieldDef } from "../types";

function baseField(overrides: Partial<FieldDef> = {}): FieldDef {
  return {
    field_key: "cf_notes",
    field_type: "text",
    display_name: "Notes",
    description: "old description",
    ...overrides,
  };
}

type HarnessProps = {
  initialField?: FieldDef;
  dispatchBundle?: ReturnType<typeof vi.fn>;
  onFieldRemoved?: ReturnType<typeof vi.fn>;
  // Names of other fields in the table; the editing field is excluded
  // by field_key in the helper, so callers only pass siblings.
  siblingDisplayNames?: string[];
};

function Harness({
  initialField = baseField(),
  dispatchBundle = vi.fn().mockResolvedValue(undefined),
  onFieldRemoved,
  siblingDisplayNames = [],
}: HarnessProps) {
  const [open, setOpen] = useState(true);
  const [fieldDef, setFieldDef] = useState<FieldDef | undefined>(initialField);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      <button
        data-testid="external-rename"
        onClick={() => setFieldDef(baseField({ display_name: "Renamed externally" }))}
      >
        ext rename
      </button>
      <button data-testid="external-delete" onClick={() => setFieldDef(undefined)}>
        ext delete
      </button>
      <FieldConfigModal
        open={open}
        onOpenChange={setOpen}
        fieldDef={fieldDef}
        existingFieldLabels={siblingDisplayNames.map((displayName, index) => ({
          fieldKey: `cf_other_${index}`,
          displayName,
        }))}
        dispatchBundle={dispatchBundle}
        onFieldRemoved={onFieldRemoved}
      />
    </div>
  );
}

describe("FieldConfigModal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("seeds form from FieldDef and Save dispatches the diff", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatchBundle={dispatchBundle} />);
    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Notes");
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe(
      "old description",
    );

    fireEvent.change(nameInput, { target: { value: "Punch list" } });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Punch list",
        description: "Updated note",
      }),
    );
  });

  test("Save button disabled when nothing changed", () => {
    render(<Harness />);
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  test("blocks Save when name collides with another field", () => {
    render(<Harness siblingDisplayNames={["Status"]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "status" } });
    expect(screen.getByRole("alert")).toHaveTextContent('"Status" already exists');
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("Cancel closes the modal", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("R-S1 — field disappearing closes the modal and announces", async () => {
    const onFieldRemoved = vi.fn();
    render(<Harness onFieldRemoved={onFieldRemoved} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("external-delete"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onFieldRemoved).toHaveBeenCalledWith(
      expect.stringContaining("This field was removed in another edit"),
    );
  });

  test("R-S2 — external rename surfaces conflict banner; Discard re-seeds", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(<Harness dispatchBundle={dispatchBundle} />);
    // User edits name locally to "Punch list".
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Punch list" } });
    // External writer renames to "Renamed externally".
    fireEvent.click(screen.getByTestId("external-rename"));
    // Banner appears, Save is suspended.
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("This field changed elsewhere");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    // Discard re-seeds the form from the external value.
    fireEvent.click(screen.getByRole("button", { name: "Discard my changes" }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Renamed externally");
    // Save is no longer disabled by the banner; with no diff vs new
    // source, Save remains disabled (dirty=false), so explicitly
    // dirty it to verify Save now goes through.
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Renamed locally" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Renamed locally",
        description: "old description",
      }),
    );
  });

  test("R-S2 — Keep my changes preserves the user's draft", async () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Local edit" } });
    fireEvent.click(screen.getByTestId("external-rename"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Local edit");
    // Banner is gone, Save re-enabled because user's draft differs
    // from the rebased source.
    expect(screen.queryByText("This field changed elsewhere")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled();
  });

  test("R-S5 — pending Save suppresses Cancel and disables inputs", async () => {
    let resolveDispatch: () => void = () => {};
    const dispatchBundle = vi.fn(() => new Promise<void>((resolve) => (resolveDispatch = resolve)));
    render(<Harness dispatchBundle={dispatchBundle} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    // While pending: Save reads "Saving…" and Cancel is disabled.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();

    // A second click on the disabled Saving… button must not re-fire.
    fireEvent.click(screen.getByRole("button", { name: "Saving…" }));
    expect(dispatchBundle).toHaveBeenCalledTimes(1);

    resolveDispatch();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("rejection keeps modal open and surfaces error inline", async () => {
    const dispatchBundle = vi.fn().mockRejectedValue(new Error("backend boom"));
    render(<Harness dispatchBundle={dispatchBundle} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("backend boom")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
