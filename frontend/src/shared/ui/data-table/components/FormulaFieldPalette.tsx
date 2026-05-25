import type { FieldFormulaType } from "../lib/formula";

export type FormulaFieldPaletteEntry = {
  field_id: string;
  display_name: string;
  field_type: FieldFormulaType;
};

export type FormulaFieldPaletteProps = {
  entries: ReadonlyArray<FormulaFieldPaletteEntry>;
  disabled?: boolean;
  onInsert: (token: string) => void;
};

const FIELD_TYPE_LABEL: Record<FieldFormulaType, string> = {
  text: "Text column",
  number: "Number column",
  single_select: "Single-select column",
  formula: "Formula column",
  bool: "Boolean column",
};

export function FormulaFieldPalette({
  entries,
  disabled = false,
  onInsert,
}: FormulaFieldPaletteProps) {
  if (entries.length === 0) {
    return (
      <div className="formula-field-palette formula-field-palette-empty" aria-live="polite">
        No fields available to reference.
      </div>
    );
  }
  return (
    <div
      className="formula-field-palette"
      role="group"
      aria-label="Insert field reference"
    >
      {entries.map((entry) => {
        const token = `{${entry.display_name}}`;
        const a11yLabel = `${FIELD_TYPE_LABEL[entry.field_type]} ${entry.display_name}`;
        return (
          <button
            key={entry.field_id}
            type="button"
            className="formula-field-palette-chip"
            data-field-type={entry.field_type}
            aria-label={a11yLabel}
            disabled={disabled}
            // Keep focus on the source input so the caret position is
            // preserved when the click handler inserts at the cursor.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(token)}
          >
            {entry.display_name}
          </button>
        );
      })}
    </div>
  );
}
