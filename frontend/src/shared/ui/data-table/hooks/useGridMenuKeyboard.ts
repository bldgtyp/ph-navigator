import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
} from "react";

// Shared focus + arrow-key manager for the data-table popover menus
// (HeaderContextMenu, RowContextMenu). Owns the active-index state and
// the per-render `itemRefs` array; on every `activeIndex` change it
// focuses the matching ref. The hook does NOT own the open/closed
// state or the Radix popover — those stay with the consuming menu so
// each menu controls its own anchor / portal / open behavior.

export type UseGridMenuKeyboardArgs = {
  itemCount: number;
  initialIndex?: number;
};

export type UseGridMenuKeyboardResult = {
  activeIndex: number;
  setActiveIndex: (next: number) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  itemRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  resetToInitial: () => void;
};

export function useGridMenuKeyboard({
  itemCount,
  initialIndex = 0,
}: UseGridMenuKeyboardArgs): UseGridMenuKeyboardResult {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex]);

  const resetToInitial = useCallback(() => {
    setActiveIndex(initialIndex);
    // Active index may already equal initialIndex, in which case the
    // `activeIndex` effect would skip — but the consumer calling this
    // (usually on menu re-open) needs focus to land regardless.
    itemRefs.current[initialIndex]?.focus();
  }, [initialIndex]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (itemCount <= 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((activeIndex + 1) % itemCount);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((activeIndex - 1 + itemCount) % itemCount);
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(itemCount - 1);
      }
    },
    [activeIndex, itemCount],
  );

  return { activeIndex, setActiveIndex, onKeyDown, itemRefs, resetToInitial };
}
