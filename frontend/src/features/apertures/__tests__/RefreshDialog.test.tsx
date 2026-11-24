import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RefreshDialog } from "../components/RefreshDialog";
import type { ApertureDriftEntry } from "../drift-types";

function entry(): ApertureDriftEntry {
  return {
    aperture_type_id: "apt_A",
    aperture_type_name: "Type A",
    element_id: "aptel_A1",
    element_name: "One",
    target: "frame.top",
    kind: "field_delta",
    catalog_record_id: "recCAT00000001",
    deltas: [
      {
        field_key: "u_value_w_m2k",
        catalog_value: 1.2,
        yours_value: 1.0,
        in_local_overrides: false,
      },
      {
        field_key: "color",
        catalog_value: "#aabbcc",
        yours_value: "#000000",
        in_local_overrides: true,
      },
    ],
  };
}

describe("RefreshDialog", () => {
  it("renders one compare card per delta with human-readable labels", () => {
    render(<RefreshDialog open entry={entry()} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/U-value/i)).toBeTruthy();
    expect(screen.getByText(/Color/i)).toBeTruthy();
  });

  it("locally-overridden fields default to Keep mine and carry the Local override tag", () => {
    render(<RefreshDialog open entry={entry()} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText("Local override")).toBeTruthy();
    // 1 of 2 fields defaults to Take catalog (the non-overridden one).
    expect(screen.getByRole("button", { name: "Apply 1 change" })).toBeTruthy();
  });

  it("Apply dispatches a chosen_values map keyed by field_key", () => {
    const onSave = vi.fn();
    render(<RefreshDialog open entry={entry()} onClose={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply 1 change" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const chosen = onSave.mock.calls[0]?.[0] as Record<string, unknown>;
    // The non-overridden delta defaults to take-catalog.
    expect(chosen.u_value_w_m2k).toBe(1.2);
    // The locally-overridden field defaults to keep-mine.
    expect(chosen.color).toBe("#000000");
  });

  it("Take all from catalog bulk action updates the submit count and overwrites the choice", () => {
    const onSave = vi.fn();
    render(<RefreshDialog open entry={entry()} onClose={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /Take all from catalog/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply 2 changes" }));
    const chosen = onSave.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(chosen.color).toBe("#aabbcc");
  });

  it("catalog_row_missing entry shows explanation and disables the primary action", () => {
    const e = { ...entry(), kind: "catalog_row_missing" as const, deltas: [] };
    render(<RefreshDialog open entry={e} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole("alert").textContent).toMatch(/Repick/i);
    const submit = screen.getByRole("button", { name: "Apply refresh" });
    expect(submit).toBeDisabled();
  });
});
