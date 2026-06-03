import {
  AlignLeft,
  CircleChevronDown,
  Hash,
  Link,
  Palette,
  Paperclip,
  SquareFunction,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { CustomFieldType, FieldDef, FieldType } from "../types";

type FieldTypeIconKind = CustomFieldType | FieldType;

type FieldTypeIconMeta = {
  Icon: LucideIcon;
  label: string;
};

const FIELD_TYPE_ICON_META: Record<FieldTypeIconKind, FieldTypeIconMeta> = {
  short_text: { Icon: Type, label: "Short text" },
  long_text: { Icon: AlignLeft, label: "Long text" },
  number: { Icon: Hash, label: "Number" },
  url: { Icon: Link, label: "URL" },
  single_select: { Icon: CircleChevronDown, label: "Single select" },
  formula: { Icon: SquareFunction, label: "Formula" },
  text: { Icon: Type, label: "Text" },
  computed: { Icon: SquareFunction, label: "Computed" },
  attachment: { Icon: Paperclip, label: "Attachment" },
  color: { Icon: Palette, label: "Color" },
};

function fieldTypeIconKind(fieldDef: FieldDef): FieldTypeIconKind {
  return fieldDef.custom_field_type ?? fieldDef.field_type;
}

export function FieldTypeIcon({ fieldDef }: { fieldDef: FieldDef }) {
  const kind = fieldTypeIconKind(fieldDef);
  const meta = FIELD_TYPE_ICON_META[kind];
  const Icon = meta.Icon;
  return (
    <span
      aria-hidden="true"
      className="data-table-field-type-icon"
      data-field-type-icon={kind}
      data-testid="data-table-field-type-icon"
      title={`${meta.label} field`}
    >
      <Icon size={14} strokeWidth={2} />
    </span>
  );
}
