import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

// Phase 4 §4.7: toolbar overflow menu, rightmost of the axis-button
// cluster. Owns the Reset view action today; forward-compat slot for
// Phase 6 (group / collapse-all / expand-all) and future column-config
// actions. Surface = Radix Popover (matches the Filter / Sort
// popovers' shadow + border-radius per §12 Q4 resolution).
export type ViewMenuOverflowProps = {
  // Phase 4: Reset clears only filter + sort (the keys Phase 4 owns).
  // Group / column-order / aggregation / hidden columns are explicitly
  // out of scope per §4.7.
  onReset: () => void;
  // Disable Reset when there is nothing to clear (both stacks empty).
  // Keeps the menu honest and prevents a no-op onViewChange.
  canReset: boolean;
  // Download a CSV of the current view. REQUIRED (not optional): this is a
  // parent-owned, every-table affordance (the DataTable uniformity
  // iron-law), so it can never be silently dropped per-table. Pinned by
  // scripts/check-data-table-contract.mjs.
  onDownloadCsv: () => void;
  // Whether the Download CSV item is visible. A CSV export is a bulk export →
  // editor/certifier-only (CP-7), hidden from `client` viewers. The handler
  // stays REQUIRED/wired (the iron-law); only its visibility is access-gated.
  // When shown it is always enabled — a read action valid on an empty table.
  canDownloadCsv: boolean;
  actions?: ReactNode;
};

export function ViewMenuOverflow({
  onReset,
  canReset,
  onDownloadCsv,
  canDownloadCsv,
  actions,
}: ViewMenuOverflowProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="data-table-toolbar-button data-table-toolbar-button--icon"
          aria-label="More view actions"
        >
          <MoreVertical size={18} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-overflow-menu"
          align="end"
          sideOffset={6}
          aria-label="View actions"
        >
          {actions}
          {canDownloadCsv ? (
            <button
              type="button"
              className="data-table-overflow-menu-item"
              onClick={() => {
                onDownloadCsv();
                setOpen(false);
              }}
            >
              Download CSV
            </button>
          ) : null}
          <button
            type="button"
            className="data-table-overflow-menu-item"
            onClick={() => {
              if (!canReset) return;
              onReset();
              setOpen(false);
            }}
            disabled={!canReset}
          >
            Reset view
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
