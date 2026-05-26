import * as Popover from "@radix-ui/react-popover";
import { useEffect, useMemo, type CSSProperties, type KeyboardEvent } from "react";
import { findFieldOptionByLabel } from "../lib/options/references";
import type { FieldOption } from "../types";

// Popover editor for single-select cells. Owns no domain state — every
// gesture flows back to useGridEdit (draft / highlight / commit / cancel)
// so undo, validation, and option creation all run through the one
// reducer path (PoC L6.1, L6.5).
export type SingleSelectPopoverProps = {
  options: FieldOption[];
  searchText: string;
  highlightedOptionId: string | null;
  onSearchTextChange: (value: string) => void;
  onHighlight: (optionId: string | null) => void;
  onCancel: () => void;
  onCommit: () => void;
  onCommitAndMove: (shiftKey: boolean) => void;
  // The cell this popover is anchored to. Radix wraps the children in
  // Popover.Anchor so the floating content tracks the cell under
  // horizontal scroll.
  anchorChildren: React.ReactNode;
};

export function SingleSelectPopover({
  options,
  searchText,
  highlightedOptionId,
  onSearchTextChange,
  onHighlight,
  onCancel,
  onCommit,
  onCommitAndMove,
  anchorChildren,
}: SingleSelectPopoverProps) {
  const filteredOptions = useMemo(() => filterOptions(options, searchText), [options, searchText]);
  const trimmed = searchText.trim();
  const showCreate = trimmed.length > 0 && !findFieldOptionByLabel(options, trimmed);

  // Targets the keyboard cycles through: each existing option's id,
  // then null when the Create footer is present. Used by Up/Down nav
  // and Tab.
  const cycleTargets = useMemo<(string | null)[]>(() => {
    const targets: (string | null)[] = filteredOptions.map((option) => option.id);
    if (showCreate) targets.push(null);
    return targets;
  }, [filteredOptions, showCreate]);

  // Keep the highlight valid as the filter narrows: if the current
  // target is no longer in the cycle, snap to the first available.
  // Guard against repeated firing when the parent recomputes `options`
  // identity on every render (regression: a fresh [] anchor would loop
  // setState until React threw "Maximum update depth exceeded").
  useEffect(() => {
    if (cycleTargets.length === 0) return;
    const currentValid =
      highlightedOptionId === null ? showCreate : cycleTargets.includes(highlightedOptionId);
    if (currentValid) return;
    const next = cycleTargets[0] ?? null;
    if (next === highlightedOptionId) return;
    onHighlight(next);
  }, [cycleTargets, highlightedOptionId, onHighlight, showCreate]);

  const moveHighlight = (direction: 1 | -1) => {
    if (cycleTargets.length === 0) return;
    const currentIndex = cycleTargets.findIndex((target) => target === highlightedOptionId);
    // -1 means current isn't in the list (e.g. just-filtered-out); start fresh.
    const startIndex = currentIndex >= 0 ? currentIndex : direction === 1 ? -1 : 0;
    const nextIndex = (startIndex + direction + cycleTargets.length) % cycleTargets.length;
    onHighlight(cycleTargets[nextIndex] ?? null);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Always stop propagation so the outer grid keyboard hook does not
    // also act on the same keystroke (PoC L3.3 — explicit z-lanes).
    event.stopPropagation();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      onCommitAndMove(event.shiftKey);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
  };

  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Popover.Anchor asChild>{anchorChildren}</Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          className="single-select-popover"
          side="bottom"
          align="start"
          sideOffset={2}
          onOpenAutoFocus={(event) => {
            // Defer to the input's autoFocus rather than letting Radix
            // focus the content root, which would steal focus from the
            // search box.
            event.preventDefault();
          }}
        >
          <input
            className="single-select-popover-search"
            autoFocus
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Find or create…"
            aria-label="Search options"
          />
          <ul role="listbox" className="single-select-popover-list">
            {filteredOptions.map((option) => (
              <li
                key={option.id}
                role="option"
                aria-selected={highlightedOptionId === option.id}
                className={[
                  "single-select-popover-option",
                  highlightedOptionId === option.id ? "highlighted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => onHighlight(option.id)}
                onMouseDown={(event) => {
                  // Prevent the input from blurring before the click resolves.
                  event.preventDefault();
                }}
                onClick={() => {
                  onHighlight(option.id);
                  onCommit();
                }}
              >
                <span
                  className="single-select-pill"
                  style={{ "--option-color": option.color } as CSSProperties}
                >
                  {option.label}
                </span>
              </li>
            ))}
            {filteredOptions.length === 0 && !showCreate ? (
              <li className="single-select-popover-empty">No matching options.</li>
            ) : null}
            {showCreate ? (
              <li
                role="option"
                aria-selected={highlightedOptionId === null}
                className={[
                  "single-select-popover-create",
                  highlightedOptionId === null ? "highlighted" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onMouseEnter={() => onHighlight(null)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onHighlight(null);
                  onCommit();
                }}
              >
                + Create &ldquo;{trimmed}&rdquo;
              </li>
            ) : null}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function filterOptions(options: FieldOption[], searchText: string): FieldOption[] {
  const needle = searchText.trim().toLocaleLowerCase();
  if (!needle) return options;
  return options.filter((option) => option.label.toLocaleLowerCase().includes(needle));
}
