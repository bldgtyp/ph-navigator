export type ArgbColor = {
  a: number;
  r: number;
  g: number;
  b: number;
};

const ARGB_PATTERN = /^\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;

export function parseArgb(value: string | null | undefined): ArgbColor | null {
  if (!value) return null;
  const match = value.match(ARGB_PATTERN);
  if (!match) return null;
  const channels = match.slice(1).map(Number) as [number, number, number, number];
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    return null;
  }
  const [a, r, g, b] = channels;
  return { a, r, g, b };
}

export function argbToCssRgb(
  value: string | null | undefined,
  fallback = "var(--bg-page)",
): string {
  const color = parseArgb(value);
  if (!color) return fallback;
  return `rgb(${color.r} ${color.g} ${color.b})`;
}
