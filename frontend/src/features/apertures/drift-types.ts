// Wire shapes for the Phase 12 drift report. Mirror the backend
// ``ApertureDriftReport`` / ``ApertureDriftEntry`` / ``RefFieldDelta``
// without depending on the project-document types so the dialog can
// render any of them in isolation.

export type DriftTarget = "frame.top" | "frame.right" | "frame.bottom" | "frame.left" | "glazing";

export type DriftKind = "field_delta" | "catalog_row_missing";

export type RefFieldDelta = {
  field_key: string;
  catalog_value: string | number | boolean | null;
  yours_value: string | number | boolean | null;
  in_local_overrides: boolean;
};

export type ApertureDriftEntry = {
  aperture_type_id: string;
  aperture_type_name: string;
  element_id: string;
  element_name: string;
  target: DriftTarget;
  kind: DriftKind;
  catalog_record_id: string;
  deltas: RefFieldDelta[];
};

export type ApertureDriftReport = {
  entries: ApertureDriftEntry[];
};
