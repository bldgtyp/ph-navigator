import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { createQueryClient } from "../../../app/query-client";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import { emptyViewState } from "../../../shared/ui/data-table";
import { AppliancesTable } from "../components/AppliancesTable";
import { buildAppliance, buildAppliancesSlice, schemaForAppliances } from "../testing/testFixtures";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/assets/bulk-urls")) {
      return jsonResponse({
        items: [
          {
            asset_id: "asset_pdf_1",
            preview_url: "https://fake-r2.test/file-preview.pdf",
            preview_expires_at: "2026-05-26T13:15:00Z",
            download_url: "https://fake-r2.test/file.pdf",
            download_expires_at: "2026-05-26T14:00:00Z",
            thumbnail_url: null,
            thumbnail_status: "pending",
            thumbnail_expires_at: null,
            content_type: "application/pdf",
            original_filename: "appliance-datasheet.pdf",
            display_name: "Appliance datasheet",
            size_bytes: 512,
          },
        ],
      });
    }
    return jsonResponse({ items: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function UnitStub({ unitSystem, children }: { unitSystem: UnitSystem; children: ReactNode }) {
  return (
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "default",
        error: null,
        setUnitSystem: () => {},
        toggleUnitSystem: () => {},
      }}
    >
      {children}
    </UnitPreferenceContext.Provider>
  );
}

function renderWithQueryClient(ui: ReactElement, unitSystem: UnitSystem = "SI") {
  const queryClient = createQueryClient();
  return render(
    <UnitStub unitSystem={unitSystem}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </UnitStub>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AppliancesTable DataTable reuse", () => {
  test("renders AirTable-matched appliance columns, units, and single-select labels", () => {
    const slice = buildAppliancesSlice({ appliances: [buildAppliance()] });
    renderWithQueryClient(
      <AppliancesTable
        appliancesSlice={slice}
        tableSchema={schemaForAppliances(slice)}
        isEditor={false}
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
      />,
    );

    for (const label of [
      "Tag",
      "Type",
      "Display Name",
      "Quantity",
      "Model",
      "Manufacturer",
      "EnergyStar",
      "Capacity",
      "CEF",
      "IMEF",
      "MEF",
      "Annual Energy",
      "URL",
      "Datasheet",
      "Notes",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: new RegExp(`^${label}(?:\\b|\\s)`) }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("m3")).toBeInTheDocument();
    const annualEnergyHeader = screen.getByRole("columnheader", {
      name: /Annual Energy.*kWh/,
    });
    expect(annualEnergyHeader).toBeInTheDocument();
    expect(within(annualEnergyHeader).getByText("Annual Energy")).toBeInTheDocument();
    expect(within(annualEnergyHeader).getByTestId("data-table-header-units")).toHaveTextContent(
      "kWh",
    );
    expect(annualEnergyHeader.querySelector('[data-field-type-icon="unit"]')).not.toBeNull();
    expect(screen.getByText("A-1")).toBeInTheDocument();
    expect(screen.getByText("4-fridge")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  test("renders Annual Energy as kBtu and writes canonical kWh in IP mode", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    const slice = buildLegacyPlainNumberAnnualEnergySlice({
      appliances: [buildAppliance({ id: "appl_1" })],
    });

    renderWithQueryClient(
      <AppliancesTable
        appliancesSlice={slice}
        tableSchema={schemaForAppliances(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
      "IP",
    );

    expect(screen.getByText("ft3")).toBeInTheDocument();
    const annualEnergyHeader = screen.getByRole("columnheader", {
      name: /Annual Energy.*kBtu/,
    });
    expect(annualEnergyHeader).toBeInTheDocument();
    expect(within(annualEnergyHeader).getByText("Annual Energy")).toBeInTheDocument();
    expect(within(annualEnergyHeader).getByTestId("data-table-header-units")).toHaveTextContent(
      "kBtu",
    );
    expect(annualEnergyHeader.querySelector('[data-field-type-icon="unit"]')).not.toBeNull();
    expect(document.querySelector('[data-field-key="annual_energy_kwh"]')).toHaveTextContent(
      "1433",
    );

    const annualEnergyCell = document.querySelector('[data-field-key="annual_energy_kwh"]');
    expect(annualEnergyCell).not.toBeNull();
    await user.dblClick(annualEnergyCell as HTMLElement);
    const input = within(annualEnergyCell as HTMLElement).getByRole("textbox");
    await user.clear(input);
    await user.type(input, "1296.6");
    await user.keyboard("{Enter}");

    const write = onWrite.mock.calls[0]?.[0];
    expect(write?.kind).toBe("cell");
    expect(write?.writes[0]).toMatchObject({
      rowId: "appl_1",
      fieldKey: "annual_energy_kwh",
    });
    expect(write?.writes[0]?.value).toBeCloseTo(380, 1);
  });

  test("commits inline edits through DataTable writes", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    const slice = buildAppliancesSlice({
      appliances: [buildAppliance({ id: "appl_1" })],
    });

    renderWithQueryClient(
      <AppliancesTable
        appliancesSlice={slice}
        tableSchema={schemaForAppliances(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const annualEnergyCell = document.querySelector('[data-field-key="annual_energy_kwh"]');
    expect(annualEnergyCell).not.toBeNull();
    await user.dblClick(annualEnergyCell as HTMLElement);
    const input = within(annualEnergyCell as HTMLElement).getByRole("textbox");
    await user.clear(input);
    await user.type(input, "380");
    await user.keyboard("{Enter}");

    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "appl_1", fieldKey: "annual_energy_kwh", value: 380 }],
    });
  });

  test("emits a cell write when deleting a datasheet attachment", async () => {
    const slice = buildAppliancesSlice({
      appliances: [buildAppliance({ datasheet_asset_ids: ["asset_pdf_1"] })],
    });
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderWithQueryClient(
      <AppliancesTable
        appliancesSlice={slice}
        tableSchema={schemaForAppliances(slice)}
        isEditor
        projectId="proj_1"
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    const attachment = await screen.findByTitle("appliance-datasheet.pdf · application/pdf");
    const attachmentCell = attachment.closest(".attachment-cell");
    expect(attachmentCell).not.toBeNull();
    fireEvent.keyDown(attachmentCell as HTMLElement, { key: "Delete" });

    await waitFor(() => {
      expect(onWrite).toHaveBeenCalledWith({
        kind: "cell",
        writes: [{ rowId: "appl_1", fieldKey: "datasheet_asset_ids", value: [] }],
      });
    });
  });
});

function buildLegacyPlainNumberAnnualEnergySlice(
  overrides: Parameters<typeof buildAppliancesSlice>[0] = {},
) {
  const slice = buildAppliancesSlice(overrides);
  return {
    ...slice,
    field_defs: slice.field_defs.map((fieldDef) =>
      fieldDef.field_key === "annual_energy_kwh" ? { ...fieldDef, config: {} } : fieldDef,
    ),
  };
}
