// Rightmost tail cell. The `th` variant exposes either a disabled
// "coming soon" preview (no callback) or a focusable button that opens
// the add-field popover when `onClick` is provided (plan-15 P2.6). The
// `td` variant is always inert — it only exists to keep the column
// alignment consistent across body / group / summary rows. Viewer mode
// is handled at the consumer: it omits `onClick` and renders the same
// disabled glyph the original Phase 0 layout previewed.
import { forwardRef } from "react";

export type AddFieldTailCellProps = {
  variant: "th" | "td";
  onClick?: () => void;
};

const ADD_FIELD_LABEL_DISABLED = "Add field — coming soon";
const ADD_FIELD_LABEL_ACTIVE = "Add field";

export const AddFieldTailCell = forwardRef<HTMLTableCellElement, AddFieldTailCellProps>(
  function AddFieldTailCell({ variant, onClick }, ref) {
    if (variant === "td") {
      return (
        <td
          aria-hidden
          className="data-table-add-field-cell data-table-add-field-cell-body"
          data-add-field-cell="td"
        />
      );
    }
    if (onClick) {
      return (
        <th
          ref={ref}
          scope="col"
          className="data-table-add-field-cell"
          data-add-field-cell="th"
          data-add-field-active="true"
        >
          <button
            type="button"
            className="data-table-add-field-button"
            aria-label={ADD_FIELD_LABEL_ACTIVE}
            onClick={onClick}
          >
            <span aria-hidden className="data-table-add-field-glyph">
              +
            </span>
          </button>
        </th>
      );
    }
    return (
      <th
        ref={ref}
        scope="col"
        aria-disabled="true"
        aria-label={ADD_FIELD_LABEL_DISABLED}
        className="data-table-add-field-cell"
        data-add-field-cell="th"
      >
        <span aria-hidden className="data-table-add-field-glyph">
          +
        </span>
      </th>
    );
  },
);
