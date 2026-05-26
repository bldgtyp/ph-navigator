import type { FieldOption } from "../../types";

// Reindexes options' `order` to 0..N-1 in current array order and trims
// their labels. Used after every drag-reorder save to keep the order
// ints contiguous.
export function normalizeOptionOrders(options: readonly FieldOption[]): FieldOption[] {
  return options.map((option, index) => ({
    ...option,
    label: option.label.trim(),
    order: index,
  }));
}
