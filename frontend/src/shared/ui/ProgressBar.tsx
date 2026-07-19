export function ProgressBar({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className: string;
}) {
  const clampedValue = Math.min(100, Math.max(0, value));
  return (
    <span
      className={className}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clampedValue)}
    >
      <span className="progress-bar__fill" style={{ width: `${clampedValue}%` }} />
    </span>
  );
}
