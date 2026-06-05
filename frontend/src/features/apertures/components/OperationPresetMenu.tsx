// Drop-down of the seven common operation patterns from PRD §11.3.
// Picking one dispatches the preset's payload through
// ``setElementOperation`` — same wire as the type-select + direction-
// toggle path, so the user can still tweak afterwards.

import { OPERATION_PRESETS, type OperationPresetPayload } from "../operation-presets";

export type OperationPresetMenuProps = {
  disabled?: boolean;
  onPick: (payload: OperationPresetPayload) => void;
};

export function OperationPresetMenu({ disabled = false, onPick }: OperationPresetMenuProps) {
  return (
    <details className="aperture-operation-preset-menu" data-testid="operation-preset-menu">
      <summary
        className="aperture-operation-preset-menu__trigger"
        aria-disabled={disabled || undefined}
      >
        Common patterns ▾
      </summary>
      <div className="aperture-operation-preset-menu__panel" role="menu">
        {OPERATION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="aperture-operation-preset-menu__option"
            disabled={disabled}
            onClick={() => onPick(preset.payload)}
            data-testid={`operation-preset-${preset.id}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </details>
  );
}
