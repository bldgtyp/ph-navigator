import { OPTION_COLOR_PALETTE } from "../../../shared/ui/data-table";
import type { HeatPumpSingleSelectOption } from "./types";

/**
 * Resolve the human-readable label for an option id from an explicit option
 * list. Returns "" if `id` is null, "" if `options` is empty, or the raw id
 * (without the `opt_` prefix) if the id isn't present in the list — that fallback
 * keeps existing rows readable while the option list is being populated for the
 * first time, and avoids a blank column for catalog-imported rows that
 * reference an option from a different project.
 */
export function optionLabelFromId(
  id: string | null,
  options: readonly HeatPumpSingleSelectOption[],
): string {
  if (!id) return "";
  const hit = options.find((option) => option.id === id);
  if (hit) return hit.label;
  return id.replace(/^opt_/, "");
}

/**
 * Look up an option by case-insensitive trimmed label match. Returns null when
 * the label doesn't match any existing option — callers that want "find or
 * create" should mint a new option and call the options-mutation API instead of
 * slugging the label client-side.
 */
export function findOptionByLabel(
  label: string,
  options: readonly HeatPumpSingleSelectOption[],
): HeatPumpSingleSelectOption | null {
  const target = label.trim().toLocaleLowerCase();
  if (!target) return null;
  return options.find((option) => option.label.trim().toLocaleLowerCase() === target) ?? null;
}

/**
 * Mint a fresh `opt_*` id + cycling color for an option created from the UI.
 * The backend mints its own id when add ops omit one, but we mint here so the
 * optimistic patch payload stays self-consistent.
 */
export function buildNewHeatPumpOption(
  label: string,
  existing: readonly HeatPumpSingleSelectOption[],
): HeatPumpSingleSelectOption {
  const trimmed = label.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const id = slug ? `opt_${slug}_${randomSuffix(4)}` : `opt_${randomSuffix(8)}`;
  const color = OPTION_COLOR_PALETTE[existing.length % OPTION_COLOR_PALETTE.length] ?? "#3b82f6";
  const order = existing.length === 0 ? 0 : Math.max(...existing.map((option) => option.order)) + 1;
  return { id, label: trimmed, color, order };
}

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
