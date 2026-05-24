// Rightmost tail cell that previews the future "add field" affordance.
// Rendered today but disabled — layout is in place so the eventual
// user-created-fields feature only needs to add behavior.

export type AddFieldTailCellProps = {
  variant: "th" | "td";
};

const ADD_FIELD_LABEL = "Add field — coming soon";

export function AddFieldTailCell({ variant }: AddFieldTailCellProps) {
  if (variant === "th") {
    return (
      <th
        scope="col"
        aria-disabled="true"
        aria-label={ADD_FIELD_LABEL}
        className="data-table-add-field-cell"
        data-add-field-cell="th"
      >
        <span aria-hidden className="data-table-add-field-glyph">
          +
        </span>
      </th>
    );
  }
  return (
    <td
      aria-hidden
      className="data-table-add-field-cell data-table-add-field-cell-body"
      data-add-field-cell="td"
    />
  );
}
