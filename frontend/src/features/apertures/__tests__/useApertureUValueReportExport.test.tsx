import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import {
  UnitPreferenceContext,
  type UnitPreferenceContextValue,
} from "../../../lib/units/preference-context";
import {
  fallbackFilename,
  useApertureUValueReportExport,
} from "../hooks/useApertureUValueReportExport";

function wrapper(unitSystem: UnitSystem = "IP") {
  const value: UnitPreferenceContextValue = {
    unitSystem,
    source: "default",
    error: null,
    setUnitSystem: vi.fn(),
    toggleUnitSystem: vi.fn(),
  };
  return function UnitWrapper({ children }: { children: ReactNode }) {
    return (
      <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>
    );
  };
}

function downloadResponse(blob: Blob, filename: string | null) {
  return { blob, filename };
}

describe("useApertureUValueReportExport", () => {
  test("downloads the selected units and honors the backend filename", async () => {
    const blob = new Blob(["csv"]);
    const fetchFile = vi
      .fn()
      .mockResolvedValue(downloadResponse(blob, "BT-01-aperture-u-values-IP-Working.csv"));
    const saveBlob = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useApertureUValueReportExport({
          projectId: "project-1",
          versionId: "version-1",
          btNumber: "BT-01",
          versionLabel: "Working",
          onError,
          dependencies: { fetchFile, saveBlob },
        }),
      { wrapper: wrapper("IP") },
    );

    await act(async () => {
      await expect(result.current.download("csv")).resolves.toBe(true);
    });

    expect(fetchFile).toHaveBeenCalledWith(
      "/api/v1/projects/project-1/versions/version-1/apertures/u-values/report/export?format=csv&units=IP",
      { signal: expect.any(AbortSignal) },
    );
    expect(saveBlob).toHaveBeenCalledWith(blob, "BT-01-aperture-u-values-IP-Working.csv");
    expect(onError).toHaveBeenCalledWith(null);
  });

  test("uses the safe fallback filename and reports request errors", async () => {
    const saveBlob = vi.fn();
    const onError = vi.fn();
    const fetchFile = vi
      .fn()
      .mockResolvedValueOnce(downloadResponse(new Blob(["xlsx"]), null))
      .mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(
      () =>
        useApertureUValueReportExport({
          projectId: "project-1",
          versionId: "version-1",
          btNumber: "BT 01",
          versionLabel: "Working / Copy",
          onError,
          dependencies: { fetchFile, saveBlob },
        }),
      { wrapper: wrapper("SI") },
    );

    await act(async () => {
      await expect(result.current.download("xlsx")).resolves.toBe(true);
      await expect(result.current.download("csv")).resolves.toBe(false);
    });

    expect(saveBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      "BT-01-aperture-u-values-SI-Working-Copy.xlsx",
    );
    expect(onError).toHaveBeenLastCalledWith("offline");
  });

  test("keeps one request in flight across both menu items", async () => {
    let resolveResponse: ((response: ReturnType<typeof downloadResponse>) => void) | undefined;
    const fetchFile = vi.fn(
      () =>
        new Promise<ReturnType<typeof downloadResponse>>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    const saveBlob = vi.fn();
    const { result } = renderHook(
      () =>
        useApertureUValueReportExport({
          projectId: "project-1",
          versionId: "version-1",
          btNumber: "BT-01",
          versionLabel: "Working",
          onError: vi.fn(),
          dependencies: { fetchFile, saveBlob },
        }),
      { wrapper: wrapper() },
    );

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.download("csv");
      second = result.current.download("xlsx");
    });
    await expect(second).resolves.toBe(false);
    expect(fetchFile).toHaveBeenCalledOnce();

    await act(async () => {
      resolveResponse?.(downloadResponse(new Blob(["csv"]), null));
      await expect(first).resolves.toBe(true);
    });
    expect(saveBlob).toHaveBeenCalledOnce();
  });

  test("rejects a missing saved version before making a request", async () => {
    const fetchFile = vi.fn();
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useApertureUValueReportExport({
          projectId: "project-1",
          versionId: null,
          btNumber: "BT-01",
          versionLabel: "Working",
          onError,
          dependencies: { fetchFile, saveBlob: vi.fn() },
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await expect(result.current.download("csv")).resolves.toBe(false);
    });
    expect(fetchFile).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "Select a saved version before downloading the U-value report.",
    );
  });

  test("aborts the request and suppresses a stale download after unmount", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchFile = vi.fn(
      (_path: string, options?: RequestInit & { signal?: AbortSignal }) =>
        new Promise<ReturnType<typeof downloadResponse>>((_resolve, reject) => {
          requestSignal = options?.signal;
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const saveBlob = vi.fn();
    const { result, unmount } = renderHook(
      () =>
        useApertureUValueReportExport({
          projectId: "project-1",
          versionId: "version-1",
          btNumber: "BT-01",
          versionLabel: "Working",
          onError: vi.fn(),
          dependencies: { fetchFile, saveBlob },
        }),
      { wrapper: wrapper() },
    );

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.download("xlsx");
    });
    unmount();

    expect(requestSignal?.aborted).toBe(true);
    await expect(pending).resolves.toBe(false);
    expect(saveBlob).not.toHaveBeenCalled();
  });
});

test("the fallback filename mirrors the backend slug contract", () => {
  expect(fallbackFilename("***", "___", "IP", "csv")).toBe(
    "project-aperture-u-values-IP-version.csv",
  );
});
