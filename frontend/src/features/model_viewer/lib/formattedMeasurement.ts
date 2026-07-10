export type FormattedMeasurement = {
  formatted: string;
  value: string;
  unit: string | null;
};

/** Split the display contract emitted by shared unit formatters: `value unit`.
 * The unit may itself contain punctuation but never whitespace. */
export function splitFormattedMeasurement(formatted: string): FormattedMeasurement {
  const trimmed = formatted.trim();
  const match = /^(.+?)\s+([^\s]+)$/.exec(trimmed);
  if (!match) return { formatted: trimmed, value: trimmed, unit: null };
  const [, value = trimmed, unit = null] = match;
  return { formatted: trimmed, value, unit };
}
