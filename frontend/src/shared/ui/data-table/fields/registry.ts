import type { FieldDef } from "../types";
import type { FieldEditor } from "./types";

// Resolve the editor a field type uses for inline edit. The registry is
// the one place that maps `FieldType` → behavior; both the keyboard
// dispatch and the body cell renderer consult it so the
// type-to-edit / Enter-to-edit / popover selection paths stay in sync.
export function getFieldEditor(fieldDef: FieldDef | undefined): FieldEditor {
  if (!fieldDef || fieldDef.read_only) return { kind: "none" };
  switch (fieldDef.field_type) {
    case "text":
      return { kind: "text" };
    case "number":
      return { kind: "number" };
    case "single_select":
      return { kind: "single_select" };
    case "computed":
    case "attachment":
    case "argb_color":
      return { kind: "none" };
  }
}
