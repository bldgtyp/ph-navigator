import { formatNumberWithUnit } from "../../lib/units/format";

export function formatCondensationPercent(value: number): string {
  return formatNumberWithUnit(value * 100, "%", { unitSystem: "SI", fractionDigits: 1 });
}
