import { useMemo, type RefObject } from "react";

// Radix `Popover.Anchor` accepts a `virtualRef` that must point at a
// `getBoundingClientRect`-providing object. Both shapes here let popovers
// position against a pointer location or a real DOM element without
// rendering a dedicated anchor node.

type VirtualAnchor = { getBoundingClientRect: () => DOMRect };
type VirtualAnchorRef = RefObject<VirtualAnchor>;

export function pointAnchorRef(x: number, y: number): VirtualAnchorRef {
  return {
    current: {
      getBoundingClientRect: () =>
        ({
          x,
          y,
          top: y,
          left: x,
          right: x,
          bottom: y,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    },
  };
}

export function useElementAnchorRef(element: HTMLElement | null): VirtualAnchorRef | null {
  return useMemo(
    () =>
      element
        ? { current: { getBoundingClientRect: () => element.getBoundingClientRect() } }
        : null,
    [element],
  );
}
