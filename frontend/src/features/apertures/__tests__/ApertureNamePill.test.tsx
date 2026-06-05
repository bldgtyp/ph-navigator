import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApertureNamePill } from "../components/ApertureNamePill";
import type { ApertureElement, FrameRef, GlazingRef } from "../types";

function frame(): FrameRef {
  return {
    name: "F",
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: 50,
    u_value_w_m2k: null,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function glazing(): GlazingRef {
  return {
    name: "G",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: null,
    g_value: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function element(name = "W1"): ApertureElement {
  return {
    id: "aptel_1",
    name,
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: frame(), right: frame(), bottom: frame(), left: frame() },
    glazing: glazing(),
    operation: null,
  };
}

const parentRect = { x: 0, y: 0, width: 1000, height: 1000 };
const glazingRect = { x: 50, y: 50, width: 900, height: 900 };

function renderPill(props: Partial<Parameters<typeof ApertureNamePill>[0]> = {}) {
  const onCommit = props.onCommit ?? vi.fn();
  return {
    onCommit,
    ...render(
      <ApertureNamePill
        element={props.element ?? element()}
        glazingRect={props.glazingRect ?? glazingRect}
        parentRect={props.parentRect ?? parentRect}
        zoom={props.zoom ?? 1}
        canEdit={props.canEdit ?? true}
        onCommit={onCommit}
      />,
    ),
  };
}

describe("ApertureNamePill", () => {
  it("renders the element name as label", () => {
    renderPill();
    expect(screen.getByTestId("pill-aptel_1")).toHaveTextContent("W1");
  });

  it("clicking the pill flips to an editable input", () => {
    renderPill();
    fireEvent.mouseDown(screen.getByTestId("pill-aptel_1"));
    const input = screen.getByTestId("pill-aptel_1") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.value).toBe("W1");
  });

  it("Enter with a new name commits the trimmed value", () => {
    const { onCommit } = renderPill();
    fireEvent.mouseDown(screen.getByTestId("pill-aptel_1"));
    const input = screen.getByTestId("pill-aptel_1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  W1-new  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("aptel_1", "W1-new");
  });

  it("Escape reverts to the prior name", () => {
    const { onCommit } = renderPill();
    fireEvent.mouseDown(screen.getByTestId("pill-aptel_1"));
    const input = screen.getByTestId("pill-aptel_1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abandoned" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("pill-aptel_1")).toHaveTextContent("W1");
  });

  it("empty input reverts silently", () => {
    const { onCommit } = renderPill();
    fireEvent.mouseDown(screen.getByTestId("pill-aptel_1"));
    const input = screen.getByTestId("pill-aptel_1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("read-only when canEdit=false: click does nothing", () => {
    renderPill({ canEdit: false });
    fireEvent.mouseDown(screen.getByTestId("pill-aptel_1"));
    const pill = screen.getByTestId("pill-aptel_1");
    expect(pill.tagName).toBe("DIV");
    expect(pill.getAttribute("data-readonly")).toBe("true");
  });
});
