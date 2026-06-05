// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
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
import type { CustomFieldType, FieldDef } from "../types";

function baseField(overrides: Partial<FieldDef> = {}): FieldDef {
  return {
    field_key: "cf_notes",
    field_type: "text",
    display_name: "Notes",
    description: "old description",
    ...overrides,
  };
}

type PreflightSourceRow = { rowId: string; rawValue: unknown };

function chooseAutocompleteOption(label: string, optionName: string) {
  fireEvent.focus(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

type HarnessProps = {
  initialField?: FieldDef;
  dispatchBundle?: ReturnType<typeof vi.fn>;
  onFieldRemoved?: ReturnType<typeof vi.fn>;
  // Names of other fields in the table; the editing field is excluded
  // by field_key in the helper, so callers only pass siblings.
  siblingDisplayNames?: string[];
  sourceCustomFieldType?: CustomFieldType;
  preflightRows?: ReadonlyArray<PreflightSourceRow>;
  optionRows?: ReadonlyArray<PreflightSourceRow>;
};

function Harness({
  initialField = baseField(),
  dispatchBundle = vi.fn().mockResolvedValue(undefined),
  onFieldRemoved,
  siblingDisplayNames = [],
  sourceCustomFieldType,
  preflightRows,
  optionRows,
}: HarnessProps) {
  const [open, setOpen] = useState(true);
  const [fieldDef, setFieldDef] = useState<FieldDef | undefined>(initialField);
  const [rows, setRows] = useState<ReadonlyArray<PreflightSourceRow> | undefined>(preflightRows);
  const [formulaRowsRevision, setFormulaRowsRevision] = useState(0);
  const [formulaPreviewValues, setFormulaPreviewValues] = useState<Record<string, unknown>>({
    num_people: 2,
  });
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
      <button
        data-testid="external-type"
        onClick={() =>
          setFieldDef(
            baseField({
              field_type: "number",
              custom_field_type: "number",
              display_name: fieldDef?.display_name ?? "Notes",
            }),
          )
        }
      >
        ext type
      </button>
      <button data-testid="external-delete" onClick={() => setFieldDef(undefined)}>
        ext delete
      </button>
      <button
        data-testid="rows-mutate"
        onClick={() => {
          setRows((current) => [...(current ?? []), { rowId: "rm_new", rawValue: "x" }]);
          setFormulaPreviewValues({ num_people: 10 });
          setFormulaRowsRevision((current) => current + 1);
        }}
      >
        mutate rows
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
        sourceCustomFieldType={sourceCustomFieldType ?? fieldDef?.custom_field_type}
        preflightRows={rows}
        optionRows={optionRows ?? rows}
        formulaPreview={{
          fieldRegistry: [
            {
              field_id: "num_people",
              display_name: "People",
              field_type: "number",
              origin: "core",
            },
            {
              field_id: "cf_notes",
              display_name: "Notes",
              field_type: "formula",
              origin: "custom",
            },
          ],
          row: { id: "rm_1", values: formulaPreviewValues },
          rowsRevision: formulaRowsRevision,
        }}
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

  test("R-S2 — Discard after external type change re-seeds the type picker", async () => {
    render(
      <Harness
        initialField={baseField({ custom_field_type: "short_text" })}
        preflightRows={[{ rowId: "rm_1", rawValue: "42" }]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Long text" }));
    expect(screen.getByRole("group", { name: /short_text → long_text/ })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("external-type"));
    expect(await screen.findByRole("alert")).toHaveTextContent("This field changed elsewhere");
    fireEvent.click(screen.getByRole("button", { name: "Discard my changes" }));

    expect(screen.getByRole("radio", { name: "Number" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("group", { name: /short_text → long_text/ })).toBeNull();
  });

  test("R-S2 — Keep after external type change preserves the local draft", async () => {
    render(
      <Harness
        initialField={baseField({ custom_field_type: "short_text" })}
        preflightRows={[{ rowId: "rm_1", rawValue: "42" }]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Local edit" } });
    fireEvent.click(screen.getByRole("radio", { name: "Long text" }));

    fireEvent.click(screen.getByTestId("external-type"));
    expect(await screen.findByRole("alert")).toHaveTextContent("This field changed elsewhere");
    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));

    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Local edit");
    expect(screen.getByRole("radio", { name: "Long text" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
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

  // ---- plan-21 P5a.2 — Type picker + change-type sub-panel ----

  test("Type picker hidden when sourceCustomFieldType omitted (P5a.1 back-compat)", () => {
    render(<Harness />);
    expect(screen.queryByRole("radiogroup", { name: "Field type" })).toBeNull();
  });

  test("Type picker renders all candidates with the current type selected", () => {
    render(<Harness sourceCustomFieldType="short_text" preflightRows={[]} />);
    const picker = screen.getByRole("radiogroup", { name: "Field type" });
    const current = screen.getByRole("radio", { name: "Short text" });
    expect(picker).toBeInTheDocument();
    expect(current).toHaveAttribute("aria-checked", "true");
  });

  test("Forbidden conversion target is aria-disabled with a tooltip", () => {
    // number → url is forbidden by CONVERSION_MATRIX.
    render(<Harness sourceCustomFieldType="number" preflightRows={[]} />);
    const urlPill = screen.getByRole("radio", { name: "URL" }) as HTMLButtonElement;
    expect(urlPill.disabled).toBe(true);
    expect(urlPill.title.toLowerCase()).toContain("cannot convert number");
  });

  test("Selecting a compatible target mounts the inline preflight sub-panel", () => {
    render(
      <Harness
        sourceCustomFieldType="short_text"
        preflightRows={[
          { rowId: "rm_1", rawValue: "42" },
          { rowId: "rm_2", rawValue: "7.5" },
        ]}
      />,
    );
    expect(screen.queryByRole("group", { name: /Type change preflight/ })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    expect(screen.getByRole("group", { name: /short_text → number/ })).toBeInTheDocument();
    // Clean preflight: 2 of 2 keep.
    expect(screen.getByText(/2 of 2 rows will keep their value\./)).toBeInTheDocument();
  });

  test("Reverting type to source unmounts the sub-panel", () => {
    render(<Harness sourceCustomFieldType="short_text" preflightRows={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    expect(screen.getByRole("group", { name: /Type change preflight/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Short text" }));
    expect(screen.queryByRole("group", { name: /Type change preflight/ })).toBeNull();
  });

  test("Save with type change emits fieldType + (no ack needed) on clean preflight", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        sourceCustomFieldType="short_text"
        preflightRows={[{ rowId: "rm_1", rawValue: "42" }]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Notes",
        description: "old description",
        fieldType: "number",
        numberPrecision: 2,
      }),
    );
  });

  test("Save is gated on the ack when the preflight has incompatible rows", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        sourceCustomFieldType="short_text"
        preflightRows={[
          { rowId: "rm_1", rawValue: "42" },
          { rowId: "rm_2", rawValue: "abc" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    expect(
      screen.getByText(/1 of 2 rows will keep their value; 1 will be cleared\./),
    ).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    const ack = screen.getByLabelText(/I understand the listed values will be cleared/);
    fireEvent.click(ack);
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Notes",
        description: "old description",
        fieldType: "number",
        acknowledgeDestructive: true,
        numberPrecision: 2,
      }),
    );
  });

  test("number fields mount the precision section and save precision in the bundle", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 4,
        })}
      />,
    );

    const precision = screen.getByLabelText("Decimal precision") as HTMLInputElement;
    expect(precision.value).toBe("4");
    fireEvent.change(precision, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Notes",
        description: "old description",
        numberPrecision: 1,
      }),
    );
  });

  test("plain number fields expose Add units without changing default Save state", () => {
    render(
      <Harness
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 4,
        })}
      />,
    );

    expect(screen.getByLabelText("Decimal precision")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add units" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("number fields add editable units and save the complete units config", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 2,
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add units" }));
    chooseAutocompleteOption("Unit type", "Length");
    fireEvent.change(screen.getByLabelText("IP decimal precision"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Notes",
        description: "old description",
        numberUnits: {
          mode: "editable",
          unit_type: "length",
          si_unit: "m",
          ip_unit: "ft",
          precision_si: 2,
          precision_ip: 3,
        },
      }),
    );
  });

  test("fixed number units are visible but disabled", () => {
    render(
      <Harness
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 2,
          numberUnits: {
            mode: "fixed",
            unit_type: "density",
            si_unit: "kg_m3",
            ip_unit: "lb_ft3",
            precision_si: 1,
            precision_ip: 2,
          },
        })}
      />,
    );

    expect(screen.getByRole("group", { name: "Units" })).toBeInTheDocument();
    expect(screen.getByLabelText("Unit type")).toBeDisabled();
    expect(screen.getByLabelText("SI decimal precision")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove units" })).toBeNull();
    expect(screen.getByText("Units are fixed by this catalog field.")).toBeInTheDocument();
  });

  test("removing editable units sends null units without touching cell values", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 2,
          numberUnits: {
            mode: "editable",
            unit_type: "density",
            si_unit: "kg_m3",
            ip_unit: "lb_ft3",
            precision_si: 1,
            precision_ip: 2,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove units" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Notes",
        description: "old description",
        numberUnits: null,
      }),
    );
  });

  test("changing Number with Units to Single-select does not resend units", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        preflightRows={[{ rowId: "rm_1", rawValue: "1000" }]}
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 2,
          numberUnits: {
            mode: "editable",
            unit_type: "length",
            si_unit: "m",
            ip_unit: "ft",
            precision_si: 2,
            precision_ip: 2,
          },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Single select" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldKey: "cf_notes",
          fieldType: "single_select",
        }),
      ),
    );
    expect(dispatchBundle.mock.calls[0]?.[0]).not.toHaveProperty("numberUnits");
  });

  test("number fields do not resend precision when only another property changes", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 4,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Score" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Score",
        description: "old description",
      }),
    );
  });

  test("precision input clamps values to the supported range", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "number",
          custom_field_type: "number",
          numberPrecision: 4,
        })}
      />,
    );

    const precision = screen.getByLabelText("Decimal precision") as HTMLInputElement;
    fireEvent.change(precision, { target: { value: "99" } });
    expect(precision.value).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith(
        expect.objectContaining({
          numberPrecision: 10,
        }),
      ),
    );
  });

  test("R-S3 — row mutation while preflight visible invalidates the ack", () => {
    render(
      <Harness
        sourceCustomFieldType="short_text"
        preflightRows={[
          { rowId: "rm_1", rawValue: "42" },
          { rowId: "rm_2", rawValue: "abc" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    const ack = screen.getByLabelText(
      /I understand the listed values will be cleared/,
    ) as HTMLInputElement;
    fireEvent.click(ack);
    expect(ack.checked).toBe(true);
    // External row mutation re-runs preflight and clears the ack.
    fireEvent.click(screen.getByTestId("rows-mutate"));
    const ackAfter = screen.getByLabelText(
      /I understand the listed values will be cleared/,
    ) as HTMLInputElement;
    expect(ackAfter.checked).toBe(false);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("single-select options section saves options and default option in the bundle", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "single_select",
          custom_field_type: "single_select",
          options: [
            { id: "opt_a", label: "A", color: "#3b82f6", order: 1 },
            { id: "opt_b", label: "B", color: "#10b981", order: 2 },
          ],
          defaultOptionId: "opt_a",
        })}
        optionRows={[
          { rowId: "rm_1", rawValue: "opt_a" },
          { rowId: "rm_2", rawValue: "opt_b" },
        ]}
      />,
    );

    chooseAutocompleteOption("Default option", "B");
    fireEvent.change(screen.getByLabelText("Option label for A"), {
      target: { value: "Alpha" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith({
        fieldKey: "cf_notes",
        displayName: "Notes",
        description: "old description",
        options: [
          { id: "opt_a", label: "Alpha", color: "#3b82f6", order: 0 },
          { id: "opt_b", label: "B", color: "#10b981", order: 1 },
        ],
        defaultOptionId: "opt_b",
        colorCodeOptions: true,
      }),
    );
  });

  test("deleting the selected default option clears the draft default", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "single_select",
          custom_field_type: "single_select",
          options: [
            { id: "opt_a", label: "A", color: "#3b82f6", order: 1 },
            { id: "opt_b", label: "B", color: "#10b981", order: 2 },
          ],
          defaultOptionId: "opt_a",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldKey: "cf_notes",
          defaultOptionId: null,
          options: [{ id: "opt_b", label: "B", color: "#10b981", order: 0 }],
        }),
      ),
    );
  });

  test("formula fields mount the formula section and save source in the bundle", async () => {
    const dispatchBundle = vi.fn().mockResolvedValue(undefined);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        initialField={baseField({
          field_type: "computed",
          custom_field_type: "formula",
          formula_config: {
            source: "{People} * 2",
            ast: null,
            deps: ["num_people"],
          },
        })}
      />,
    );

    expect(screen.getByText("Preview based on row at modal open")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Expression"), { target: { value: "{People} * 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dispatchBundle).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldKey: "cf_notes",
          formulaSource: "{People} * 3",
        }),
      ),
    );
  });

  test("R-S4 — formula preview keeps the modal-open snapshot and marks stale after row mutation", () => {
    render(
      <Harness
        initialField={baseField({
          field_type: "computed",
          custom_field_type: "formula",
          formula_config: {
            source: "{People} * 2",
            ast: null,
            deps: ["num_people"],
          },
        })}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("rows-mutate"));
    expect(screen.getByText("Preview based on row at modal open — stale")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("20")).toBeNull();
  });

  test("Server preflight envelope re-renders the sub-panel against the server row list", async () => {
    const error = Object.assign(new Error("preflight"), {
      details: {
        incompatible_rows: [{ rowId: "rm_x", rawValue: "from-server", reason: "type_mismatch" }],
        total_row_count: 4,
      },
    });
    const dispatchBundle = vi.fn().mockRejectedValueOnce(error);
    render(
      <Harness
        dispatchBundle={dispatchBundle}
        sourceCustomFieldType="short_text"
        preflightRows={[{ rowId: "rm_1", rawValue: "42" }]}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Number" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        screen.getByText(/3 of 4 rows will keep their value; 1 will be cleared\./),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("rm_x")).toBeInTheDocument();
    // Ack appears for the server payload; Save remains gated.
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
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
