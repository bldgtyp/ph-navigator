import { useId } from "react";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  ariaLabel?: string;
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
      {options.map((option, index) => (
        <label key={option.value} className="phn-segmented-control__option">
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
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
