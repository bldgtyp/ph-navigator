import type { CustomFieldType } from "../types";

export type FieldTypeChoice = {
  kind: CustomFieldType;
  label: string;
  hint: string;
};

export const FIELD_TYPE_CHOICES: ReadonlyArray<FieldTypeChoice> = [
  { kind: "short_text", label: "Short text", hint: "Single-line text." },
  { kind: "long_text", label: "Long text", hint: "Multi-line text." },
  { kind: "number", label: "Number", hint: "Numeric value with optional precision." },
  { kind: "url", label: "URL", hint: "Link target (validated server-side)." },
  { kind: "single_select", label: "Single select", hint: "Pick one option from a defined list." },
  { kind: "color", label: "Color", hint: "Stored as a normalized hex value." },
  { kind: "formula", label: "Formula", hint: "Read-only value computed from other fields." },
];
