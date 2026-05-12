import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("App", () => {
  test("renders live backend status from the API", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          service: "ph-navigator-v2",
          phase: "tb-00",
          api_version: "v1",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          service: "ph-navigator-v2",
          app_version: "0.1.0",
          api_version: "v1",
          environment: "development",
          git_sha: null,
        }),
      });

    render(<App />);

    expect(await screen.findByText("ok")).toBeVisible();
    expect(screen.getByText("ph-navigator-v2")).toBeVisible();
    expect(screen.getByText("tb-00")).toBeVisible();
    expect(screen.getByText("0.1.0")).toBeVisible();
  });
});
