import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useCallback, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  FieldConfigSectionOptions,
  type OptionSourceRow,
} from "../components/FieldConfigSectionOptions";
import type { FieldOption } from "../types";
import { chooseAutocompleteOption } from "./helpers/autocomplete";

// Module-level stable empties mirror the EMPTY_FIELD_OPTIONS /
// EMPTY_OPTION_SOURCE_ROWS constants in FieldConfigModal. Inline `[]`
// at the call site forces a fresh identity each render, which would
// retrigger the reset effect in FieldConfigSectionOptions and loop
// through onDraftChange → parent setState → reset → … producing
// "Maximum update depth exceeded" after a text→single_select save.
const EMPTY_OPTIONS: readonly FieldOption[] = [];
const EMPTY_ROWS: readonly OptionSourceRow[] = [];
const FLOOR_OPTIONS: readonly FieldOption[] = [
  { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
  { id: "opt_basement", label: "Basement", color: "#22c55e", order: 1 },
];

describe("FieldConfigSectionOptions", () => {
  test("stable empty sourceOptions reference does not cause unbounded onDraftChange calls", () => {
    const onDraftChange = vi.fn();
    function Harness() {
      // Every onDraftChange triggers a parent re-render. With stable
      // sourceOptions/rows AND a stable callback (mirroring how the
      // modal passes setOptionsDraft directly), the reset effect must
      // not refire and the draft-change effect should fire once.
      const [, setTick] = useState(0);
      const handle = useCallback((draft: Parameters<typeof onDraftChange>[0]) => {
        onDraftChange(draft);
        setTick((n) => n + 1);
      }, []);
      return (
        <FieldConfigSectionOptions
          fieldDisplayName="Status"
          sourceOptions={EMPTY_OPTIONS}
          sourceColorCodeOptions
          sourceDefaultOptionId={null}
          rows={EMPTY_ROWS}
          required={false}
          disabled={false}
          onDraftChange={handle}
        />
      );
    }
    expect(() => render(<Harness />)).not.toThrow();
    expect(onDraftChange.mock.calls.length).toBeLessThan(5);
  });

  test("in-use nullable option delete clears without a replacement map", async () => {
    const onDraftChange = vi.fn();
    render(
      <FieldConfigSectionOptions
        fieldDisplayName="Floor"
        sourceOptions={FLOOR_OPTIONS}
        sourceColorCodeOptions
        sourceDefaultOptionId={null}
        rows={[{ rowId: "rm_1", rawValue: "opt_ground" }]}
        required={false}
        disabled={false}
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete option Ground" }));
    expect(screen.getByText(/1 row currently reference this option/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const draft = onDraftChange.mock.calls.at(-1)?.[0];
      expect(draft.options.map((option: FieldOption) => option.id)).toEqual(["opt_basement"]);
      expect(draft.optionReplacements).toEqual({});
    });
  });

  test("in-use option delete can rewrite rows to a replacement option", async () => {
    const onDraftChange = vi.fn();
    render(
      <FieldConfigSectionOptions
        fieldDisplayName="Floor"
        sourceOptions={FLOOR_OPTIONS}
        sourceColorCodeOptions
        sourceDefaultOptionId={null}
        rows={[{ rowId: "rm_1", rawValue: "opt_ground" }]}
        required={false}
        disabled={false}
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete option Ground" }));
    chooseAutocompleteOption("Replacement option", "Basement");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const draft = onDraftChange.mock.calls.at(-1)?.[0];
      expect(draft.options.map((option: FieldOption) => option.id)).toEqual(["opt_basement"]);
      expect(draft.optionReplacements).toEqual({ opt_ground: "opt_basement" });
    });
  });

  test("adding a blank option does not surface an error and drops it from the saved set", async () => {
    const onDraftChange = vi.fn();
    render(
      <FieldConfigSectionOptions
        fieldDisplayName="Floor"
        sourceOptions={FLOOR_OPTIONS}
        sourceColorCodeOptions
        sourceDefaultOptionId={null}
        rows={EMPTY_ROWS}
        required={false}
        disabled={false}
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add option/ }));

    // No premature "needs a label" yelling before the user types anything.
    expect(screen.queryByText(/needs a label/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/empty label/i)).not.toBeInTheDocument();

    await waitFor(() => {
      const draft = onDraftChange.mock.calls.at(-1)?.[0];
      expect(draft.valid).toBe(true);
      // The blank row is displayed for editing but excluded from the saved set.
      expect(draft.options.map((option: FieldOption) => option.id)).toEqual([
        "opt_ground",
        "opt_basement",
      ]);
    });
  });

  test("blanking an in-use option surfaces the referenced-blank error and blocks save", async () => {
    const onDraftChange = vi.fn();
    render(
      <FieldConfigSectionOptions
        fieldDisplayName="Floor"
        sourceOptions={FLOOR_OPTIONS}
        sourceColorCodeOptions
        sourceDefaultOptionId={null}
        rows={[{ rowId: "rm_1", rawValue: "opt_ground" }]}
        required={false}
        disabled={false}
        onDraftChange={onDraftChange}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Option label for Ground" }), {
      target: { value: "" },
    });

    expect(screen.getByText(/can’t have an empty label/)).toBeInTheDocument();
    await waitFor(() => {
      expect(onDraftChange.mock.calls.at(-1)?.[0].valid).toBe(false);
    });
  });

  test("required in-use option delete without a replacement candidate is blocked", () => {
    render(
      <FieldConfigSectionOptions
        fieldDisplayName="Floor"
        sourceOptions={[FLOOR_OPTIONS[0] as FieldOption]}
        sourceColorCodeOptions
        sourceDefaultOptionId={null}
        rows={[{ rowId: "rm_1", rawValue: "opt_ground" }]}
        required
        disabled={false}
        onDraftChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete option Ground" }));

    expect(screen.getByText(/Floor is required/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Replacement option" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
