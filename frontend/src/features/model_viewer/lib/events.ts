import { useEffect } from "react";

export const MODEL_VIEWER_ESCAPE_POPOVERS_EVENT = "phn:model-viewer:escape-popovers";

export function dispatchModelViewerPopoverEscape(): void {
  window.dispatchEvent(new Event(MODEL_VIEWER_ESCAPE_POPOVERS_EVENT));
}

export function useModelViewerPopoverEscape(close: () => void): void {
  useEffect(() => {
    window.addEventListener(MODEL_VIEWER_ESCAPE_POPOVERS_EVENT, close);
    return () => window.removeEventListener(MODEL_VIEWER_ESCAPE_POPOVERS_EVENT, close);
  }, [close]);
}
