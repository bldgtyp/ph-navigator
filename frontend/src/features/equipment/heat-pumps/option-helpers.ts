import {
  OPTION_COLOR_PALETTE,
  buildEditOptionsMutation,
  type WriteOp,
} from "../../../shared/ui/data-table";
import type { SliceTableController } from "../../../shared/ui/data-table/feature";
import type { BaseTableSlice } from "../../project_document/table-slice";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpOwnedOptionKey,
  type HeatPumpSingleSelectOption,
} from "./types";

// Each heat-pump-owned option-list namespace is read by one built-in field key
// on the equip leaves. The generic `editOptions` mutation routes by
// `(tableKey, fieldId)`, so the namespace key alone can't address it.
const OPTION_KEY_TO_FIELD_ID: Record<HeatPumpOwnedOptionKey, string> = {
  [HEAT_PUMP_OPTION_KEYS.manufacturer]: "manufacturer",
  [HEAT_PUMP_OPTION_KEYS.systemFamily]: "system_family",
  [HEAT_PUMP_OPTION_KEYS.refrigerant]: "refrigerant",
  [HEAT_PUMP_OPTION_KEYS.modelType]: "model_type",
  [HEAT_PUMP_OPTION_KEYS.installType]: "install_type",
};

export type HeatPumpOptionCreator = (
  optionKey: HeatPumpOwnedOptionKey,
  label: string,
) => Promise<string>;

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

/**
 * Build an option-create callback that adds a heat-pump single-select option
 * through the GENERIC `editOptions` schema mutation — the same path custom
 * single-selects use — instead of the bespoke `/options` endpoint.
 *
 * `controller` must own `fieldId` for the edited list: the equip-leaf tables
 * pass their own controller; the units tables pass the sibling equip controller
 * (units leaves don't carry the manufacturer/model lists). The shared
 * `manufacturer` list resolves to one namespace from either equip leaf.
 */
export function makeHeatPumpOptionCreator<TSlice extends BaseTableSlice>(args: {
  controller: SliceTableController<TSlice>;
  tableKey: string;
  optionsByKey: Record<string, readonly HeatPumpSingleSelectOption[]>;
}): HeatPumpOptionCreator {
  return async (optionKey, label) => {
    const existing = args.optionsByKey[optionKey] ?? [];
    const newOption = buildNewHeatPumpOption(label, existing);
    const mutation = buildEditOptionsMutation({
      tableKey: args.tableKey,
      fieldId: OPTION_KEY_TO_FIELD_ID[optionKey],
      nextOptions: [...existing, newOption],
      schemaFingerprint: args.controller.tableSchema.schemaFingerprint,
    });
    const writeOp: WriteOp = { kind: "schemaMutation", variant: "typed", mutation };
    await args.controller.onWrite(writeOp);
    return newOption.id;
  };
}

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
