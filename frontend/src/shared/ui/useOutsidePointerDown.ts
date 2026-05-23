import { useEffect, type RefObject } from "react";

export function useOutsidePointerDown<T extends HTMLElement>(
  ref: RefObject<T | null>,
  active: boolean,
  onOutsidePointerDown: () => void,
) {
  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || ref.current?.contains(target)) return;
      onOutsidePointerDown();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, onOutsidePointerDown, ref]);
}
