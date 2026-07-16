import * as Popover from "@radix-ui/react-popover";
import { useState, type CSSProperties } from "react";
import { normalizeStoredHexColor } from "../../../lib/color";
import { NEUTRAL_OPTION_COLOR, OPTION_COLOR_PALETTE } from "../lib/options/create";

export type OptionColorPickerProps = {
  color: string;
  // Human label of the option this swatch belongs to, used only for
  // accessible names on the trigger and popover.
  label: string;
  disabled: boolean;
  onColorChange: (color: string) => void;
};

// Shared single-select option color control used by both the create and
// edit field-config option editors. The trigger is a clean circular swatch;
// clicking it opens a popover with the curated quick-pick palette plus a
// native "Custom" input for an arbitrary hex (`FieldOption.color` is a
// free-form string, so no schema change is needed to store it).
export function OptionColorPicker({
  color,
  label,
  disabled,
  onColorChange,
}: OptionColorPickerProps) {
  const [open, setOpen] = useState(false);
  const swatchName = label || "option";
  // Coerce any blank/legacy stored value to a valid `#rrggbb` so the trigger
  // swatch, the palette pressed-state, and `<input type="color">` all agree.
  const activeColor = normalizeStoredHexColor(color) ?? NEUTRAL_OPTION_COLOR;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="data-table-option-color-trigger"
          aria-label={`Color for ${swatchName}`}
          style={{ "--option-color": activeColor } as CSSProperties}
          disabled={disabled}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-option-color-popover"
          align="start"
          sideOffset={6}
          aria-label={`Pick a color for ${swatchName}`}
        >
          <div className="data-table-option-color-grid" role="group" aria-label="Preset colors">
            {OPTION_COLOR_PALETTE.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className="data-table-option-color-swatch"
                aria-label={swatch}
                aria-pressed={swatch.toLowerCase() === activeColor.toLowerCase()}
                style={{ "--option-color": swatch } as CSSProperties}
                onClick={() => {
                  onColorChange(swatch);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <label className="data-table-option-color-custom">
            <span className="data-table-option-color-custom-label">Custom</span>
            <input
              type="color"
              className="data-table-option-color-input"
              value={activeColor}
              onChange={(event) => onColorChange(event.target.value)}
              aria-label={`Custom color for ${swatchName}`}
            />
            <span className="data-table-option-color-hex">{activeColor.toUpperCase()}</span>
          </label>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
