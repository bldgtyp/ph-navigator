import { naturalSortByName } from "../../shared/lib/sort";
import type { ApertureTypeEntry } from "./types";

export function naturalSortApertures(apertures: ApertureTypeEntry[]): ApertureTypeEntry[] {
  return naturalSortByName([...apertures]);
}

/** Case-insensitive, whitespace-trimmed collision check. */
export function nameCollides(
  apertures: ApertureTypeEntry[],
  candidate: string,
  excludingId?: string,
): boolean {
  const norm = candidate.trim().toLocaleLowerCase();
  if (!norm) return false;
  return apertures.some(
    (entry) => entry.id !== excludingId && entry.name.trim().toLocaleLowerCase() === norm,
  );
}
