import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FieldDef, FieldOption, WriteOp } from "../../../../shared/ui/data-table";
import * as api from "../../api";
import {
  useFrameTypesCatalogController,
  type FrameTypesCatalogControllerArgs,
} from "../controller";

// The grid stores option ids; the controller maps them to labels for the REST
// boundary. Fixtures mirror the seeded canonical options.
const OPTIONS: Record<string, FieldOption[]> = {
  manufacturer: [{ id: "opt_alpen", label: "Alpen", color: "#3b82f6", order: 0 }],
  brand: [{ id: "opt_tyrol", label: "Tyrol", color: "#3b82f6", order: 0 }],
  use: [{ id: "opt_window", label: "Window", color: "#3b82f6", order: 0 }],
  operation: [{ id: "opt_casement", label: "Casement", color: "#3b82f6", order: 0 }],
  location: [{ id: "opt_head", label: "Head", color: "#3b82f6", order: 0 }],
  mull_type: [{ id: "opt_opfx", label: "OP-to-FX", color: "#3b82f6", order: 0 }],
};

const CONTROLLER_ARGS: FrameTypesCatalogControllerArgs = {
  userId: "user-test",
  columns: [],
  fieldDefs: [],
  schemaFingerprint: "test-fp",
  optionsByField: OPTIONS,
};

function field(fieldKey: string, options: FieldOption[]): FieldDef {
  return { field_key: fieldKey, field_type: "single_select", display_name: fieldKey, options };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, "updateFrameType").mockResolvedValue({} as never);
  vi.spyOn(api, "createFrameType").mockResolvedValue({ id: "rec_new" } as never);
  vi.spyOn(api, "deactivateFrameType").mockResolvedValue();
  vi.spyOn(api, "duplicateFrameType").mockResolvedValue({ id: "rec_dup" } as never);
  vi.spyOn(api, "putFrameTypeOptions").mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFrameTypesCatalogController.onWrite", () => {
  test("non-option cell value (u_value) PATCHes verbatim", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [{ rowId: "rec_xyz", fieldKey: "u_value_w_m2k", value: 0.85 }],
      });
    });
    expect(api.updateFrameType).toHaveBeenCalledWith("rec_xyz", { u_value_w_m2k: 0.85 });
  });

  test("single-select cell writes map option id → label and collapse into one PATCH", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [
          { rowId: "rec_abc", fieldKey: "use", value: "opt_window" },
          { rowId: "rec_abc", fieldKey: "operation", value: "opt_casement" },
        ],
      });
    });
    expect(api.updateFrameType).toHaveBeenCalledTimes(1);
    expect(api.updateFrameType).toHaveBeenCalledWith("rec_abc", {
      use: "Window",
      operation: "Casement",
    });
  });

  test("a write to the derived name cell is dropped (never PATCHed)", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [{ rowId: "rec_abc", fieldKey: "name", value: "hand typed" }],
      });
    });
    expect(api.updateFrameType).not.toHaveBeenCalled();
  });

  test("inline-add persists the new option before the row PATCH (with its label)", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const newOption: FieldOption = { id: "opt_new", label: "Vanguard", color: "#10b981", order: 1 };
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [{ rowId: "rec_abc", fieldKey: "brand", value: "opt_new" }],
        newOptions: { brand: [newOption] },
      });
    });
    expect(api.putFrameTypeOptions).toHaveBeenCalledWith({
      field_key: "brand",
      options: [{ id: "opt_tyrol", label: "Tyrol", color: "#3b82f6", order: 0 }, newOption],
    });
    expect(api.updateFrameType).toHaveBeenCalledWith("rec_abc", { brand: "Vanguard" });
  });

  test("rowInsert omits the derived name and maps option defaults to labels", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowInsert",
        rows: [
          {
            rowId: "rec_temp",
            fieldDefaults: { use: "opt_window", u_value_w_m2k: 0.85 },
            anchorRowId: null,
          },
        ],
      });
    });
    expect(api.createFrameType).toHaveBeenCalledWith({ use: "Window", u_value_w_m2k: 0.85 });
  });

  test("rowInsert with empty fieldDefaults POSTs an empty payload (name derives)", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowInsert",
        rows: [{ rowId: "rec_temp", fieldDefaults: {}, anchorRowId: null }],
      });
    });
    expect(api.createFrameType).toHaveBeenCalledWith({});
  });

  test("rowDelete op calls DELETE per rowId", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowDelete",
        rows: [
          { rowId: "rec_a", row: {}, anchorRowId: null },
          { rowId: "rec_b", row: {}, anchorRowId: null },
        ],
      });
    });
    expect(api.deactivateFrameType).toHaveBeenCalledWith("rec_a");
    expect(api.deactivateFrameType).toHaveBeenCalledWith("rec_b");
  });

  test("rowDuplicate op calls duplicate per sourceRowId", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowDuplicate",
        rows: [{ rowId: "rec_new", sourceRowId: "rec_src", sourceRow: {}, anchorRowId: null }],
      });
    });
    expect(api.duplicateFrameType).toHaveBeenCalledWith("rec_src");
  });

  test("option rename (legacyOptions) PUTs the new list with no replacements", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const before = field("mull_type", [
      { id: "opt_x", label: "OP-TO-FIX", color: "#3b82f6", order: 0 },
    ]);
    const after = field("mull_type", [
      { id: "opt_x", label: "OP-to-FX", color: "#3b82f6", order: 0 },
    ]);
    await act(async () => {
      await result.current.onWrite({
        kind: "schemaMutation",
        variant: "legacyOptions",
        before,
        after,
      });
    });
    expect(api.putFrameTypeOptions).toHaveBeenCalledWith({
      field_key: "mull_type",
      options: [{ id: "opt_x", label: "OP-to-FX", color: "#3b82f6", order: 0 }],
      replacements: {},
    });
  });

  test("field-config bundle routes option edits through legacyOptions", async () => {
    const fieldDefs = [
      field("mull_type", [
        { id: "opt_old", label: "Old", color: "#3b82f6", order: 0 },
        { id: "opt_new", label: "New", color: "#22c55e", order: 1 },
      ]),
    ];
    const { result } = renderHook(
      () => useFrameTypesCatalogController({ ...CONTROLLER_ARGS, fieldDefs }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onEditCustomFieldBundle({
        fieldKey: "mull_type",
        displayName: "mull_type",
        description: null,
        options: [{ id: "opt_new", label: "New", color: "#22c55e", order: 0 }],
        optionReplacements: { opt_old: "opt_new" },
      });
    });
    expect(api.putFrameTypeOptions).toHaveBeenCalledWith({
      field_key: "mull_type",
      options: [{ id: "opt_new", label: "New", color: "#22c55e", order: 0 }],
      replacements: { Old: "New" },
    });
  });

  test("merge (delete in-use option + cascade) PUTs label replacements", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const before = field("mull_type", [
      { id: "opt_fix", label: "OP-TO-FIX", color: "#3b82f6", order: 0 },
      { id: "opt_fx", label: "OP-to-FX", color: "#3b82f6", order: 1 },
    ]);
    const after = field("mull_type", [
      { id: "opt_fx", label: "OP-to-FX", color: "#3b82f6", order: 0 },
    ]);
    await act(async () => {
      await result.current.onWrite({
        kind: "schemaMutation",
        variant: "legacyOptions",
        before,
        after,
        cellWrites: [{ rowId: "rec_a", fieldKey: "mull_type", value: "opt_fx" }],
      });
    });
    expect(api.putFrameTypeOptions).toHaveBeenCalledWith({
      field_key: "mull_type",
      options: [{ id: "opt_fx", label: "OP-to-FX", color: "#3b82f6", order: 0 }],
      replacements: { "OP-TO-FIX": "OP-to-FX" },
    });
  });

  test("a typed schema mutation (custom field) is rejected", async () => {
    const { result } = renderHook(() => useFrameTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = { kind: "schemaMutation", variant: "typed", mutation: {} as never };
    await act(async () => {
      await expect(result.current.onWrite(op)).rejects.toThrow(/Custom fields/);
    });
  });
});
