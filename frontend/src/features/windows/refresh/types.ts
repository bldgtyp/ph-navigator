import type { CatalogTableName } from "../types";

export type RefreshSlotName =
  | "frame.top"
  | "frame.right"
  | "frame.bottom"
  | "frame.left"
  | "glazing";

export type RefreshSlotState = "in_sync" | "drifted" | "source_deactivated";

export type RefreshFieldDelta = {
  key: string;
  ref_value: unknown;
  catalog_value: unknown;
  is_overridden: boolean;
  skip_reason?: "field_type_changed";
};

export type RefreshSlotReport = {
  window_type_id: string;
  element_id: string;
  slot: RefreshSlotName;
  state: RefreshSlotState;
  catalog_table: CatalogTableName;
  catalog_record_id: string;
  pinned_catalog_version_id: string;
  current_catalog_version_id: string | null;
  local_overrides: string[];
  fields: RefreshFieldDelta[];
};

export type WindowTypesRefreshReport = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  slots: RefreshSlotReport[];
};

export type RefreshFieldChoice = "keep" | "update";

export type RefreshSelection = Record<string, RefreshFieldChoice>;
