import { useEffect, type RefObject } from "react";

type OutsidePointerDownRef = RefObject<Element | null>;

export function useOutsidePointerDown(
  ref: OutsidePointerDownRef,
  active: boolean,
  onOutsidePointerDown: () => void,
  additionalInsideRefs: readonly OutsidePointerDownRef[] = [],
) {
  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        ref.current?.contains(target) ||
        additionalInsideRefs.some((insideRef) => insideRef.current?.contains(target))
      ) {
        return;
      }
      onOutsidePointerDown();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, additionalInsideRefs, onOutsidePointerDown, ref]);
}
