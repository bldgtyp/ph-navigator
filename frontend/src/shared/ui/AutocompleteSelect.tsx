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
  onChange: (value: string) => void;
  renderOption?: (option: AutocompleteSelectOption) => ReactNode;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
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

  useOutsidePointerDown(rootRef, open, () => {
    setOpen(false);
    setQuery("");
  });

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(firstEnabledIndex);
  }, [firstEnabledIndex, normalizedQuery, open]);

  const [listboxPosition, setListboxPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setListboxPosition(null);
      return;
    }
    function updatePosition(): void {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setListboxPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

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
      {open ? (
        <ul
          className="autocomplete-select-listbox"
          id={listboxId}
          role="listbox"
          style={
            listboxPosition
              ? {
                  position: "fixed",
                  top: listboxPosition.top,
                  left: listboxPosition.left,
                  width: listboxPosition.width,
                  right: "auto",
                }
              : undefined
          }
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
      ) : null}
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
