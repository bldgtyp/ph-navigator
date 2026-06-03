// Capability descriptor for a field type. Phase 1 expresses just the
// editor kind; later phases extend the registry with operators (Phase 4),
// option management (Phase 5), and aggregations (Phase 6) without
// changing how consumers describe a field.
export type FieldEditor =
  | { kind: "none" }
  | { kind: "text" }
  | { kind: "number" }
  | { kind: "color" }
  | { kind: "single_select" };
