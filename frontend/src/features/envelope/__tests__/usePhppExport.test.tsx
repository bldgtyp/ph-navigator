import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchBlob, fetchJson } from "../../../shared/api/client";
import { downloadBlob } from "../../../shared/lib/downloadBlob";
import { useEnvelopePhppExportMutation, useEnvelopePhppPreflightMutation } from "../hooks";

vi.mock("../../../shared/api/client", () => ({
  fetchBlob: vi.fn(async () => new Blob(["zip"])),
  fetchJson: vi.fn(async () => ({ assemblies: [] })),
}));
vi.mock("../../../shared/lib/downloadBlob", () => ({ downloadBlob: vi.fn() }));

const PROJECT_ID = "p1";
const VERSION_ID = "v1";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.clearAllMocks());

describe("PHPP export hooks", () => {
  test("export mutation requests the units-scoped zip and saves it under a units+version filename", async () => {
    const { result } = renderHook(() => useEnvelopePhppExportMutation(PROJECT_ID, VERSION_ID), {
      wrapper,
    });

    await result.current.mutateAsync("IP");

    expect(fetchBlob).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}/versions/${VERSION_ID}/envelope/export/phpp?units=IP`,
    );
    expect(downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      `phpp-u-values-IP-${VERSION_ID}.zip`,
    );
  });

  test("preflight mutation calls the preflight endpoint", async () => {
    const { result } = renderHook(() => useEnvelopePhppPreflightMutation(PROJECT_ID, VERSION_ID), {
      wrapper,
    });

    await result.current.mutateAsync();

    expect(fetchJson).toHaveBeenCalledWith(
      `/api/v1/projects/${PROJECT_ID}/versions/${VERSION_ID}/envelope/export/phpp/preflight`,
      { signal: undefined },
    );
  });

  test("export without a selected version rejects before fetching", async () => {
    const { result } = renderHook(() => useEnvelopePhppExportMutation(PROJECT_ID, null), {
      wrapper,
    });

    await expect(result.current.mutateAsync("SI")).rejects.toThrow(/Select a version/);
    await waitFor(() => expect(fetchBlob).not.toHaveBeenCalled());
  });
});
