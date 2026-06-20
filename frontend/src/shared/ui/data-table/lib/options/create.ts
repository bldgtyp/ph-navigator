import type { FieldOption } from "../../types";
import { generatedId } from "../../../../lib/ids";

export const OPTION_COLOR_PALETTE: readonly string[] = [
  "#3b82f6",
  "#10b981",
  "#a16207",
  "#7c3aed",
  "#0f766e",
  "#be123c",
] as const;

export function createFieldOption(rawLabel: string, existingOptions: FieldOption[]): FieldOption {
  return {
    id: generatedId("opt"),
    label: rawLabel.trim(),
    color: nextOptionColor(existingOptions.length),
    order: nextOptionOrder(existingOptions),
  };
}

export function normalizeOptionLabel(label: string): string {
  return label.trim().toLocaleLowerCase();
}

export function nextOptionColor(index: number): string {
  return OPTION_COLOR_PALETTE[index % OPTION_COLOR_PALETTE.length] ?? "#6b7280";
}

export function nextOptionOrder(options: FieldOption[]): number {
  return options.length ? Math.max(...options.map((option) => option.order)) + 1 : 0;
}

// Airtable-parity preview for text/number → single_select conversions.
// Walks preflightRows in order, dedupes by trim+case-insensitive label,
// caps at `cap` (rows past the cap are silently skipped — the server
// surfaces them as preflight incompatibles when save reaches the same
// rows). Output mirrors backend `_materialize_options_for_text_to_select`
// so the user sees the same options the server would generate, plus the
// freedom to rename / recolor / drop before saving.
export function deriveCandidateOptionsFromRows(
  rows: ReadonlyArray<{ rawValue: unknown }>,
  cap: number,
): FieldOption[] {
  const seen = new Map<string, FieldOption>();
  let orderIndex = 0;
  for (const row of rows) {
    const raw = row.rawValue;
    if (raw === null || raw === undefined) continue;
    let label: string;
    if (typeof raw === "string") label = raw.trim();
    else if (typeof raw === "boolean") label = raw ? "true" : "false";
    else if (typeof raw === "number" && Number.isFinite(raw)) label = String(raw);
    else continue;
    if (!label) continue;
    const normalized = label.toLocaleLowerCase();
    if (seen.has(normalized)) continue;
    if (seen.size >= cap) continue;
    seen.set(normalized, {
      id: generatedId("opt"),
      label,
      color: nextOptionColor(orderIndex),
      order: orderIndex,
    });
    orderIndex += 1;
  }
  return [...seen.values()];
}
