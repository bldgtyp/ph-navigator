// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetDownloadError, downloadAsset } from "../api";
import type { AssetUrls } from "../types";
import { AttachmentCell } from "./AttachmentCell";

vi.mock("../api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api")>();
  return { ...actual, downloadAsset: vi.fn() };
});

const ASSET: AssetUrls = {
  asset_id: "asset-1",
  preview_url: "https://files.example/report.pdf",
  preview_expires_at: "2026-08-03T15:00:00Z",
  download_url: "https://files.example/download",
  download_expires_at: "2026-08-03T15:00:00Z",
  thumbnail_url: "https://files.example/report.png",
  thumbnail_status: "ready",
  thumbnail_expires_at: "2026-08-03T15:00:00Z",
  content_type: "application/pdf",
  original_filename: "report.pdf",
  display_name: "report.pdf",
  size_bytes: 100,
};
const SECOND_ASSET: AssetUrls = {
  ...ASSET,
  asset_id: "asset-2",
  original_filename: "second.pdf",
  display_name: "second.pdf",
};

afterEach(() => {
  vi.mocked(downloadAsset).mockReset();
});

describe("AttachmentCell downloads", () => {
  it("renders a failed download in-app without navigating", async () => {
    vi.mocked(downloadAsset).mockRejectedValue(
      new AssetDownloadError("This file is no longer available.", "asset_not_found", "req-1"),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const before = window.location.href;
    render(
      <QueryClientProvider client={queryClient}>
        <AttachmentCell
          projectId="project-1"
          value={["asset-1", "asset-2"]}
          config={{
            assetKind: "datasheet",
            allowedTypes: ["application/pdf"],
            maxCount: 5,
            maxFileSizeMb: 25,
          }}
          readOnly
          onChange={vi.fn()}
          assetUrlById={
            new Map([
              ["asset-1", ASSET],
              ["asset-2", SECOND_ASSET],
            ])
          }
        />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByTitle("report.pdf · application/pdf"));
    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This file is no longer available.");
    expect(window.location.href).toBe(before);
    expect(downloadAsset).toHaveBeenCalledWith("project-1", "asset-1");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("second.pdf")).toBeInTheDocument();
  });

  it("does not show a late failure after moving to another file", async () => {
    let rejectDownload: ((reason: unknown) => void) | undefined;
    vi.mocked(downloadAsset).mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectDownload = reject;
        }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AttachmentCell
          projectId="project-1"
          value={["asset-1", "asset-2"]}
          config={{
            assetKind: "datasheet",
            allowedTypes: ["application/pdf"],
            maxCount: 5,
            maxFileSizeMb: 25,
          }}
          readOnly
          onChange={vi.fn()}
          assetUrlById={
            new Map([
              ["asset-1", ASSET],
              ["asset-2", SECOND_ASSET],
            ])
          }
        />
      </QueryClientProvider>,
    );

    await userEvent.click(screen.getByTitle("report.pdf · application/pdf"));
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    rejectDownload?.(new AssetDownloadError("Late failure.", "asset_not_found", "req-late"));

    expect(await screen.findByText("second.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
