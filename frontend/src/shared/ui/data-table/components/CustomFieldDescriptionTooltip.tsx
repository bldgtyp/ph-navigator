import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";

// Reuses `@radix-ui/react-popover` (already in the bundle for
// `ColumnHeaderMenu`) rather than pulling in `@radix-ui/react-tooltip`.
// Opens on hover or keyboard focus so the description is reachable
// without a mouse.

export type CustomFieldDescriptionTooltipProps = {
  description: string;
  fieldDisplayName: string;
};

export function CustomFieldDescriptionTooltip({
  description,
  fieldDisplayName,
}: CustomFieldDescriptionTooltipProps) {
  const [open, setOpen] = useState(false);
  const trimmed = description.trim();
  if (!trimmed) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="data-table-header-description-trigger"
          aria-label={`Description for ${fieldDisplayName}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          ?
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="data-table-header-description-tooltip"
          side="bottom"
          align="start"
          sideOffset={4}
          role="tooltip"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {trimmed}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
