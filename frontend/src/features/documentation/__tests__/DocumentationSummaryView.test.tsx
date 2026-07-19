import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import { uploadAsset } from "../../assets/hooks";
import type { ProjectDetail } from "../../projects/types";
import { DocumentationPage } from "../routes/DocumentationPage";
import {
  PROJECT,
  assetUrlsFixture,
  pumpsSliceFixture,
  summaryFixture,
} from "./DocumentationSummaryView.fixtures";

vi.mock("../../assets/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../assets/hooks")>();
  return {
    ...actual,
    uploadAsset: vi.fn(async () => "asset_ds_upload"),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("DocumentationPage", () => {
  test("loads editor draft summary as an overview, filters missing photos, and opens the record modal", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/draft/documentation-summary")) {
        return Promise.resolve(jsonResponse(summaryFixture()));
      }
      if (url.startsWith("/api/v1/projects/proj_1/assets/bulk-urls")) {
        return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDocumentation(PROJECT, "/projects/proj_1/documentation");

    expect(await screen.findByRole("heading", { name: "Documentation status" })).toBeVisible();
    expect(
      screen.getByText("1 spec, 1 datasheet, and 1 photo still need attention."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Equipment" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("Ventilator ERV-01")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Equipment" }));
    expect(screen.getByRole("button", { name: "Equipment" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "Ventilators" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getAllByRole("progressbar", { name: "Spec 2/3" })[0]).toBeVisible();
    expect(screen.getAllByRole("progressbar", { name: "Photos 2/3" })[0]).toBeVisible();

    await user.click(screen.getByRole("button", { name: "How to photograph - Equipment" }));
    const directionsDialog = await screen.findByRole("dialog", {
      name: "How to photograph - Equipment",
    });
    expect(within(directionsDialog).getByRole("heading", { name: "Ventilators" })).toBeVisible();
    expect(within(directionsDialog).getByRole("heading", { name: "Pumps" })).toBeVisible();
    expect(
      within(directionsDialog).getByText(
        "Readable nameplate with manufacturer, model number, serial number, airflow, and electrical data.",
      ),
    ).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "How to photograph - Equipment" })).toBeNull(),
    );

    expect(screen.getByRole("button", { name: "Needed specs" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Missing specs" })).not.toBeInTheDocument();
    const missingPhotosFilter = screen.getByRole("button", { name: "Missing photos" });
    expect(missingPhotosFilter).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Ventilators" }));
    expect(screen.getByText("Ventilator ERV-01")).toBeVisible();
    await user.click(missingPhotosFilter);
    expect(missingPhotosFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No records match the active filters.")).toBeVisible();
    expect(screen.queryByText("Ventilator ERV-01")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pumps" }));
    expect(screen.getByText("Pump P-01")).toBeVisible();

    const pumpRowToggle = screen.getByRole("button", { name: "Pump P-01" });
    expect(pumpRowToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(pumpRowToggle);
    expect(pumpRowToggle).toHaveAttribute("aria-expanded", "true");
    const pumpRow = pumpRowToggle.closest("article");
    expect(pumpRow).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/proj_1/versions/ver_1/draft/documentation-summary",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("viewer reads the saved document and exposes no upload affordances", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/document/documentation-summary")) {
          return Promise.resolve(jsonResponse({ ...summaryFixture(), source: "version" }));
        }
        if (url.includes("/assets/urls")) {
          return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
        }
        if (url.includes("/assets/bulk-urls")) {
          return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
        }
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
    renderDocumentation({ ...PROJECT, access_mode: "viewer" }, "/projects/proj_1/documentation");

    expect(await screen.findByRole("button", { name: "Equipment" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Equipment" }));
    await user.click(await screen.findByRole("button", { name: "Ventilators" }));
    const ventilatorToggle = await screen.findByRole("button", { name: "Ventilator ERV-01" });
    expect(ventilatorToggle).toBeVisible();
    await user.click(ventilatorToggle);
    expect(screen.queryByText(/saved version/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Drop files here" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add file" })).not.toBeInTheDocument();
    expect(
      within(ventilatorToggle.closest("article") as HTMLElement).queryByLabelText("Spec"),
    ).toBeNull();
    expect(
      within(ventilatorToggle.closest("article") as HTMLElement).queryByLabelText("Datasheet"),
    ).toBeNull();
    expect(
      within(ventilatorToggle.closest("article") as HTMLElement).queryByLabelText("Photos"),
    ).toBeNull();
  });

  test("editor axis status controls and datasheet attachments write through the draft table", async () => {
    const user = userEvent.setup();
    const summary = summaryFixture();
    const pump = summary.sections[0]?.groups
      .find((group) => group.key === "pumps")
      ?.records.find((record) => record.record_id === "pump_1");
    if (!pump) throw new Error("Missing pump fixture.");
    pump.datasheet_status = "complete";
    pump.datasheet_asset_ids = ["asset_ds_1"];
    const pumpsSlice = pumpsSliceFixture();
    pumpsSlice.pumps[0]!.datasheet_status = "complete";
    pumpsSlice.pumps[0]!.datasheet_asset_ids = ["asset_ds_1"];
    const putBodies: unknown[] = [];
    const attachBodies: unknown[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/draft/documentation-summary")) {
        return Promise.resolve(jsonResponse(summary));
      }
      if (url.startsWith("/api/v1/projects/proj_1/assets/bulk-urls")) {
        return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
      }
      if (url.endsWith("/draft/tables/pumps") && init?.method !== "PUT") {
        return Promise.resolve(jsonResponse(pumpsSlice));
      }
      if (url.endsWith("/draft/tables/pumps") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        putBodies.push(body);
        for (const row of body.pumps ?? []) {
          const target = pumpsSlice.pumps.find((current) => current.id === row.id);
          if (target) Object.assign(target, row);
        }
        return Promise.resolve(jsonResponse({ ...pumpsSlice, draft_etag: "d2" }));
      }
      if (url.endsWith("/assets/asset_ds_upload/attach")) {
        attachBodies.push(JSON.parse(String(init?.body)));
        pumpsSlice.pumps[0]!.datasheet_asset_ids = ["asset_ds_1", "asset_ds_upload"];
        return Promise.resolve(
          jsonResponse({
            version_etag: "v1",
            draft_etag: "d3",
            source: "draft",
            asset_ids: ["asset_ds_1", "asset_ds_upload"],
          }),
        );
      }
      if (url.endsWith("/draft")) {
        return Promise.resolve(
          jsonResponse({ source: "draft", draft_etag: "d2", dirty_tables: ["pumps"] }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDocumentation();

    await user.click(await screen.findByRole("button", { name: "Pumps" }));
    const pumpToggle = await screen.findByRole("button", { name: "Pump P-01" });
    const pumpRow = pumpToggle.closest("article");
    expect(pumpRow).not.toBeNull();

    await user.click(pumpToggle);
    const datasheetCell = Array.from(
      (pumpRow as HTMLElement).querySelectorAll<HTMLElement>(".documentation-evidence-cell"),
    ).find((cell) => within(cell).queryByText("Datasheet"));
    expect(
      within(datasheetCell as HTMLElement).getByRole("button", { name: "Add file" }),
    ).toBeVisible();
    const datasheetInput = datasheetCell?.querySelector<HTMLInputElement>('input[type="file"]');
    expect(datasheetInput).not.toBeNull();
    const datasheetFile = new File(["datasheet"], "pump.pdf", { type: "application/pdf" });
    Object.defineProperty(datasheetInput, "files", {
      value: [datasheetFile],
      configurable: true,
    });
    fireEvent.change(datasheetInput as HTMLInputElement);
    await waitFor(() =>
      expect(uploadAsset).toHaveBeenCalledWith("proj_1", "datasheet", datasheetFile),
    );
    await waitFor(() =>
      expect(attachBodies).toContainEqual(
        expect.objectContaining({
          table_key: "pumps",
          row_id: "pump_1",
          field_key: "datasheet_asset_ids",
          op_group_id: expect.any(String),
        }),
      ),
    );
    await user.click(pumpToggle);

    await user.selectOptions(within(pumpRow as HTMLElement).getByLabelText("Spec"), "complete");
    await waitFor(() =>
      expect(putBodies).toContainEqual(
        expect.objectContaining({
          pumps: expect.arrayContaining([
            expect.objectContaining({
              id: "pump_1",
              custom_values: expect.objectContaining({ status: "opt_status_complete" }),
            }),
          ]),
        }),
      ),
    );

    await user.selectOptions(within(pumpRow as HTMLElement).getByLabelText("Datasheet"), "na");
    await waitFor(() =>
      expect(putBodies).toContainEqual(
        expect.objectContaining({
          pumps: expect.arrayContaining([
            expect.objectContaining({ id: "pump_1", datasheet_status: "na" }),
          ]),
        }),
      ),
    );
    await user.selectOptions(within(pumpRow as HTMLElement).getByLabelText("Datasheet"), "needed");
    await waitFor(() =>
      expect(putBodies).toContainEqual(
        expect.objectContaining({
          pumps: expect.arrayContaining([
            expect.objectContaining({
              id: "pump_1",
              datasheet_status: "needed",
              datasheet_asset_ids: ["asset_ds_1", "asset_ds_upload"],
            }),
          ]),
        }),
      ),
    );
    await user.selectOptions(within(pumpRow as HTMLElement).getByLabelText("Photos"), "na");
    await waitFor(() =>
      expect(putBodies).toContainEqual(
        expect.objectContaining({
          pumps: expect.arrayContaining([
            expect.objectContaining({ id: "pump_1", photo_status: "na" }),
          ]),
        }),
      ),
    );
  });

  test("photo status stays optimistic while the clearing write is pending", async () => {
    const user = userEvent.setup();
    const checkedSummary = summaryFixture();
    const pumpsGroup = checkedSummary.sections[0]?.groups.find((group) => group.key === "pumps");
    const pump = pumpsGroup?.records.find((record) => record.record_id === "pump_1");
    if (!pump) throw new Error("Missing pump fixture.");
    pump.photo_status = "na";

    let resolvePut: ((response: Response) => void) | undefined;
    const pendingPut = new Promise<Response>((resolve) => {
      resolvePut = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/draft/documentation-summary")) {
          return Promise.resolve(jsonResponse(checkedSummary));
        }
        if (url.startsWith("/api/v1/projects/proj_1/assets/bulk-urls")) {
          return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
        }
        if (url.endsWith("/draft/tables/pumps") && init?.method !== "PUT") {
          const slice = pumpsSliceFixture();
          slice.pumps[0]!.photo_status = "na";
          return Promise.resolve(jsonResponse(slice));
        }
        if (url.endsWith("/draft/tables/pumps") && init?.method === "PUT") return pendingPut;
        return Promise.resolve(jsonResponse({}, 404));
      }),
    );
    renderDocumentation();

    await user.click(await screen.findByRole("button", { name: "Pumps" }));
    const pumpToggle = await screen.findByRole("button", { name: "Pump P-01" });
    const pumpRow = pumpToggle.closest("article");
    expect(pumpRow).not.toBeNull();
    await user.click(pumpToggle);
    const photoStatus = within(pumpRow as HTMLElement).getByLabelText("Photos");
    expect(photoStatus).toHaveValue("na");

    await user.selectOptions(photoStatus, "needed");
    expect(photoStatus).toHaveValue("needed");
    expect(within(pumpRow as HTMLElement).getByLabelText("Spec")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Ventilators" }));
    const ventilatorToggle = screen.getByRole("button", { name: "Ventilator ERV-01" });
    await user.click(ventilatorToggle);
    const ventilatorRow = ventilatorToggle.closest("article");
    expect(ventilatorRow).not.toBeNull();
    expect(within(ventilatorRow as HTMLElement).getByLabelText("Spec")).toBeEnabled();
    expect(within(ventilatorRow as HTMLElement).getByLabelText("Datasheet")).toBeEnabled();
    expect(within(ventilatorRow as HTMLElement).getByLabelText("Photos")).toBeEnabled();

    resolvePut?.(jsonResponse({ ...pumpsSliceFixture(), draft_etag: "d2" }));
  });
});

function renderDocumentation(
  project: ProjectDetail = PROJECT,
  initialEntry = "/projects/proj_1/documentation#equipment",
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/projects/:projectId/documentation"
            element={<DocumentationPage project={project} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
