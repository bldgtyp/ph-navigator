import type { ViewState } from "../../shared/ui/data-table";

export const TABLE_VIEW_SCHEMA_VERSION = 1;

export type TableViewResponse = {
  view_state_schema_version: number;
  view_state: ViewState | null;
  updated_at: string | null;
};

export type TableViewUpsertRequest = {
  view_state_schema_version: number;
  view_state: ViewState;
};
