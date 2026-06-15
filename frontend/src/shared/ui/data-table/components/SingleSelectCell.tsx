import type { CSSProperties } from "react";
import { singleSelectOption } from "../lib/rows/format";
import type { FieldDef, FieldOption } from "../types";

export function SingleSelectCell({
  value,
  fieldDef,
}: {
  value: unknown;
  fieldDef: FieldDef | undefined;
}) {
  const option = singleSelectOption(value, fieldDef);
  if (option) {
    return (
      <SingleSelectPill option={option} colorCodeOptions={fieldDef?.colorCodeOptions !== false} />
    );
  }
  if (value === null || value === undefined || value === "") {
    return <span className="muted-cell">Unassigned</span>;
  }
  return <span className="single-select-pill missing">Missing option</span>;
}

export function SingleSelectPill({
  option,
  colorCodeOptions = true,
}: {
  option: FieldOption;
  colorCodeOptions?: boolean;
}) {
  return (
    <span
      className="single-select-pill"
      style={colorCodeOptions ? ({ "--option-color": option.color } as CSSProperties) : undefined}
    >
      {option.label}
    </span>
  );
}
