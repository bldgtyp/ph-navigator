export type UnitSystem = "SI" | "IP";

export type UnitPreferenceSource = "server" | "local" | "default";

export type UnitParseErrorCode =
  | "empty"
  | "invalid_number"
  | "unsupported_unit"
  | "negative"
  | "zero"
  | "out_of_range";

export type UnitParseResult =
  | { ok: true; valueSi: number }
  | { ok: false; code: UnitParseErrorCode; message: string };

export type UnitFormatOptions = {
  unitSystem: UnitSystem;
  fractionDigits?: number;
  showUnit?: boolean;
  useGrouping?: boolean;
  empty?: string;
};
