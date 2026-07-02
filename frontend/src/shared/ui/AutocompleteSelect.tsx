import { ChevronDown } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useOutsidePointerDown } from "./useOutsidePointerDown";

export type AutocompleteSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  color?: string;
  description?: string;
};

export function AutocompleteSelect({
  id,
  label,
  ariaLabel,
  "aria-label": ariaLabelAttribute,
  value,
  options,
  disabled = false,
  placeholder = "Choose...",
  emptyMessage = "No matches",
  className,
  compact = false,
  listboxPlacement = "inline",
  listboxClassName,
  onChange,
  renderOption,
}: {
  id?: string;
  label?: string;
  ariaLabel?: string;
  "aria-label"?: string;
  value: string;
  options: readonly AutocompleteSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  compact?: boolean;
  listboxPlacement?: "inline" | "portal";
  listboxClassName?: string;
  onChange: (value: string) => void;
  renderOption?: (option: AutocompleteSelectOption) => ReactNode;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxRef = useRef<HTMLUListElement | null>(null);
  const effectiveAriaLabel = ariaLabel ?? ariaLabelAttribute;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const selectedLabel = selectedOption?.label ?? "";
  const displayValue = open ? query : selectedLabel;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, options]);
  const firstEnabledIndex = filteredOptions.findIndex((option) => !option.disabled);
  const [highlightedIndex, setHighlightedIndex] = useState(firstEnabledIndex);
  const activeOption = highlightedIndex >= 0 ? filteredOptions[highlightedIndex] : undefined;
  const activeOptionId = activeOption ? `${listboxId}-option-${highlightedIndex}` : undefined;
  const usesPortaledListbox = listboxPlacement === "portal";
  const outsidePointerInsideRefs = useMemo(() => [listboxRef], []);

  useOutsidePointerDown(rootRef, open, closeList, outsidePointerInsideRefs);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(firstEnabledIndex);
  }, [firstEnabledIndex, normalizedQuery, open]);

  const [listboxPosition, setListboxPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: "bottom" | "top";
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !usesPortaledListbox) {
      setListboxPosition(null);
      return;
    }
    let animationFrameIds: number[] = [];
    function updatePosition(): void {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 4;
      const viewportPadding = 12;
      const belowSpace = window.innerHeight - rect.bottom - viewportPadding;
      const aboveSpace = rect.top - viewportPadding;
      const placement: "bottom" | "top" =
        belowSpace >= 220 || belowSpace >= aboveSpace ? "bottom" : "top";
      const availableHeight = Math.max(
        120,
        placement === "bottom" ? belowSpace - gap : aboveSpace - gap,
      );
      const next = {
        top: placement === "bottom" ? rect.bottom + gap : rect.top - gap,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(280, availableHeight),
        placement,
      };
      setListboxPosition((current) =>
        current?.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight &&
        current.placement === next.placement
          ? current
          : next,
      );
    }
    function schedulePositionUpdate(): void {
      const frameId = window.requestAnimationFrame(updatePosition);
      animationFrameIds.push(frameId);
    }
    setListboxPosition(null);
    const secondFrameId = window.requestAnimationFrame(schedulePositionUpdate);
    animationFrameIds.push(secondFrameId);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      for (const frameId of animationFrameIds) {
        window.cancelAnimationFrame(frameId);
      }
      animationFrameIds = [];
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, usesPortaledListbox]);

  function openList() {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setQuery("");
  }

  function commitOption(option: AutocompleteSelectOption | undefined) {
    if (!option || option.disabled) return;
    onChange(option.value);
    closeList();
  }

  function moveHighlight(delta: 1 | -1) {
    if (filteredOptions.length === 0) return;
    let nextIndex = highlightedIndex;
    for (let step = 0; step < filteredOptions.length; step += 1) {
      nextIndex = (nextIndex + delta + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[nextIndex]?.disabled) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      moveHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      moveHighlight(-1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setHighlightedIndex(firstEnabledIndex);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      const lastEnabledIndex = findLastEnabledIndex(filteredOptions);
      setHighlightedIndex(lastEnabledIndex);
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      commitOption(activeOption);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeList();
    }
  }

  const rootClassName = [
    "autocomplete-select",
    compact ? "is-compact" : "",
    disabled ? "is-disabled" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const listboxClassNames = ["autocomplete-select-listbox", listboxClassName ?? ""]
    .filter(Boolean)
    .join(" ");

  const listbox = open ? (
    <ul
      ref={listboxRef}
      className={listboxClassNames}
      id={listboxId}
      role="listbox"
      style={
        usesPortaledListbox
          ? {
              position: "fixed",
              top: listboxPosition?.top ?? 0,
              left: listboxPosition?.left ?? 0,
              width: listboxPosition?.width,
              maxHeight: listboxPosition?.maxHeight,
              right: "auto",
              transform: listboxPosition?.placement === "top" ? "translateY(-100%)" : undefined,
              opacity: listboxPosition ? undefined : 0,
              pointerEvents: listboxPosition ? undefined : "none",
            }
          : undefined
      }
      data-placement={listboxPosition?.placement}
    >
      {filteredOptions.length === 0 ? (
        <li className="autocomplete-select-empty">{emptyMessage}</li>
      ) : (
        filteredOptions.map((option, index) => (
          <li
            key={option.value}
            id={`${listboxId}-option-${index}`}
            role="option"
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            className={index === highlightedIndex ? "is-highlighted" : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setHighlightedIndex(index)}
            onClick={() => commitOption(option)}
          >
            {renderOption ? renderOption(option) : <DefaultOption option={option} />}
          </li>
        ))
      )}
    </ul>
  ) : null;

  return (
    <div className={rootClassName} ref={rootRef} onClick={(event) => event.stopPropagation()}>
      {label ? (
        <label className="autocomplete-select-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className="autocomplete-select-control">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open ? activeOptionId : undefined}
          aria-label={label ? undefined : effectiveAriaLabel}
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={openList}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="autocomplete-select-toggle"
          aria-label={
            (label ?? effectiveAriaLabel)
              ? `${label ?? effectiveAriaLabel} options`
              : "Open options"
          }
          disabled={disabled}
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              closeList();
              return;
            }
            openList();
            inputRef.current?.focus();
          }}
        >
          <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} />
        </button>
      </div>
      {usesPortaledListbox && listbox ? createPortal(listbox, document.body) : listbox}
    </div>
  );
}

function DefaultOption({ option }: { option: AutocompleteSelectOption }) {
  return (
    <span className="autocomplete-select-option">
      {option.color ? (
        <span
          className="autocomplete-select-swatch"
          style={{ "--autocomplete-option-color": option.color } as CSSProperties}
        />
      ) : null}
      <span className="autocomplete-select-option-text">
        <span>{option.label}</span>
        {option.description ? <small>{option.description}</small> : null}
      </span>
    </span>
  );
}

function findLastEnabledIndex(options: readonly AutocompleteSelectOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index;
  }
  return -1;
}
