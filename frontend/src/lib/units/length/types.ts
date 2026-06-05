// Display-format vocabulary shared between the parser, the formatter, and
// the apertures dimension UI. SI and IP formats are split because the IP
// modes carry markers (`'` / `"`) while SI modes are bare numbers.

export type SiDisplayFormat = "mm" | "cm" | "m";
export type IpDisplayFormat = "in" | "ft" | "ft-in" | "in-frac";
export type DisplayFormat = SiDisplayFormat | IpDisplayFormat;
export type UnitSystem = "si" | "ip";

export function isIpFormat(format: DisplayFormat): format is IpDisplayFormat {
  return format === "in" || format === "ft" || format === "ft-in" || format === "in-frac";
}
