// Menu controls for the dimension display format. The global SI/IP
// toggle owns the unit system; this menu swaps the display style within
// the active system.

import type { ApertureDimFormatState } from "../hooks/useApertureDimFormat";
import type { IpDisplayFormat, SiDisplayFormat } from "../../../lib/units/length/types";
import { Ruler } from "lucide-react";
import { AppMenu, AppMenuRadioItem } from "../../../shared/ui/AppMenu";

const SI_OPTIONS: ReadonlyArray<{ value: SiDisplayFormat; label: string }> = [
  { value: "mm", label: "Millimeters (mm)" },
  { value: "cm", label: "Centimeters (cm)" },
  { value: "m", label: "Meters (m)" },
];

const IP_OPTIONS: ReadonlyArray<{ value: IpDisplayFormat; label: string }> = [
  { value: "in", label: "Inches (in)" },
  { value: "ft", label: "Feet (ft)" },
  { value: "ft-in", label: "Feet & Inches (ft-in)" },
  { value: "in-frac", label: "Fractional Inches (in-frac)" },
];

export type DisplayFormatMenuGroupProps = ApertureDimFormatState;

export function DisplayFormatMenuGroup({
  system,
  format,
  setSiFormat,
  setIpFormat,
}: DisplayFormatMenuGroupProps) {
  const options = system === "si" ? SI_OPTIONS : IP_OPTIONS;
  const activeOptionLabel = options.find((opt) => opt.value === format)?.label ?? "Default";

  const handleSelect = (value: SiDisplayFormat | IpDisplayFormat) => {
    if (system === "si") setSiFormat(value as SiDisplayFormat);
    else setIpFormat(value as IpDisplayFormat);
  };

  return (
    <AppMenu
      label="Dimension display"
      title={`Dimension display: ${activeOptionLabel}`}
      triggerIcon={Ruler}
      className="aperture-dim-format-menu"
    >
      {options.map((opt) => (
        <AppMenuRadioItem
          key={opt.value}
          checked={opt.value === format}
          onClick={() => handleSelect(opt.value)}
        >
          {opt.label}
        </AppMenuRadioItem>
      ))}
    </AppMenu>
  );
}
