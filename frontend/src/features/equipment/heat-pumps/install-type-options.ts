import { optionIdFromLabel } from "./lib";

export type InstallTypeOption = { id: string; label: string };

const SEED_LABELS = [
  "Cassette",
  "Wall-mounted",
  "Concealed-ducted",
  "Multi-position",
  "ERV-integrated",
] as const;

export const INSTALL_TYPE_SEED_OPTIONS: InstallTypeOption[] = SEED_LABELS.map((label) => ({
  id: optionIdFromLabel(label) ?? label,
  label,
}));

// Returns the project's install_type option list, seeded with the five
// canonical labels when the project has none yet. Existing options are
// preserved verbatim; the seed list is appended (de-duplicated by id) so
// users see the canonical labels alongside whatever they've already
// authored.
export function bootstrapInstallTypeOptions(
  existing: readonly InstallTypeOption[] | null | undefined,
): InstallTypeOption[] {
  const existingList = existing ?? [];
  if (existingList.length === 0) return [...INSTALL_TYPE_SEED_OPTIONS];
  const known = new Set(existingList.map((option) => option.id));
  const merged = [...existingList];
  for (const seed of INSTALL_TYPE_SEED_OPTIONS) {
    if (!known.has(seed.id)) merged.push(seed);
  }
  return merged;
}
