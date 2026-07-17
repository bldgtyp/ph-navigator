import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FieldDef, FieldOption, WriteOp } from "../../../../shared/ui/data-table";
import * as api from "../../api";
import {
  useGlazingTypesCatalogController,
  type GlazingTypesCatalogControllerArgs,
} from "../controller";

// The grid stores option ids; the controller maps them to labels for the REST
// boundary. Fixtures mirror the seeded canonical options.
// `manufacturer` is the only single-select; `brand` is free text (no options).
const OPTIONS: Record<string, FieldOption[]> = {
  manufacturer: [{ id: "opt_kawneer", label: "Kawneer", color: "#3b82f6", order: 0 }],
};

const CONTROLLER_ARGS: GlazingTypesCatalogControllerArgs = {
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
  vi.spyOn(api, "updateGlazingType").mockResolvedValue({} as never);
  vi.spyOn(api, "createGlazingType").mockResolvedValue({ id: "rec_new" } as never);
  vi.spyOn(api, "deactivateGlazingType").mockResolvedValue();
  vi.spyOn(api, "duplicateGlazingType").mockResolvedValue({ id: "rec_dup" } as never);
  vi.spyOn(api, "putGlazingTypeOptions").mockResolvedValue({} as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useGlazingTypesCatalogController.onWrite", () => {
  test("non-option cell value (u_value) PATCHes verbatim", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [{ rowId: "rec_xyz", fieldKey: "u_value_w_m2k", value: 0.625 }],
      });
    });
    expect(api.updateGlazingType).toHaveBeenCalledWith("rec_xyz", { u_value_w_m2k: 0.625 });
  });

  test("manufacturer cell write maps option id → label; free-text brand passes verbatim", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [
          { rowId: "rec_abc", fieldKey: "manufacturer", value: "opt_kawneer" },
          { rowId: "rec_abc", fieldKey: "brand", value: "Any Make-Up" },
        ],
      });
    });
    expect(api.updateGlazingType).toHaveBeenCalledTimes(1);
    // manufacturer is mapped id → label; brand (free text) is sent as typed.
    expect(api.updateGlazingType).toHaveBeenCalledWith("rec_abc", {
      manufacturer: "Kawneer",
      brand: "Any Make-Up",
    });
  });

  test("a write to the derived name cell is dropped (never PATCHed)", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [{ rowId: "rec_abc", fieldKey: "name", value: "hand typed" }],
      });
    });
    expect(api.updateGlazingType).not.toHaveBeenCalled();
  });

  test("inline-add persists the new manufacturer option before the row PATCH (with its label)", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const newOption: FieldOption = { id: "opt_new", label: "Vanguard", color: "#10b981", order: 1 };
    await act(async () => {
      await result.current.onWrite({
        kind: "cell",
        writes: [{ rowId: "rec_abc", fieldKey: "manufacturer", value: "opt_new" }],
        newOptions: { manufacturer: [newOption] },
      });
    });
    expect(api.putGlazingTypeOptions).toHaveBeenCalledWith({
      field_key: "manufacturer",
      options: [{ id: "opt_kawneer", label: "Kawneer", color: "#3b82f6", order: 0 }, newOption],
    });
    expect(api.updateGlazingType).toHaveBeenCalledWith("rec_abc", { manufacturer: "Vanguard" });
  });

  test("rowInsert omits the derived name and maps option defaults to labels", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowInsert",
        rows: [
          {
            rowId: "rec_temp",
            fieldDefaults: { manufacturer: "opt_kawneer", u_value_w_m2k: 0.6 },
            anchorRowId: null,
          },
        ],
      });
    });
    expect(api.createGlazingType).toHaveBeenCalledWith({
      manufacturer: "Kawneer",
      u_value_w_m2k: 0.6,
    });
  });

  test("rowInsert with empty fieldDefaults POSTs an empty payload (name derives)", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowInsert",
        rows: [{ rowId: "rec_temp", fieldDefaults: {}, anchorRowId: null }],
      });
    });
    expect(api.createGlazingType).toHaveBeenCalledWith({});
  });

  test("rowDelete op calls DELETE per rowId", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
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
    expect(api.deactivateGlazingType).toHaveBeenCalledWith("rec_a");
    expect(api.deactivateGlazingType).toHaveBeenCalledWith("rec_b");
  });

  test("rowDuplicate op calls duplicate per sourceRowId", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    await act(async () => {
      await result.current.onWrite({
        kind: "rowDuplicate",
        rows: [{ rowId: "rec_new", sourceRowId: "rec_src", sourceRow: {}, anchorRowId: null }],
      });
    });
    expect(api.duplicateGlazingType).toHaveBeenCalledWith("rec_src");
  });

  test("option rename (legacyOptions) PUTs the new list with no replacements", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const before = field("manufacturer", [
      { id: "opt_x", label: "intus", color: "#3b82f6", order: 0 },
    ]);
    const after = field("manufacturer", [
      { id: "opt_x", label: "INTUS", color: "#3b82f6", order: 0 },
    ]);
    await act(async () => {
      await result.current.onWrite({
        kind: "schemaMutation",
        variant: "legacyOptions",
        before,
        after,
      });
    });
    expect(api.putGlazingTypeOptions).toHaveBeenCalledWith({
      field_key: "manufacturer",
      options: [{ id: "opt_x", label: "INTUS", color: "#3b82f6", order: 0 }],
      replacements: {},
    });
  });

  test("field-config bundle routes option edits through legacyOptions", async () => {
    const fieldDefs = [
      field("manufacturer", [
        { id: "opt_old", label: "Old", color: "#3b82f6", order: 0 },
        { id: "opt_new", label: "New", color: "#22c55e", order: 1 },
      ]),
    ];
    const { result } = renderHook(
      () => useGlazingTypesCatalogController({ ...CONTROLLER_ARGS, fieldDefs }),
      { wrapper },
    );
    await act(async () => {
      await result.current.onEditCustomFieldBundle({
        fieldKey: "manufacturer",
        displayName: "manufacturer",
        description: null,
        options: [{ id: "opt_new", label: "New", color: "#22c55e", order: 0 }],
        optionReplacements: { opt_old: "opt_new" },
      });
    });
    expect(api.putGlazingTypeOptions).toHaveBeenCalledWith({
      field_key: "manufacturer",
      options: [{ id: "opt_new", label: "New", color: "#22c55e", order: 0 }],
      replacements: { Old: "New" },
    });
  });

  test("rename defers the returned cascade job until the field editor closes", async () => {
    const onCascadeJobCreated = vi.fn();
    const fieldDefs = [
      field("manufacturer", [{ id: "opt_old", label: "Old", color: "#3b82f6", order: 0 }]),
    ];
    vi.mocked(api.putGlazingTypeOptions).mockResolvedValue({
      cascade_job: { id: "catjob_123" },
    } as never);
    const { result } = renderHook(
      () =>
        useGlazingTypesCatalogController({
          ...CONTROLLER_ARGS,
          fieldDefs,
          onCascadeJobCreated,
        }),
      { wrapper },
    );

    let afterClose: (() => void) | undefined;
    await act(async () => {
      const editResult = await result.current.onEditCustomFieldBundle({
        fieldKey: "manufacturer",
        displayName: "manufacturer",
        description: null,
        options: [{ id: "opt_old", label: "New", color: "#3b82f6", order: 0 }],
      });
      if (editResult && "afterClose" in editResult) afterClose = editResult.afterClose;
    });

    expect(onCascadeJobCreated).not.toHaveBeenCalled();
    expect(afterClose).toBeTypeOf("function");
    afterClose?.();
    expect(onCascadeJobCreated).toHaveBeenCalledWith({ id: "catjob_123" });
  });

  test("merge (delete in-use option + cascade) PUTs label replacements", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const before = field("manufacturer", [
      { id: "opt_lower", label: "intus", color: "#3b82f6", order: 0 },
      { id: "opt_upper", label: "INTUS", color: "#3b82f6", order: 1 },
    ]);
    const after = field("manufacturer", [
      { id: "opt_upper", label: "INTUS", color: "#3b82f6", order: 0 },
    ]);
    await act(async () => {
      await result.current.onWrite({
        kind: "schemaMutation",
        variant: "legacyOptions",
        before,
        after,
        cellWrites: [{ rowId: "rec_a", fieldKey: "manufacturer", value: "opt_upper" }],
      });
    });
    expect(api.putGlazingTypeOptions).toHaveBeenCalledWith({
      field_key: "manufacturer",
      options: [{ id: "opt_upper", label: "INTUS", color: "#3b82f6", order: 0 }],
      replacements: { intus: "INTUS" },
    });
  });

  test("a typed schema mutation (custom field) is rejected", async () => {
    const { result } = renderHook(() => useGlazingTypesCatalogController(CONTROLLER_ARGS), {
      wrapper,
    });
    const op: WriteOp = { kind: "schemaMutation", variant: "typed", mutation: {} as never };
    await act(async () => {
      await expect(result.current.onWrite(op)).rejects.toThrow(/Custom fields/);
    });
  });
});
