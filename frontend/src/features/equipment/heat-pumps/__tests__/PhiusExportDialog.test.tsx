import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhiusExportDialog } from "../components/PhiusExportDialog";
import * as api from "../api";
import type { PhiusExportResponse } from "../types";
import { buildPhiusExportFilename } from "../lib/phius-export";

const CSV_FIXTURE = "Device(s),Qty\r\nPUZ-A18NKA7,2\r\n";

function payload(overrides: Partial<PhiusExportResponse> = {}): PhiusExportResponse {
  return {
    rows: [
      {
        row_id: "hpoe_01",
        device: "PUZ-A18NKA7",
        qty: 2,
        cap_17f: 18,
        cap_47f: 22,
        heating_data_type: "COPs",
        cop_17f: 2.4,
        cop_47f: 3.8,
        hspf: null,
        cap_95f: 17,
        cooling_data_type: "EER2/SEER2",
        eer: 12,
        seer: 21,
        ieer: null,
      },
    ],
    warnings: [],
    csv: CSV_FIXTURE,
    ...overrides,
  };
}

describe("PhiusExportDialog", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let mockedClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    URL.createObjectURL = vi.fn().mockReturnValue("blob:test");
    URL.revokeObjectURL = vi.fn();
    mockedClick = vi.fn();
    HTMLAnchorElement.prototype.click = mockedClick;
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
  });

  test("renders row count and offers download when no warnings", async () => {
    vi.spyOn(api, "requestPhiusExport").mockResolvedValueOnce(payload());

    render(<PhiusExportDialog projectId="p-1" btNumber="2426" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/1 outdoor equip row/)).toBeInTheDocument());
    expect(screen.getByText(/All required fields populated/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeInTheDocument();
  });

  test("groups warnings under their tag and labels the action as Continue with gaps", async () => {
    vi.spyOn(api, "requestPhiusExport").mockResolvedValueOnce(
      payload({
        warnings: [
          {
            row_id: "hpoe_01",
            tag: "OE-A",
            field: "heating",
            message: "No heating performance data set.",
          },
          {
            row_id: "hpoe_01",
            tag: "OE-A",
            field: "cooling",
            message: "No cooling performance data set.",
          },
        ],
      }),
    );

    render(<PhiusExportDialog projectId="p-1" btNumber="2426" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/1 with warning/)).toBeInTheDocument());
    expect(screen.getByText("OE-A")).toBeInTheDocument();
    expect(screen.getByText("No heating performance data set.")).toBeInTheDocument();
    expect(screen.getByText("No cooling performance data set.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with gaps" })).toBeInTheDocument();
  });

  test("Continue downloads the embedded CSV and closes", async () => {
    vi.spyOn(api, "requestPhiusExport").mockResolvedValueOnce(payload());
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PhiusExportDialog projectId="p-1" btNumber="2426" onClose={onClose} />);

    await waitFor(() => screen.getByRole("button", { name: "Download CSV" }));
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockedClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Cancel does not trigger a download", async () => {
    vi.spyOn(api, "requestPhiusExport").mockResolvedValueOnce(payload());
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<PhiusExportDialog projectId="p-1" btNumber="2426" onClose={onClose} />);

    await waitFor(() => screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("surface fetch error and degrade Cancel into Close", async () => {
    vi.spyOn(api, "requestPhiusExport").mockRejectedValueOnce(new Error("server down"));

    render(<PhiusExportDialog projectId="p-1" btNumber="2426" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("server down"));
    // Header "Close" is off by default (modal contract); the only dismiss in
    // the error state is the footer Cancel, which degrades to "Close" here.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Download CSV" })).not.toBeInTheDocument();
  });
});

describe("buildPhiusExportFilename", () => {
  test("formats date as YYYY-MM-DD and slots in bt_number", () => {
    const filename = buildPhiusExportFilename("2426", new Date(2026, 5, 9)); // June 9, local
    expect(filename).toBe("phius-hp-estimator-2426-2026-06-09.csv");
  });

  test("zero-pads single-digit months and days", () => {
    const filename = buildPhiusExportFilename("100", new Date(2026, 0, 3));
    expect(filename).toBe("phius-hp-estimator-100-2026-01-03.csv");
  });

  test("falls back to 'project' when bt_number is blank", () => {
    const filename = buildPhiusExportFilename("   ", new Date(2026, 5, 9));
    expect(filename).toBe("phius-hp-estimator-project-2026-06-09.csv");
  });
});
