import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { jsonResponse } from "../../projects/testing/locationFixtures";
import { ClimateUploadModal } from "../components/ClimateUploadModal";

// uploadAsset runs the multi-step intent → PUT → complete flow; stub it so the
// modal test focuses on file selection + the from-upload attach call.
const { uploadAssetMock } = vi.hoisted(() => ({ uploadAssetMock: vi.fn() }));
vi.mock("../../assets/hooks", () => ({ uploadAsset: uploadAssetMock }));

const PROJECT_ID = "proj-1";
const FROM_UPLOAD_URL = `/api/v1/projects/${PROJECT_ID}/climate/sources/weather/from-upload`;
const fetchMock = vi.fn();

function renderModal() {
  const onClose = vi.fn();
  const onAttached = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ClimateUploadModal projectId={PROJECT_ID} onClose={onClose} onAttached={onAttached} />
    </QueryClientProvider>,
  );
  return { onClose, onAttached };
}

function textFile(name: string): File {
  return new File(["weather-bytes"], name, { type: "text/plain" });
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  uploadAssetMock.mockReset();
});

describe("ClimateUploadModal", () => {
  test("submit is disabled until an EPW file is chosen", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Upload & attach" })).toBeDisabled();
  });

  test("uploads the picked files and attaches the weather source", async () => {
    uploadAssetMock.mockImplementation((_projectId: string, kind: string) =>
      Promise.resolve(`asset-${kind}`),
    );
    const posted: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === FROM_UPLOAD_URL && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse({ id: "new", project_id: PROJECT_ID, kind: "weather" });
      }
      return jsonResponse({}, 404);
    });
    const { onClose, onAttached } = renderModal();
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("EPW weather file"), textFile("pittsfield.epw"));
    await user.upload(screen.getByLabelText("STAT design conditions"), textFile("pittsfield.stat"));
    await user.click(screen.getByRole("button", { name: "Upload & attach" }));

    expect(uploadAssetMock).toHaveBeenCalledWith(PROJECT_ID, "epw", expect.any(File));
    expect(uploadAssetMock).toHaveBeenCalledWith(PROJECT_ID, "stat", expect.any(File));
    // DDY was not chosen → null; the EPW + STAT ids are sent.
    expect(posted).toEqual([
      { epw_asset_id: "asset-epw", stat_asset_id: "asset-stat", ddy_asset_id: null },
    ]);
    expect(onAttached).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new", kind: "weather" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test("attaches with EPW only when no companions are chosen", async () => {
    uploadAssetMock.mockImplementation((_projectId: string, kind: string) =>
      Promise.resolve(`asset-${kind}`),
    );
    const posted: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === FROM_UPLOAD_URL && init?.method === "POST") {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return jsonResponse({ id: "new", project_id: PROJECT_ID, kind: "weather" });
      }
      return jsonResponse({}, 404);
    });
    renderModal();
    const user = userEvent.setup();

    await user.upload(screen.getByLabelText("EPW weather file"), textFile("x.epw"));
    await user.click(screen.getByRole("button", { name: "Upload & attach" }));

    expect(uploadAssetMock).toHaveBeenCalledTimes(1);
    expect(posted).toEqual([
      { epw_asset_id: "asset-epw", stat_asset_id: null, ddy_asset_id: null },
    ]);
  });
});
