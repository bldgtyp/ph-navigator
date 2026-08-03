import type { CSSProperties } from "react";
import { StatusPill, type ReportStatusKey } from "../../report-table";
import { singleSelectOption } from "../lib/rows/format";
import {
  STATUS_FIELD_KEY,
  STATUS_OPTION_COMPLETE,
  STATUS_OPTION_NA,
  STATUS_OPTION_NEEDED,
  STATUS_OPTION_QUESTION,
} from "../status";
import type { FieldDef, FieldOption } from "../types";

type StatusOptionKind = ReportStatusKey | "other";

function statusOptionKind(option: FieldOption): StatusOptionKind {
  switch (option.id) {
    case STATUS_OPTION_COMPLETE:
      return "complete";
    case STATUS_OPTION_NEEDED:
      return "needed";
    case STATUS_OPTION_QUESTION:
      return "question";
    case STATUS_OPTION_NA:
      return "na";
    default:
      return "other";
  }
}

export function SingleSelectCell({
  value,
  fieldDef,
}: {
  value: unknown;
  fieldDef: FieldDef | undefined;
}) {
  const option = singleSelectOption(value, fieldDef);
  if (option) {
    if (fieldDef?.field_key === STATUS_FIELD_KEY && fieldDef.built_in === true) {
      return <SingleSelectStatusPill option={option} />;
    }
    return (
      <SingleSelectPill option={option} colorCodeOptions={fieldDef?.colorCodeOptions !== false} />
    );
  }
  if (value === null || value === undefined || value === "") {
    return <span className="muted-cell">Unassigned</span>;
  }
  return <span className="single-select-pill missing">Missing option</span>;
}

function SingleSelectStatusPill({ option }: { option: FieldOption }) {
  const kind = statusOptionKind(option);
  if (kind === "other") return <SingleSelectPill option={option} />;
  return <StatusPill status={kind}>{option.label}</StatusPill>;
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
