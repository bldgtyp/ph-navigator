// Convertibility matrix mirrored from the backend
// (`features/project_document/schema_mutations.py::CONVERSION_MATRIX`).
// Pairs absent from the matrix are forbidden — the change-type popover
// renders the target pill disabled with a tooltip explaining why.
// Keep this in sync with the backend constant.

import type { CustomFieldType } from "../hooks/useTableSchema";

export type ConversionPolicy =
  | "lossless"
  | "lossy"
  | "create_options"
  | "substitute_labels"
  | "substitute_option_colors"
  | "discard_then_author";

export const CONVERSION_MATRIX: Partial<
  Record<CustomFieldType, Partial<Record<CustomFieldType, ConversionPolicy>>>
> = {
  short_text: {
    long_text: "lossless",
    number: "lossy",
    url: "lossy",
    color: "lossy",
    single_select: "create_options",
    formula: "discard_then_author",
  },
  long_text: {
    short_text: "lossy",
    number: "lossy",
    url: "lossy",
    color: "lossy",
    single_select: "create_options",
    formula: "discard_then_author",
  },
  number: {
    short_text: "lossless",
    long_text: "lossless",
    single_select: "create_options",
    formula: "discard_then_author",
  },
  url: {
    short_text: "lossless",
    long_text: "lossless",
    color: "lossy",
    formula: "discard_then_author",
  },
  single_select: {
    short_text: "substitute_labels",
    long_text: "substitute_labels",
    // Substitute the option label, then number-coerce on the backend.
    // Labels that don't parse as numbers are cleared (preflight ack).
    number: "substitute_labels",
    color: "substitute_option_colors",
    formula: "discard_then_author",
  },
  color: {
    short_text: "lossless",
    long_text: "lossless",
    formula: "discard_then_author",
  },
  formula: {
    short_text: "lossless",
    long_text: "lossless",
    number: "lossy",
    url: "lossy",
    single_select: "create_options",
    color: "lossy",
  },
};

export function conversionPolicy(
  from: CustomFieldType,
  to: CustomFieldType,
): ConversionPolicy | null {
  return CONVERSION_MATRIX[from]?.[to] ?? null;
}

export function isConversionAllowed(from: CustomFieldType, to: CustomFieldType): boolean {
  return conversionPolicy(from, to) !== null;
}

export const TEXT_TO_SINGLE_SELECT_OPTION_CAP = 50;
