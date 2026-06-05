import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { WriteOp } from "../../../../shared/ui/data-table";
import * as api from "../../api";
import {
  useGlazingTypesCatalogController,
  type GlazingTypesCatalogControllerArgs,
} from "../controller";

const CONTROLLER_ARGS: GlazingTypesCatalogControllerArgs = {
  userId: "user-test",
  columns: [],
  fieldDefs: [],
  schemaFingerprint: "test-fp",
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, "updateGlazingType").mockResolvedValue({} as never);
  vi.spyOn(api, "createGlazingType").mockResolvedValue({ id: "rec_new" } as never);
  vi.spyOn(api, "deactivateGlazingType").mockResolvedValue();
  vi.spyOn(api, "duplicateGlazingType").mockResolvedValue({ id: "rec_dup" } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGlazingTypesCatalogController.onWrite", () => {
  test("cell op for u_value_w_m2k PATCHes the SI value verbatim", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "cell",
      writes: [{ rowId: "rec_xyz", fieldKey: "u_value_w_m2k", value: 0.625 }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateGlazingType).toHaveBeenCalledWith("rec_xyz", { u_value_w_m2k: 0.625 });
  });

  test("multiple cell writes on the same row collapse into one PATCH", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "cell",
      writes: [
        { rowId: "rec_abc", fieldKey: "name", value: "Updated name" },
        { rowId: "rec_abc", fieldKey: "manufacturer", value: "INTUS" },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateGlazingType).toHaveBeenCalledTimes(1);
    expect(api.updateGlazingType).toHaveBeenCalledWith("rec_abc", {
      name: "Updated name",
      manufacturer: "INTUS",
    });
  });

  test("rowInsert with name → POST", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "rowInsert",
      rows: [
        {
          rowId: "rec_temp",
          fieldDefaults: { name: "Triple LowE", u_value_w_m2k: 0.6 },
          anchorRowId: null,
        },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.createGlazingType).toHaveBeenCalledWith({
      name: "Triple LowE",
      u_value_w_m2k: 0.6,
    });
  });

  test("rowInsert with empty fieldDefaults POSTs with a safe name placeholder", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "rowInsert",
      rows: [{ rowId: "rec_temp", fieldDefaults: {}, anchorRowId: null }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.createGlazingType).toHaveBeenCalledWith({ name: "New glazing type" });
  });

  test("rowDelete op calls DELETE per rowId", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
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
    expect(api.deactivateGlazingType).toHaveBeenCalledWith("rec_a");
    expect(api.deactivateGlazingType).toHaveBeenCalledWith("rec_b");
  });

  test("rowDuplicate op calls duplicate per sourceRowId", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "rowDuplicate",
      rows: [{ rowId: "rec_new", sourceRowId: "rec_src", sourceRow: {}, anchorRowId: null }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.duplicateGlazingType).toHaveBeenCalledWith("rec_src");
  });

  test("schemaMutation throws (PRD non-goal)", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
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
