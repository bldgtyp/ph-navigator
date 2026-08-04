import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApertureCanvasContainer } from "../components/ApertureCanvasContainer";
import { useApertureDimFormat } from "../hooks/useApertureDimFormat";
import { useApertureBuilderStore } from "../store/builder-store";
import type { ApertureElementKind, ApertureTypeEntry } from "../types";
import {
  apertureElement as element,
  apertureEntry,
  apertureFrame as frame,
  apertureGlazing as glazing,
  ApertureUnitStub as UnitStub,
} from "./aperture-ui-test-fixtures";

function aperture(elements: ApertureTypeEntry["elements"]): ApertureTypeEntry {
  return apertureEntry({
    column_widths_mm: elements.map(() => 1000),
    elements,
  });
}

function Harness({
  entry,
  onSetElementKind,
  commandBusy = false,
  commandError = null,
}: {
  entry: ApertureTypeEntry;
  onSetElementKind: (elementIds: string[], kind: ApertureElementKind) => Promise<boolean> | boolean;
  commandBusy?: boolean;
  commandError?: string | null;
}) {
  const dimFormat = useApertureDimFormat();
  return (
    <ApertureCanvasContainer
      aperture={entry}
      dimFormat={dimFormat}
      canEdit
      commandBusy={commandBusy}
      commandError={commandError}
      onSetElementName={vi.fn()}
      onSetElementKind={onSetElementKind}
    />
  );
}

function renderHarness(
  entry: ApertureTypeEntry,
  onSetElementKind = vi.fn().mockResolvedValue(true),
  commandBusy = false,
  commandError: string | null = null,
) {
  render(
    <UnitStub>
      <Harness
        entry={entry}
        onSetElementKind={onSetElementKind}
        commandBusy={commandBusy}
        commandError={commandError}
      />
    </UnitStub>,
  );
  return onSetElementKind;
}

beforeEach(() => {
  useApertureBuilderStore.setState({
    selectionByAperture: {},
    pickPasteMode: "idle",
    pickedAssignment: null,
    undoStacksByAperture: {},
  });
});

describe("Aperture element kind controls", () => {
  it("renders an Empty card without aperture assignments or a U-value chip", () => {
    renderHarness(aperture([element({ kind: "void", name: "Wall area" })]));

    const card = screen.getByTestId("element-card-aptel_1");
    expect(within(card).getByText(/Empty — not part of the aperture/)).toBeInTheDocument();
    expect(within(card).queryByRole("table")).not.toBeInTheDocument();
    expect(within(card).queryByText("U-w:")).not.toBeInTheDocument();
    expect(within(card).getByRole("switch", { name: "Mark element Glazed" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("confirms and describes assignment loss before making a populated card Empty", async () => {
    const onSetElementKind = renderHarness(
      aperture([
        element({
          name: "Operable",
          frames: { top: frame(), right: null, bottom: null, left: null },
          installs: { top: null, right: null, bottom: null, left: null },
          glazing: glazing(),
          operation: { type: "swing", directions: ["left"] },
        }),
      ]),
    );

    fireEvent.click(screen.getByRole("switch", { name: "Mark element Empty" }));
    const dialog = screen.getByRole("dialog", { name: "Make element Empty?" });
    expect(dialog).toHaveTextContent("glazing, operation, and top frame");
    expect(dialog).toHaveTextContent("jamb, sill, or head conditions—not mullions");
    expect(onSetElementKind).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Make Empty" }));

    await waitFor(() => expect(onSetElementKind).toHaveBeenCalledWith(["aptel_1"], "void"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Make element Empty?" })).not.toBeInTheDocument(),
    );
  });

  it("filters already-Empty elements from one multi-select batch command", () => {
    const onSetElementKind = renderHarness(
      aperture([
        element({ id: "empty", kind: "void", column_span: [0, 0] }),
        element({ id: "glazed-a", column_span: [1, 1] }),
        element({ id: "glazed-b", column_span: [2, 2] }),
      ]),
    );

    fireEvent.click(screen.getByTestId("hit-element-empty"));
    fireEvent.click(screen.getByTestId("hit-element-glazed-a"), { shiftKey: true });
    fireEvent.click(screen.getByTestId("hit-element-glazed-b"), { shiftKey: true });
    fireEvent.click(screen.getByTestId("aperture-canvas-toggle-empty"));

    expect(onSetElementKind).toHaveBeenCalledTimes(1);
    expect(onSetElementKind).toHaveBeenCalledWith(["glazed-a", "glazed-b"], "void");
  });

  it("retains paste undo state when the route reports a failed kind command", async () => {
    const onSetElementKind = vi.fn().mockResolvedValue(false);
    useApertureBuilderStore.getState().pushUndoEntry("apt_1", {
      target_element_id: "aptel_1",
      prior: {
        operation: null,
        glazing_id: null,
        frames: { top: null, right: null, bottom: null, left: null },
        installs: { top: null, right: null, bottom: null, left: null },
      },
    });
    renderHarness(aperture([element()]), onSetElementKind);

    fireEvent.click(screen.getByRole("switch", { name: "Mark element Empty" }));
    await waitFor(() => expect(onSetElementKind).toHaveBeenCalled());

    expect(useApertureBuilderStore.getState().undoStacksByAperture["apt_1"]).toHaveLength(1);
  });

  it("disables card and toolbar kind controls while a command is pending", () => {
    useApertureBuilderStore.getState().selectSingle("apt_1", "aptel_1");
    renderHarness(aperture([element()]), vi.fn().mockResolvedValue(true), true);

    expect(screen.getByRole("switch", { name: "Mark element Empty" })).toBeDisabled();
    expect(screen.getByTestId("aperture-canvas-toggle-empty")).toBeDisabled();
  });

  it("surfaces a failed kind command inside the retained confirmation dialog", () => {
    renderHarness(
      aperture([element({ glazing: glazing() })]),
      vi.fn().mockResolvedValue(false),
      false,
      "The draft changed on the server.",
    );
    fireEvent.click(screen.getByRole("switch", { name: "Mark element Empty" }));

    expect(screen.getByRole("alert")).toHaveTextContent("The draft changed on the server.");
  });
});
