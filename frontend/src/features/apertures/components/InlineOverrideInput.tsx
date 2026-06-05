// Inline-edit field used inside ``FrameRow`` / ``GlazingRow`` to
// override one numeric or string field on the slot's ref. On commit
// (Enter / blur), dispatches ``editFieldOverride``. The "You edited
// this" pill appears when ``overridden`` is true (the parent computes
// it from ``catalog_origin.local_overrides``).

import { useEffect, useState } from "react";

export type InlineOverrideInputProps = {
  fieldKey: string;
  label: string;
  value: string | number | null;
  kind: "string" | "number";
  overridden: boolean;
  disabled?: boolean;
  onCommit: (next: string | number | null) => void;
};

export function InlineOverrideInput({
  fieldKey,
  label,
  value,
  kind,
  overridden,
  disabled = false,
  onCommit,
}: InlineOverrideInputProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const commit = () => {
    if (disabled) return;
    if (draft === "") {
      if (value !== null) onCommit(null);
      return;
    }
    if (kind === "number") {
      const n = Number(draft);
      if (!Number.isFinite(n)) {
        setDraft(value === null ? "" : String(value));
        return;
      }
      if (n !== value) onCommit(n);
      return;
    }
    if (draft !== value) onCommit(draft);
  };

  return (
    <label className="aperture-inline-override" data-testid={`override-${fieldKey}`}>
      <span className="aperture-inline-override__label">{label}</span>
      <input
        className="aperture-inline-override__input"
        type={kind === "number" ? "number" : "text"}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.currentTarget as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(value === null ? "" : String(value));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
      />
      {overridden && (
        <span
          className="aperture-inline-override__pill"
          title="You edited this field. Refresh-from-catalog defaults to Keep mine."
          data-testid={`override-pill-${fieldKey}`}
        >
          edited
        </span>
      )}
    </label>
  );
}
