import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  FormulaEditorPopover,
  type FormulaEditorFocusedRow,
  type FormulaEditorPopoverProps,
} from "../components/FormulaEditorPopover";
import {
  parse,
  rebuildSourceFromStoredAst,
  resolveRefs,
  type FieldRegistryEntry,
} from "../lib/formula";

const REGISTRY: ReadonlyArray<FieldRegistryEntry> = [
  { field_id: "name", display_name: "Name", origin: "core", field_type: "text" },
  { field_id: "number", display_name: "Number", origin: "core", field_type: "text" },
  { field_id: "num_bedrooms", display_name: "Num Bedrooms", origin: "core", field_type: "number" },
  { field_id: "cf_self", display_name: "Label", origin: "custom", field_type: "formula" },
];

const FOCUSED_ROW: FormulaEditorFocusedRow = {
  id: "rm_1",
  values: { name: "Master Bedroom", number: "101", num_bedrooms: 2 },
};

type HarnessOverrides = Partial<FormulaEditorPopoverProps>;

function Harness(overrides: HarnessOverrides = {}) {
  const [open, setOpen] = useState(true);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <button ref={anchorRef} type="button" onClick={() => setOpen(true)}>
        anchor
      </button>
      <FormulaEditorPopover
        open={open}
        onOpenChange={(next) => setOpen(next)}
        anchorElement={anchorRef.current}
        fieldDef={{ id: "cf_self", display_name: "Label" }}
        fieldRegistry={REGISTRY}
        focusedRow={FOCUSED_ROW}
        initialSource=""
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        {...overrides}
      />
    </>
  );
}

function dialog(): HTMLElement {
  return screen.getByRole("dialog", { name: /Edit formula for Label/ });
}

function sourceInput(): HTMLInputElement | HTMLTextAreaElement {
  return within(dialog()).getByLabelText("Expression") as HTMLInputElement | HTMLTextAreaElement;
}

function setSource(value: string) {
  fireEvent.change(sourceInput(), { target: { value } });
}

function submitButton(): HTMLButtonElement {
  return within(dialog()).getByRole("button", { name: /Save formula/ }) as HTMLButtonElement;
}

describe("FormulaEditorPopover", () => {
  test("renders the focused-row hint when no row is focused", () => {
    render(<Harness focusedRow={null} initialSource={'concat({Name}, "!")'} />);
    expect(within(dialog()).getByText("Focus a row to preview.")).toBeInTheDocument();
  });

  test("evaluates the local preview against the focused row", () => {
    render(<Harness initialSource={'concat({Name}, "!")'} />);
    expect(within(dialog()).getByText("Master Bedroom!")).toBeInTheDocument();
  });

  test("disables Submit while the local parser reports a parse error", () => {
    render(<Harness initialSource={"concat({Name},"} />);
    expect(submitButton().disabled).toBe(true);
    expect(within(dialog()).getByRole("status").textContent).toMatch(/Couldn't parse/);
  });

  test("disables Submit when the formula references the field being edited", () => {
    render(<Harness initialSource={'concat({Label}, "!")'} />);
    expect(submitButton().disabled).toBe(true);
    expect(within(dialog()).getByRole("status").textContent).toMatch(/cycle/i);
  });

  test("disables Submit when a referenced field doesn't exist in the registry", () => {
    render(<Harness initialSource={'concat({Ghost}, "!")'} />);
    expect(submitButton().disabled).toBe(true);
    expect(within(dialog()).getByRole("status").textContent).toMatch(/doesn't exist/);
  });

  test("inserts a palette chip's display name at the cursor position", () => {
    render(<Harness initialSource={""} />);
    const input = sourceInput() as HTMLInputElement;
    input.focus();
    input.setSelectionRange(0, 0);
    const chip = within(dialog()).getByRole("button", { name: /Text column Name/ });
    fireEvent.click(chip);
    expect(input.value).toBe("{Name}");
  });

  test("excludes the field being edited from the palette", () => {
    render(<Harness initialSource={""} />);
    expect(within(dialog()).queryByRole("button", { name: /Formula column Label/ })).toBeNull();
    expect(within(dialog()).getByRole("button", { name: /Text column Name/ })).toBeInTheDocument();
  });

  test("dispatches onSubmit with the typed source on happy path", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSubmit={onSubmit} initialSource={""} />);
    setSource('concat({Number}, " — ", upper({Name}))');
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      source: 'concat({Number}, " — ", upper({Name}))',
    });
  });

  test("surfaces a server-side error message and stays open on rejection", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("nope"));
    render(<Harness onSubmit={onSubmit} initialSource={"upper({Name})"} />);
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(within(dialog()).getByRole("alert").textContent).toContain("nope");
    expect(dialog()).toBeInTheDocument();
  });
});

describe("rebuildSourceFromStoredAst (display-name re-render on open)", () => {
  test("substitutes the current display_name for renamed field refs", () => {
    // Save-time AST refers to {Name} resolved to field_id "name".
    const storedAst = resolveRefs(parse('concat({Name}, "!")'), REGISTRY);
    // Now suppose "Name" was renamed to "Title" since save.
    const renamed: ReadonlyArray<FieldRegistryEntry> = REGISTRY.map((entry) =>
      entry.field_id === "name" ? { ...entry, display_name: "Title" } : entry,
    );
    const rebuilt = rebuildSourceFromStoredAst(storedAst, renamed);
    expect(rebuilt).toContain("{Title}");
    expect(rebuilt).not.toContain("{Name}");
    // The rebuilt source round-trips through parse + resolve.
    expect(() => resolveRefs(parse(rebuilt), renamed)).not.toThrow();
  });

  test("emits the stored display_name when a referenced field has been deleted", () => {
    const storedAst = resolveRefs(parse("upper({Name})"), REGISTRY);
    const withoutName = REGISTRY.filter((entry) => entry.field_id !== "name");
    const rebuilt = rebuildSourceFromStoredAst(storedAst, withoutName);
    // The stored display_name survives so the editor shows the user what
    // was there at save time, even though resolving it now fails.
    expect(rebuilt).toContain("{Name}");
  });
});

describe("FormulaEditorPopover display-name re-render on open", () => {
  test("seeds the input with the rebuilt source from a renamed registry", () => {
    const storedAst = resolveRefs(parse("upper({Name})"), REGISTRY);
    const renamed: ReadonlyArray<FieldRegistryEntry> = REGISTRY.map((entry) =>
      entry.field_id === "name" ? { ...entry, display_name: "Title" } : entry,
    );
    const initialSource = rebuildSourceFromStoredAst(storedAst, renamed);
    render(<Harness fieldRegistry={renamed} initialSource={initialSource} />);
    expect(sourceInput().value).toContain("{Title}");
  });
});
