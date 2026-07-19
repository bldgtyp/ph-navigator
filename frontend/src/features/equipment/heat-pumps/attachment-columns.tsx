import { attachmentColumn, type DataTableColumnDef } from "../../../shared/ui/data-table";
import { AttachmentCell } from "../../assets/components/AttachmentCell";
import { DATASHEET_ATTACHMENT_CONFIG, SITE_PHOTO_ATTACHMENT_CONFIG } from "../../assets/lib";
import type { AssetUrls } from "../../assets/types";

type HeatPumpAttachmentRow = {
  id: string;
  datasheet_asset_ids: string[];
  photo_asset_ids: string[];
};

type HeatPumpAttachmentColumnArgs<TRow extends HeatPumpAttachmentRow> = {
  projectId: string;
  isEditor: boolean;
  assetUrlById: ReadonlyMap<string, AssetUrls>;
  fieldKey: string;
  onChange: (row: TRow, next: string[]) => void | Promise<void>;
};

export function heatPumpDatasheetColumn<TRow extends HeatPumpAttachmentRow>(
  args: HeatPumpAttachmentColumnArgs<TRow>,
): DataTableColumnDef<TRow> {
  return attachmentColumn({
    ...args,
    id: args.fieldKey,
    header: "Datasheet",
    config: DATASHEET_ATTACHMENT_CONFIG,
    AttachmentCell,
    getAssetIds: (row) => row.datasheet_asset_ids,
    measureLabel: "attachments",
  });
}

export function heatPumpPhotoColumn<TRow extends HeatPumpAttachmentRow>(
  args: HeatPumpAttachmentColumnArgs<TRow>,
): DataTableColumnDef<TRow> {
  return attachmentColumn({
    ...args,
    id: args.fieldKey,
    header: "Site photos",
    config: SITE_PHOTO_ATTACHMENT_CONFIG,
    AttachmentCell,
    getAssetIds: (row) => row.photo_asset_ids,
    measureLabel: "site photos",
  });
}
