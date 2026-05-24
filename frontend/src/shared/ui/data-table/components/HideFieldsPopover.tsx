import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import {
  HideFieldsPanel,
  type HideFieldsColumn,
  type HideFieldsPanelChange,
} from "./HideFieldsPanel";
import type { FieldDef } from "../types";

// Trigger-prop wrapper matching the FilterPopover / SortPopover /
// GroupPopover shape so GridToolbar composes all four axis buttons the
// same way.
export type HideFieldsPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  orderedColumns: HideFieldsColumn[];
  fieldDefByKey: Map<string, FieldDef>;
  hiddenColumns: string[];
  onChange: (next: HideFieldsPanelChange) => void;
};

export function HideFieldsPopover({
  open,
  onOpenChange,
  trigger,
  orderedColumns,
  fieldDefByKey,
  hiddenColumns,
  onChange,
}: HideFieldsPopoverProps) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="data-table-hide-fields-popover">
          <HideFieldsPanel
            orderedColumns={orderedColumns}
            fieldDefByKey={fieldDefByKey}
            hiddenColumns={hiddenColumns}
            onChange={onChange}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
