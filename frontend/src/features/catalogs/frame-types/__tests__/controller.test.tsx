import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { WriteOp } from "../../../../shared/ui/data-table";
import * as api from "../../api";
import { useFrameTypesCatalogController } from "../controller";

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.spyOn(api, "updateFrameType").mockResolvedValue({} as never);
  vi.spyOn(api, "createFrameType").mockResolvedValue({ id: "rec_new" } as never);
  vi.spyOn(api, "deactivateFrameType").mockResolvedValue();
  vi.spyOn(api, "duplicateFrameType").mockResolvedValue({ id: "rec_dup" } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFrameTypesCatalogController.onWrite", () => {
  test("cell op for u_value_w_m2k PATCHes the SI value verbatim", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "cell",
      writes: [{ rowId: "rec_xyz", fieldKey: "u_value_w_m2k", value: 0.85 }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateFrameType).toHaveBeenCalledWith("rec_xyz", { u_value_w_m2k: 0.85 });
  });

  test("multiple cell writes on the same row collapse into one PATCH", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "cell",
      writes: [
        { rowId: "rec_abc", fieldKey: "use", value: "Window" },
        { rowId: "rec_abc", fieldKey: "operation", value: "Casement" },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateFrameType).toHaveBeenCalledTimes(1);
    expect(api.updateFrameType).toHaveBeenCalledWith("rec_abc", {
      use: "Window",
      operation: "Casement",
    });
  });

  test("rowInsert with name → POST", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "rowInsert",
      rows: [
        {
          rowId: "rec_temp",
          fieldDefaults: { name: "SR-3", u_value_w_m2k: 0.85 },
          anchorRowId: null,
        },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.createFrameType).toHaveBeenCalledWith({ name: "SR-3", u_value_w_m2k: 0.85 });
  });

  test("rowInsert with empty fieldDefaults POSTs with a safe name placeholder", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "rowInsert",
      rows: [{ rowId: "rec_temp", fieldDefaults: {}, anchorRowId: null }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.createFrameType).toHaveBeenCalledWith({ name: "New frame type" });
  });

  test("rowDelete op calls DELETE per rowId", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "rowDelete",
      rows: [
        { rowId: "rec_a", row: {}, anchorRowId: null },
        { rowId: "rec_b", row: {}, anchorRowId: null },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.deactivateFrameType).toHaveBeenCalledWith("rec_a");
    expect(api.deactivateFrameType).toHaveBeenCalledWith("rec_b");
  });

  test("rowDuplicate op calls duplicate per sourceRowId", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "rowDuplicate",
      rows: [{ rowId: "rec_new", sourceRowId: "rec_src", sourceRow: {}, anchorRowId: null }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.duplicateFrameType).toHaveBeenCalledWith("rec_src");
  });

  test("schemaMutation throws (PRD non-goal)", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(), { wrapper });
    const op: WriteOp = {
      kind: "schemaMutation",
      variant: "typed",
      mutation: {} as never,
    };
    await act(async () => {
      await expect(result.current.onWrite(op)).rejects.toThrow(/Custom fields/);
    });
  });
});
