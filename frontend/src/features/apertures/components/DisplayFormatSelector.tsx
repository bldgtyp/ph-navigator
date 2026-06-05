// Native `<select>` for the dimension display format. Lives in the
// strip gutter (top-left corner where the two strips meet). System
// switch (SI vs IP) is owned by the global units preference; this
// selector only swaps the format *within* the active system.

import { useApertureDimFormat } from "../hooks/useApertureDimFormat";
import type { IpDisplayFormat, SiDisplayFormat } from "../../../lib/units/length/types";

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

export function DisplayFormatSelector() {
  const { system, format, setSiFormat, setIpFormat } = useApertureDimFormat();
  const options = system === "si" ? SI_OPTIONS : IP_OPTIONS;
  return (
    <label className="aperture-dim-format-selector" data-testid="aperture-dim-format-selector">
      <span className="aperture-dim-format-selector__label">Display</span>
      <select
        className="aperture-dim-format-selector__select"
        value={format}
        onChange={(event) => {
          const next = event.target.value;
          if (system === "si") setSiFormat(next as SiDisplayFormat);
          else setIpFormat(next as IpDisplayFormat);
        }}
        aria-label="Dimension display format"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
