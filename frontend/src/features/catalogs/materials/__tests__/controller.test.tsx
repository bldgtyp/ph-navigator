import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { WriteOp } from "../../../../shared/ui/data-table";
import * as api from "../../api";
import { useMaterialsCatalogController, type MaterialsCatalogControllerArgs } from "../controller";

// View-state persistence is tested directly against useLocalTableViewState;
// these tests only exercise onWrite, so the controller args carry empty
// columns/fieldDefs and a stand-in fingerprint.
const CONTROLLER_ARGS: MaterialsCatalogControllerArgs = {
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
  vi.spyOn(api, "updateMaterial").mockResolvedValue({} as never);
  vi.spyOn(api, "createMaterial").mockResolvedValue({ id: "rec_new" } as never);
  vi.spyOn(api, "deactivateMaterial").mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMaterialsCatalogController.onWrite", () => {
  test("cell op for category translates opt_<id> → registry id and PATCHes", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "cell",
      writes: [{ rowId: "rec_xyz", fieldKey: "category", value: "opt_insulation" }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateMaterial).toHaveBeenCalledWith("rec_xyz", { category: "insulation" });
  });

  test("cell op for density passes the SI value through verbatim", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "cell",
      writes: [{ rowId: "rec_abc", fieldKey: "density_kg_m3", value: 42.5 }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateMaterial).toHaveBeenCalledWith("rec_abc", { density_kg_m3: 42.5 });
  });

  test("multiple cell writes on the same row collapse into one PATCH", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "cell",
      writes: [
        { rowId: "rec_abc", fieldKey: "name", value: "Updated name" },
        { rowId: "rec_abc", fieldKey: "category", value: "opt_metals" },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.updateMaterial).toHaveBeenCalledTimes(1);
    expect(api.updateMaterial).toHaveBeenCalledWith("rec_abc", {
      name: "Updated name",
      category: "metals",
    });
  });

  test("rowInsert op with name + category → POST", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "rowInsert",
      rows: [
        {
          rowId: "rec_temp",
          fieldDefaults: {
            name: "Untitled",
            category: "opt_insulation",
            density_kg_m3: 30,
          },
          anchorRowId: null,
        },
      ],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.createMaterial).toHaveBeenCalledWith({
      name: "Untitled",
      category: "insulation",
      density_kg_m3: 30,
    });
  });

  test("rowInsert with empty fieldDefaults POSTs with safe placeholders so the user can edit in place", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = {
      kind: "rowInsert",
      rows: [{ rowId: "rec_temp", fieldDefaults: {}, anchorRowId: null }],
    };
    await act(async () => {
      await result.current.onWrite(op);
    });
    expect(api.createMaterial).toHaveBeenCalledWith({
      name: "New material",
      category: "insulation",
    });
  });

  test("rowDelete op calls DELETE per rowId", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
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
    expect(api.deactivateMaterial).toHaveBeenCalledWith("rec_a");
    expect(api.deactivateMaterial).toHaveBeenCalledWith("rec_b");
  });

  test("schemaMutation throws (PRD non-goal)", async () => {
    const { result } = renderHook(() => useMaterialsCatalogController(CONTROLLER_ARGS), {
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
