// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetDownloadError, bulkDownloadAssetId, downloadAsset } from "./api";

const ERROR_CASES = [
  [
    "asset_not_referenced",
    "This file isn't part of the shared view. Ask the project owner to attach it.",
  ],
  ["asset_not_found", "This file is no longer available."],
  ["asset_upload_incomplete", "This file is still uploading — try again in a moment."],
  ["project_deleted", "This project has been deleted."],
  ["not_authenticated", "Your session expired. Sign in again to download."],
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadAsset", () => {
  it.each(ERROR_CASES)("maps %s to actionable copy", async (errorCode, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error_code: errorCode,
              message: "raw server message",
              request_id: "req-known",
              details: {},
            }),
            { status: errorCode === "not_authenticated" ? 401 : 403 },
          ),
      ),
    );

    await expect(downloadAsset("project-1", "asset-1")).rejects.toMatchObject({
      name: "AssetDownloadError",
      errorCode,
      requestId: "req-known",
      message,
    } satisfies Partial<AssetDownloadError>);
  });

  it("includes the request id for an unmapped server error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error_code: "storage_unavailable",
              message: "raw server message",
              request_id: "req-support",
              details: {},
            }),
            { status: 503 },
          ),
      ),
    );

    await expect(downloadAsset("project-1", "asset-1")).rejects.toMatchObject({
      message:
        "Could not download this file. Try again or contact support. (Request ID: req-support)",
      errorCode: "storage_unavailable",
      requestId: "req-support",
    });
  });

  it("fetches the signed URL and triggers a browser download", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              asset_id: "asset-1",
              preview_url: "https://files.example/preview",
              preview_expires_at: "2026-08-03T15:00:00Z",
              download_url: "https://files.example/download",
              download_expires_at: "2026-08-03T15:00:00Z",
              thumbnail_url: null,
              thumbnail_status: null,
              thumbnail_expires_at: null,
              content_type: "application/pdf",
              original_filename: "report.pdf",
              display_name: "report.pdf",
              size_bytes: 100,
            }),
            { status: 200 },
          ),
      ),
    );

    await downloadAsset("project-1", "asset-1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/assets/asset-1/url",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0]).toMatchObject({
      href: "https://files.example/download",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});

describe("bulkDownloadAssetId", () => {
  it("rejects a failed job instead of silently doing nothing", () => {
    expect(() =>
      bulkDownloadAssetId({
        id: "job-1",
        project_id: "project-1",
        job_type: "asset_bulk_download",
        status: "failed",
        progress: 100,
        result_asset_id: null,
        error_code: "asset_bulk_download_failed",
        status_url: "/jobs/job-1",
      }),
    ).toThrow("Could not prepare this download. Try again.");
  });
});
