import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import { ApertureSidebar } from "../components/ApertureSidebar";
import { AperturesHeader } from "../components/AperturesHeader";
import type { ApertureTypeEntry } from "../types";

const initialApertures: ApertureTypeEntry[] = [
  { id: "apt_w1", name: "W1", row_heights_mm: [1000], column_widths_mm: [1000], elements: [] },
  { id: "apt_w2", name: "W2", row_heights_mm: [1000], column_widths_mm: [1000], elements: [] },
];

function Harness({ onRename }: { onRename?: (name: string) => void }) {
  const [apertures, setApertures] = useState(initialApertures);
  const activeAperture = apertures[0]!;
  const renameActive = (name: string) => {
    onRename?.(name);
    setApertures((current) =>
      current.map((aperture) =>
        aperture.id === activeAperture?.id ? { ...aperture, name } : aperture,
      ),
    );
  };
  return (
    <UnitPreferenceProvider>
      <AperturesHeader
        activeAperture={activeAperture}
        apertures={apertures}
        canEdit
        busy={false}
        loading={false}
        onRename={renameActive}
      />
      <ApertureSidebar
        apertures={apertures}
        activeApertureId={activeAperture.id}
        canEdit
        actionDisabled={false}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onSelect={() => undefined}
        onAdd={() => undefined}
        onRename={(_aperture, name) => renameActive(name)}
        onDuplicate={() => undefined}
        onDelete={() => undefined}
      />
    </UnitPreferenceProvider>
  );
}

function UnitPreferenceProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("SI");
  return (
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "default",
        error: null,
        setUnitSystem,
        toggleUnitSystem: () => setUnitSystem((current) => (current === "SI" ? "IP" : "SI")),
      }}
    >
      {children}
    </UnitPreferenceContext.Provider>
  );
}

describe("AperturesHeader", () => {
  test("inline rename updates the header label and sidebar label", async () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);

    expect(screen.getByRole("heading", { name: "W1" })).toBeInTheDocument();
    expect(screen.getByText("W1", { selector: ".aperture-sidebar__item-name" })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Edit aperture type name" }));
    const nameInput = screen.getByLabelText("Aperture type name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "W1-Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(onRename).toHaveBeenCalledWith("W1-Renamed");
    expect(screen.getByRole("heading", { name: "W1-Renamed" })).toBeInTheDocument();
    expect(
      screen.getByText("W1-Renamed", { selector: ".aperture-sidebar__item-name" }),
    ).toBeVisible();
  });

  test("inline rename blocks duplicate aperture type names", async () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit aperture type name" }));
    const nameInput = screen.getByLabelText("Aperture type name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, " W2 ");

    expect(screen.getByRole("button", { name: "Save name" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "An aperture type named 'W2' already exists in this version.",
    );
  });

  test("sidebar inline rename updates the header label and sidebar label", async () => {
    const onRename = vi.fn();
    render(<Harness onRename={onRename} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Rename aperture type" })[0]!);
    const nameInput = screen.getByLabelText("Aperture type name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "W1-Sidebar");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(onRename).toHaveBeenCalledWith("W1-Sidebar");
    expect(screen.getByRole("heading", { name: "W1-Sidebar" })).toBeInTheDocument();
    expect(
      screen.getByText("W1-Sidebar", { selector: ".aperture-sidebar__item-name" }),
    ).toBeVisible();
  });
});
