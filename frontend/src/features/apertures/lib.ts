import { naturalSortByName } from "../../shared/lib/sort";
import type { AuthSession } from "../auth/types";
import type { ApertureTypeEntry } from "./types";

// Must match APERTURE_EXPORT_U_VALUE_REPORT in
// backend/features/access/capabilities.py.
export const APERTURE_EXPORT_U_VALUE_REPORT = "apertures.export.u_value_report";

export function canExportApertureUValueReport(session: AuthSession | undefined): boolean {
  return session?.capabilities.includes(APERTURE_EXPORT_U_VALUE_REPORT) ?? false;
}

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
