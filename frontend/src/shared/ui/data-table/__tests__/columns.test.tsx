import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { describe, expect, test, vi } from "vitest";
import {
  DATA_TABLE_COLUMN_WIDTHS,
  LinkCell,
  attachmentColumn,
  identifierColumn,
  identifierColumnDef,
  linkColumn,
  shortenUrl,
} from "../columns";
import { incomingLinkColumn, incomingLinkFieldDef } from "../incoming-links";
import { parseNumberInput } from "../../../../lib/units/format";
import type { FieldDef } from "../types";

type Row = {
  id: string;
  name: string;
  url: string | null;
  assetIds: string[];
};

type TestAttachmentCellProps = {
  projectId: string;
  value: string[];
  config: { maxCount: number };
  readOnly: boolean;
  onChange: (next: string[]) => void;
  assetUrlById?: ReadonlyMap<string, { asset_id: string }>;
};

const fields = new Map<string, FieldDef>([
  ["name", { field_key: "name", field_type: "text", display_name: "Display Name" }],
  ["url", { field_key: "url", field_type: "text", display_name: "URL" }],
  [
    "datasheet_asset_ids",
    { field_key: "datasheet_asset_ids", field_type: "attachment", display_name: "Datasheet" },
  ],
]);

describe("shared data-table column builders", () => {
  test("shortens valid URLs and leaves non-URLs unchanged", () => {
    expect(shortenUrl("https://example.com/path/to/file.pdf")).toBe("example.com/path/to/file.pdf");
    expect(shortenUrl("not a url")).toBe("not a url");
  });

  test("LinkCell renders the shared link affordance", () => {
    render(<LinkCell value="https://example.com/spec.pdf" />);
    const link = screen.getByRole("link", { name: "example.com/spec.pdf" });
    expect(link).toHaveAttribute("href", "https://example.com/spec.pdf");
    expect(link).toHaveClass("data-table-link-cell");
  });

  test("linkColumn wires accessor, renderer, measurement, and width", () => {
    const column = linkColumn<Row>({
      id: "url",
      header: fields.get("url")?.display_name ?? "URL",
      getValue: (row) => row.url,
    });

    const row = { id: "row_1", name: "Pump", url: "https://example.com/pump", assetIds: [] };
    expect(column.accessor(row)).toBe(row.url);
    expect(column.measureText?.(row)).toBe(row.url);
    expect(column.defaultWidth).toBe(DATA_TABLE_COLUMN_WIDTHS.link);
  });

  test("identifierColumn marks the field and applies the shared width", () => {
    const column = identifierColumn<Row>({
      fieldDefByKey: fields,
      accessor: (row) => row.name,
    });

    expect(column.id).toBe("name");
    expect(column.header).toBe("Display Name");
    expect(column.isIdentifier).toBe(true);
    expect(column.defaultWidth).toBe(DATA_TABLE_COLUMN_WIDTHS.identifier);
  });

  test("identifierColumnDef marks existing computed columns without changing ids", () => {
    const column = identifierColumnDef<Row>({
      id: "record_id",
      fieldKey: "record_id",
      header: "Display Name",
      accessor: (row) => row.name,
    });

    expect(column.id).toBe("record_id");
    expect(column.isIdentifier).toBe(true);
    expect(column.defaultWidth).toBe(DATA_TABLE_COLUMN_WIDTHS.identifier);
  });

  test("incomingLinkFieldDef marks read-only linked-record target columns", () => {
    const fieldDef = incomingLinkFieldDef({
      fieldKey: "incoming_units",
      displayName: "Incoming units",
      targetTablePath: ["equipment", "heat_pumps", "indoor_units"],
    });

    expect(fieldDef.field_type).toBe("linked_record");
    expect(fieldDef.read_only).toBe(true);
    expect(fieldDef.linked_record_config?.target_table_path).toEqual([
      "equipment",
      "heat_pumps",
      "indoor_units",
    ]);
    expect(fieldDef.linked_record_config?.max_links).toBeNull();
  });

  test("incomingLinkColumn resolves pill labels and forwards clicks", async () => {
    const onPillClick = vi.fn();
    const column = incomingLinkColumn<Row>({
      id: "incoming_units",
      header: "Incoming units",
      getIncomingIds: () => ["unit_1"],
      resolveLabel: (rowId) => (rowId === "unit_1" ? "AHU-1" : null),
      onPillClick,
    });

    const row = { id: "row_1", name: "Pump", url: null, assetIds: [] };
    expect(column.accessor(row)).toBe("AHU-1");
    expect(column.measureText?.(row)).toBe("AHU-1");
    render(<>{column.render?.(row)}</>);
    screen.getByRole("button", { name: "AHU-1" }).click();
    expect(onPillClick).toHaveBeenCalledWith("unit_1");
  });

  test("attachmentColumn skips equal writes and writes changed ids", () => {
    const onWrite = vi.fn();
    const attachmentCellMock = vi.fn((props: TestAttachmentCellProps) => {
      void props;
      return null;
    });
    const AttachmentCell: ComponentType<TestAttachmentCellProps> = attachmentCellMock;
    const column = attachmentColumn<Row, { maxCount: number }, { asset_id: string }>({
      id: "datasheet_asset_ids",
      header: "Datasheet",
      projectId: "proj_1",
      isEditor: true,
      assetUrlById: new Map(),
      config: { maxCount: 5 },
      AttachmentCell,
      getAssetIds: (row) => row.assetIds,
      getRowId: (row) => row.id,
      onWrite,
    });
    const row = { id: "row_1", name: "Pump", url: null, assetIds: ["asset_1"] };

    render(<>{column.render?.(row)}</>);
    expect(attachmentCellMock).toHaveBeenCalled();
    const props = attachmentCellMock.mock.calls[0]?.[0];
    if (!props) throw new Error("AttachmentCell was not rendered");
    const { onChange } = props;
    onChange(["asset_1"]);
    expect(onWrite).not.toHaveBeenCalled();

    onChange(["asset_2"]);
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "row_1", fieldKey: "datasheet_asset_ids", value: ["asset_2"] }],
    });
    expect(column.measureText?.(row)).toBe("1 attachments");
  });

  test("attachmentColumn supports direct row change callbacks", () => {
    const onChange = vi.fn();
    const attachmentCellMock = vi.fn((props: TestAttachmentCellProps) => {
      void props;
      return null;
    });
    const AttachmentCell: ComponentType<TestAttachmentCellProps> = attachmentCellMock;
    const column = attachmentColumn<Row, { maxCount: number }, { asset_id: string }>({
      id: "datasheet_asset_ids",
      header: "Datasheet",
      projectId: "proj_1",
      isEditor: true,
      assetUrlById: new Map(),
      config: { maxCount: 5 },
      AttachmentCell,
      getAssetIds: (row) => row.assetIds,
      onChange,
    });
    const row = { id: "row_1", name: "Pump", url: null, assetIds: ["asset_1"] };

    render(<>{column.render?.(row)}</>);
    const props = attachmentCellMock.mock.calls[0]?.[0];
    if (!props) throw new Error("AttachmentCell was not rendered");
    props.onChange(["asset_2"]);

    expect(onChange).toHaveBeenCalledWith(row, ["asset_2"]);
  });

  test("parseNumberInput handles blank and invalid inputs as null", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("  ")).toBeNull();
    expect(parseNumberInput("12.5")).toBe(12.5);
    expect(parseNumberInput(Number.NaN)).toBeNull();
    expect(parseNumberInput("nope")).toBeNull();
  });
});
