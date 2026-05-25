import type { ViewState } from "../../shared/ui/data-table";

export const TABLE_VIEW_SCHEMA_VERSION = 1;

// Plan-14 P1.5 / D13: persisted view state carries the table's schema
// fingerprint alongside the user's view. Loading a record whose
// fingerprint differs from the active schema applies the state for
// render but does not overwrite the saved record — that protects
// per-version custom-column order/widths from being clobbered when a
// different version is opened.
export type ViewStateEnvelope = {
  schema_fingerprint: string;
  view_state: ViewState;
};

export type TableViewResponse = {
  view_state_schema_version: number;
  view_state: ViewStateEnvelope | null;
  updated_at: string | null;
};

export type TableViewUpsertRequest = {
  view_state_schema_version: number;
  view_state: ViewStateEnvelope;
};
