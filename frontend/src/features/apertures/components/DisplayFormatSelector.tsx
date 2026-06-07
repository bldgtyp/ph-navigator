// Menu controls for the dimension display format. The global SI/IP
// toggle owns the unit system; this menu swaps the display style within
// the active system.

import type { ApertureDimFormatState } from "../hooks/useApertureDimFormat";
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

export type DisplayFormatMenuGroupProps = ApertureDimFormatState;

export function DisplayFormatMenuGroup({
  system,
  format,
  setSiFormat,
  setIpFormat,
}: DisplayFormatMenuGroupProps) {
  const options = system === "si" ? SI_OPTIONS : IP_OPTIONS;
  const activeOptionLabel = options.find((opt) => opt.value === format)?.label ?? "Default";

  const handleSelect = (value: SiDisplayFormat | IpDisplayFormat, target: EventTarget | null) => {
    if (system === "si") setSiFormat(value as SiDisplayFormat);
    else setIpFormat(value as IpDisplayFormat);

    if (target instanceof Element) {
      target.closest("details.app-subtabs__menu-wrap")?.removeAttribute("open");
    }
  };

  return (
    <details className="app-subtabs__submenu" data-testid="aperture-dim-format-selector">
      <summary className="app-subtabs__menu-item app-subtabs__submenu-trigger">
        <span>Dimension display</span>
        <span className="app-subtabs__menu-item-value">{activeOptionLabel}</span>
      </summary>
      <div className="app-subtabs__submenu-panel" role="menu" aria-label="Dimension display format">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="app-subtabs__menu-item app-subtabs__menu-radio"
            role="menuitemradio"
            aria-checked={opt.value === format}
            onClick={(event) => handleSelect(opt.value, event.currentTarget)}
          >
            <span className="app-subtabs__menu-radio-mark" aria-hidden="true" />
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
