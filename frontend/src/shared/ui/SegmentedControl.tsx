import { useId, type ReactNode } from "react";

import { TOOLTIP_HOVER_DELAY, Tooltip } from "./tooltip";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  ariaLabel?: string;
  tooltip?: ReactNode;
  disabled?: boolean;
  id?: string;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  ariaLabel,
  options,
  id,
  size = "sm",
  equalWidth = false,
  disabled = false,
  title,
}: {
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  options: readonly SegmentedControlOption<T>[];
  id?: string;
  size?: "xs" | "sm" | "md";
  equalWidth?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const generatedId = useId();
  const name = `${id ?? generatedId}-segmented-control`;
  const className = [
    "phn-segmented-control",
    `phn-segmented-control--${size}`,
    equalWidth ? "phn-segmented-control--equal-width" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div id={id} className={className} role="radiogroup" aria-label={ariaLabel} title={title}>
      {options.map((option, index) => {
        const input = (
          <input
            id={option.id ?? `${generatedId}-${index}`}
            type="radio"
            name={name}
            value={option.value}
            aria-label={option.ariaLabel}
            checked={value === option.value}
            disabled={disabled || option.disabled}
            onChange={() => onChange(option.value)}
          />
        );
        const tooltip =
          option.tooltip ??
          (size === "sm" && equalWidth ? (option.ariaLabel ?? option.label) : null);

        return (
          <label key={option.value} className="phn-segmented-control__option">
            {tooltip ? (
              <Tooltip content={tooltip} hoverDelay={TOOLTIP_HOVER_DELAY.medium}>
                {input}
              </Tooltip>
            ) : (
              input
            )}
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
