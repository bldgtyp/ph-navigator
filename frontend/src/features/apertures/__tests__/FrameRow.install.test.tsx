// FrameRow effective Ψ-install cell render states (assigned / inherited
// default / mull) in SI and IP.
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import type { ResolvedInstallPsi } from "../install-psi";
import { FrameRow } from "../components/FrameRow";
import { ApertureUnitStub } from "./aperture-ui-test-fixtures";

function renderRow(install: ResolvedInstallPsi | null, unitSystem: UnitSystem = "SI") {
  return render(
    <ApertureUnitStub unitSystem={unitSystem}>
      <FrameRow
        side="top"
        viewDirection="interior"
        frame={null}
        operation={null}
        canEdit={false}
        install={install}
        onPick={() => {}}
      />
    </ApertureUnitStub>,
  );
}

describe("FrameRow Ψ-install cell", () => {
  test("assigned value renders unmuted with the type tooltip", () => {
    renderRow({
      psiWmk: 0.021,
      source: "assigned",
      installTypeId: "apit_flixo_sill",
      installTypeName: "Flixo Sill",
    });
    const cell = screen.getByTestId("install-psi-top");
    expect(cell).toHaveTextContent("0.021");
    expect(cell.className).not.toContain("aperture-card-row__metric--muted");
    expect(cell.title).toContain("Flixo Sill");
  });

  test("inherited default renders muted", () => {
    renderRow({
      psiWmk: 0.052,
      source: "default",
      installTypeId: "apit_default",
      installTypeName: "Default",
    });
    const cell = screen.getByTestId("install-psi-top");
    expect(cell).toHaveTextContent("0.052");
    expect(cell.className).toContain("aperture-card-row__metric--muted");
    expect(cell.title).toContain("inherited default");
  });

  test("mull edge renders muted 0 (mull)", () => {
    renderRow({ psiWmk: 0, source: "mull", installTypeId: null, installTypeName: null });
    const cell = screen.getByTestId("install-psi-top");
    expect(cell).toHaveTextContent("0 (mull)");
    expect(cell.className).toContain("aperture-card-row__metric--muted");
  });

  test("IP toggle converts the assigned value", () => {
    renderRow(
      {
        psiWmk: 0.052,
        source: "assigned",
        installTypeId: "apit_x",
        installTypeName: "X",
      },
      "IP",
    );
    // 0.052 W/(m-K) ≈ 0.03 Btu/(h-ft-F) (formatter trims trailing zeros)
    expect(screen.getByTestId("install-psi-top")).toHaveTextContent("0.03");
  });

  test("no resolution data renders the dash fallback", () => {
    renderRow(null);
    expect(screen.queryByTestId("install-psi-top")).toBeNull();
  });
});
