import { useCallback, useState, type SetStateAction } from "react";

let sessionZoom: number | null = null;

export function useEnvelopeCanvasZoom() {
  const hasSessionZoom = sessionZoom !== null;
  const [zoom, setZoomState] = useState(() => sessionZoom ?? 1);

  const setZoom = useCallback((next: SetStateAction<number>) => {
    setZoomState((current) => {
      const nextZoom = typeof next === "function" ? next(current) : next;
      sessionZoom = nextZoom;
      return current === nextZoom ? current : nextZoom;
    });
  }, []);

  return { zoom, setZoom, hasSessionZoom };
}

export function resetEnvelopeCanvasZoomForTests(): void {
  sessionZoom = null;
}
