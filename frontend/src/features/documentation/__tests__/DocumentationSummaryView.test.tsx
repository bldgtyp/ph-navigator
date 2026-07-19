import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectDetail } from "../../projects/types";
import { DocumentationPage } from "../routes/DocumentationPage";
import type { ProjectDocumentationSummary } from "../types";

const PROJECT: ProjectDetail = {
  id: "proj_1",
  name: "Linde Home",
  public_alias: null,
  display_name: "Linde Home",
  bt_number: "2524",
  client: null,
  cert_programs: ["phius"],
  phius_number: null,
  phius_dropbox_url: null,
  active_version_id: "ver_1",
  last_saved_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  versions: [],
  active_version: {
    id: "ver_1",
    project_id: "proj_1",
    name: "Working",
    kind: "working",
    locked: false,
    schema_version: 6,
    body_size_bytes: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  access_mode: "editor",
  owner_display_name: "Ed May",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DocumentationPage", () => {
  test("loads editor draft summary, filters missing photos, and opens the record modal", async () => {
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
    renderDocumentation();

    expect(await screen.findByText("Ventilator ERV-01")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Documentation" })).toBeVisible();
    expect(screen.getAllByText(hasTextContent("Spec 2/3"))[0]).toBeVisible();
    expect(screen.getAllByText(hasTextContent("Photos 2/3"))[0]).toBeVisible();
    expect(screen.getByText("Pump P-01")).toBeVisible();

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

    const missingPhotosFilter = screen.getByRole("button", { name: "Missing photos" });
    expect(missingPhotosFilter).toHaveAttribute("aria-pressed", "false");

    await user.click(missingPhotosFilter);
    expect(missingPhotosFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Ventilator ERV-01")).not.toBeInTheDocument();
    expect(screen.getByText("Pump P-01")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Pump P-01" }));
    const dialog = await screen.findByRole("dialog", { name: "Pump P-01" });
    expect(within(dialog).getByText("Specification Status")).toBeVisible();
    expect(within(dialog).getAllByText("Needed").length).toBeGreaterThan(0);

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pump P-01" })).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/projects/proj_1/versions/ver_1/draft/documentation-summary",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  test("viewer reads the saved document and exposes no upload affordances", async () => {
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
    renderDocumentation({ ...PROJECT, access_mode: "viewer" });

    expect(await screen.findByText(hasNearestTextContent("saved version"))).toBeVisible();
    expect(screen.queryByRole("button", { name: "Drop files here" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add file" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Not required" })).not.toBeInTheDocument();
  });

  test("editor status and waiver controls write through the draft table", async () => {
    const user = userEvent.setup();
    const putBodies: unknown[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/draft/documentation-summary")) {
        return Promise.resolve(jsonResponse(summaryFixture()));
      }
      if (url.startsWith("/api/v1/projects/proj_1/assets/bulk-urls")) {
        return Promise.resolve(jsonResponse({ items: assetUrlsFixture() }));
      }
      if (url.endsWith("/draft/tables/pumps") && init?.method !== "PUT") {
        return Promise.resolve(jsonResponse(pumpsSliceFixture()));
      }
      if (url.endsWith("/draft/tables/pumps") && init?.method === "PUT") {
        putBodies.push(JSON.parse(String(init.body)));
        return Promise.resolve(jsonResponse({ ...pumpsSliceFixture(), draft_etag: "d2" }));
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

    const pumpRow = (await screen.findByRole("button", { name: "Pump P-01" })).closest("article");
    expect(pumpRow).not.toBeNull();

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

    const photoWaiver = within(pumpRow as HTMLElement).getAllByLabelText("Not required")[0];
    expect(photoWaiver).toBeDefined();
    await user.click(photoWaiver as HTMLElement);
    await waitFor(() =>
      expect(putBodies).toContainEqual(
        expect.objectContaining({
          pumps: expect.arrayContaining([
            expect.objectContaining({ id: "pump_1", photo_not_required: true }),
          ]),
        }),
      ),
    );
  });
});

function renderDocumentation(project: ProjectDetail = PROJECT) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/projects/proj_1/documentation#equipment"]}>
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

function hasTextContent(text: string) {
  return (_content: string, node: Element | null) => node?.textContent === text;
}

function hasNearestTextContent(text: string) {
  return (_content: string, node: Element | null) => {
    if (!node?.textContent?.includes(text)) return false;
    return !Array.from(node.children).some((child) => child.textContent?.includes(text));
  };
}

function summaryFixture(): ProjectDocumentationSummary {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    counts: { spec_done: 2, spec_total: 3, ds_done: 2, ds_total: 3, photo_done: 2, photo_total: 3 },
    sections: [
      {
        key: "equipment",
        title: "Equipment",
        anchor: "equipment",
        counts: {
          spec_done: 2,
          spec_total: 3,
          ds_done: 2,
          ds_total: 3,
          photo_done: 2,
          photo_total: 3,
        },
        records: [],
        groups: [
          {
            key: "ventilators",
            title: "Ventilators",
            anchor: "ventilators",
            counts: {
              spec_done: 1,
              spec_total: 1,
              ds_done: 1,
              ds_total: 1,
              photo_done: 1,
              photo_total: 1,
            },
            records: [
              {
                record_id: "erv_1",
                table_key: "ventilators",
                field_table_key: "ventilators",
                display_name: "Ventilator ERV-01",
                sub_label: "Zehnder · CA350",
                spec_status: "complete",
                datasheet_asset_ids: ["asset_ds_1"],
                photo_asset_ids: ["asset_photo_1"],
                datasheet_not_required: false,
                photo_not_required: false,
                table_path: "/projects/proj_1/equipment?tab=ventilators&focus=erv_1",
                segment_ids: [],
                material_id: null,
              },
            ],
          },
          {
            key: "pumps",
            title: "Pumps",
            anchor: "pumps",
            counts: {
              spec_done: 1,
              spec_total: 2,
              ds_done: 1,
              ds_total: 2,
              photo_done: 1,
              photo_total: 2,
            },
            records: [
              {
                record_id: "pump_1",
                table_key: "pumps",
                field_table_key: "pumps",
                display_name: "Pump P-01",
                sub_label: "Fixture Pump Co · FP-010",
                spec_status: "needed",
                datasheet_asset_ids: [],
                photo_asset_ids: [],
                datasheet_not_required: false,
                photo_not_required: false,
                table_path: "/projects/proj_1/equipment?tab=pumps&focus=pump_1",
                segment_ids: [],
                material_id: null,
              },
              {
                record_id: "pump_2",
                table_key: "pumps",
                field_table_key: "pumps",
                display_name: "Pump P-02",
                sub_label: null,
                spec_status: "na",
                datasheet_asset_ids: [],
                photo_asset_ids: [],
                datasheet_not_required: true,
                photo_not_required: true,
                table_path: "/projects/proj_1/equipment?tab=pumps&focus=pump_2",
                segment_ids: [],
                material_id: null,
              },
            ],
          },
        ],
      },
    ],
  };
}

function assetUrlsFixture() {
  return [
    {
      asset_id: "asset_photo_1",
      preview_url: "/preview/photo",
      preview_expires_at: "2026-01-01T00:00:00Z",
      download_url: "/download/photo",
      download_expires_at: "2026-01-01T00:00:00Z",
      thumbnail_url: "/thumb/photo",
      thumbnail_status: "ready",
      thumbnail_expires_at: "2026-01-01T00:00:00Z",
      content_type: "image/jpeg",
      original_filename: "photo.jpg",
      display_name: "photo.jpg",
      size_bytes: 10,
    },
    {
      asset_id: "asset_ds_1",
      preview_url: "/preview/ds",
      preview_expires_at: "2026-01-01T00:00:00Z",
      download_url: "/download/ds",
      download_expires_at: "2026-01-01T00:00:00Z",
      thumbnail_url: null,
      thumbnail_status: "na",
      thumbnail_expires_at: null,
      content_type: "application/pdf",
      original_filename: "datasheet.pdf",
      display_name: "datasheet.pdf",
      size_bytes: 10,
    },
  ];
}

function pumpsSliceFixture() {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    field_defs: [],
    single_select_options: {},
    pumps: [
      {
        id: "pump_1",
        device_type: null,
        phase: null,
        notes: null,
        link: null,
        datasheet_asset_ids: [],
        datasheet_not_required: false,
        photo_asset_ids: [],
        photo_not_required: false,
        custom_values: { status: "opt_status_needed" },
      },
      {
        id: "pump_2",
        device_type: null,
        phase: null,
        notes: null,
        link: null,
        datasheet_asset_ids: [],
        datasheet_not_required: true,
        photo_asset_ids: [],
        photo_not_required: true,
        custom_values: { status: "opt_status_na" },
      },
    ],
  };
}
