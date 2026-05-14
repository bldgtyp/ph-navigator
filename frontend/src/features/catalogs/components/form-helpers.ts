/** Small helpers shared by every catalog editor modal. */

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function numberOrEmpty(value: number | null): string {
  return value === null ? "" : String(value);
}

export function stringOrEmpty(value: string | null): string {
  return value ?? "";
}

export function trimToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatNumber(value: number | null, fractionDigits = 3): string {
  return value === null ? "—" : value.toFixed(fractionDigits);
}

export function hasInvalidNumber(fields: string[]): boolean {
  return fields.some((field) => Number.isNaN(parseOptionalNumber(field)));
}

/** Submit-button label for the catalog editor modals (create vs edit, idle vs pending). */
export function editorSubmitLabel(isEdit: boolean, isPending: boolean, addLabel: string): string {
  if (isPending) return isEdit ? "Saving…" : "Creating…";
  return isEdit ? "Save changes" : addLabel;
}
