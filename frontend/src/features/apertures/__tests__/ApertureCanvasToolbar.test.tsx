import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApertureCanvasToolbar } from "../components/ApertureCanvasToolbar";
import type { AperturePickPasteMode } from "../store/builder-store";

function toolbarElement({
  pickPasteMode,
  canFlipLeftRight = true,
  onFlipLeftRight = vi.fn(),
  selectionCount = 0,
  elementKindTarget = null,
  onToggleElementKind = vi.fn(),
}: {
  pickPasteMode: AperturePickPasteMode;
  canFlipLeftRight?: boolean;
  onFlipLeftRight?: () => void;
  selectionCount?: number;
  elementKindTarget?: "glazed" | "void" | null;
  onToggleElementKind?: () => void;
}) {
  return (
    <ApertureCanvasToolbar
      zoom={1}
      viewDirection="exterior"
      selectionCount={selectionCount}
      canEdit
      canMerge={false}
      canSplit={false}
      canFlipLeftRight={canFlipLeftRight}
      elementKindTarget={elementKindTarget}
      pickPasteMode={pickPasteMode}
      canUndoPaste={false}
      onZoomIn={vi.fn()}
      onZoomOut={vi.fn()}
      onFit={vi.fn()}
      onToggleViewDirection={vi.fn()}
      onClearSelection={vi.fn()}
      onMerge={vi.fn()}
      onSplit={vi.fn()}
      onFlipLeftRight={onFlipLeftRight}
      onToggleElementKind={onToggleElementKind}
      onEyedropper={vi.fn()}
      onPaintBucket={vi.fn()}
      onUndoPaste={vi.fn()}
    />
  );
}

function renderToolbar(options: Parameters<typeof toolbarElement>[0]) {
  return render(toolbarElement(options));
}

describe("ApertureCanvasToolbar", () => {
  it("highlights the eyedropper while choosing a source", () => {
    renderToolbar({ pickPasteMode: "picking", canFlipLeftRight: false });

    expect(screen.getByTestId("aperture-canvas-eyedropper")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("aperture-canvas-paint-bucket")).toBeDisabled();
  });

  it("highlights and enables paint bucket when paste is armed", () => {
    renderToolbar({ pickPasteMode: "pasting", canFlipLeftRight: false });

    expect(screen.getByTestId("aperture-canvas-eyedropper")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByTestId("aperture-canvas-paint-bucket")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("aperture-canvas-paint-bucket")).not.toBeDisabled();
  });

  it("runs flip left/right only when enabled", () => {
    const onFlipLeftRight = vi.fn();
    const { rerender } = renderToolbar({ pickPasteMode: "idle", onFlipLeftRight });

    fireEvent.click(screen.getByTestId("aperture-canvas-flip-left-right"));
    expect(onFlipLeftRight).toHaveBeenCalledTimes(1);

    rerender(
      toolbarElement({ pickPasteMode: "picking", canFlipLeftRight: false, onFlipLeftRight }),
    );
    expect(screen.getByTestId("aperture-canvas-flip-left-right")).toBeDisabled();
  });

  it("runs one batch Empty toggle for the current selection", () => {
    const onToggleElementKind = vi.fn();
    renderToolbar({
      pickPasteMode: "idle",
      selectionCount: 3,
      elementKindTarget: "void",
      onToggleElementKind,
    });

    const toggle = screen.getByTestId("aperture-canvas-toggle-empty");
    expect(toggle).toHaveAccessibleName("Mark selected elements Empty");
    fireEvent.click(toggle);
    expect(onToggleElementKind).toHaveBeenCalledTimes(1);
  });

  it("offers Glazed when all selected elements are Empty", () => {
    renderToolbar({
      pickPasteMode: "idle",
      selectionCount: 2,
      elementKindTarget: "glazed",
    });

    expect(screen.getByTestId("aperture-canvas-toggle-empty")).toHaveAccessibleName(
      "Mark selected elements Glazed",
    );
  });
});
