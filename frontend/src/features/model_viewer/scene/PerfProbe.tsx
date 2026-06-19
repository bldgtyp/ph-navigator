import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { EMPTY_PERF_SAMPLE, useModelViewerPerfStore } from "../lib/perf";

/** Throttle React store writes to ~5 Hz; the window mirror updates every frame. */
const STORE_UPDATE_INTERVAL_MS = 200;

/** Weight of the newest frame in the frame-time moving average (lower = smoother). */
const FRAME_MS_EMA_WEIGHT = 0.2;

/**
 * Dev-only, render-nothing probe that reads `gl.info` once per rendered frame
 * and publishes it for the overlay + Playwright capture. Mount inside `<Canvas>`
 * (it needs `useThree`); gate the mount on `isModelViewerDebugHookEnabled()`.
 *
 * We turn off R3F's per-`gl.render` `autoReset` and reset `gl.info` ourselves
 * once per frame. Without this, a multi-pass `EffectComposer` resets the
 * counters between passes, so `render.calls` reads only the final pass (≈ 1)
 * instead of the whole frame. Reading-then-resetting in `useFrame` (which runs
 * before this frame's render) yields the *previous* frame's accumulated totals
 * across every pass. With `frameloop="demand"` this only ticks while the scene
 * is actually rendering, so capture during an active orbit per the runbook.
 *
 * Hot-path discipline (PRD §7 A6 / G4): the per-frame path allocates nothing.
 * One mutable sample object is reused — the `window` mirror points at it, so it
 * updates in place — and a fresh copy is allocated only on the throttled store
 * write (zustand needs a new reference to detect the change).
 */
export function ModelViewerPerfProbe() {
  const gl = useThree((state) => state.gl);
  const sample = useRef({ ...EMPTY_PERF_SAMPLE });
  const lastFrameTime = useRef<number | null>(null);
  const emaFrameMs = useRef(0);
  const lastStoreUpdate = useRef(0);

  // Own the dev-only window mirror for the probe's lifetime. The probe only
  // mounts when the debug hook is enabled, so this never runs in production.
  useEffect(() => {
    const info = gl.info;
    const previousAutoReset = info.autoReset;
    info.autoReset = false;
    window.__phnModelViewerPerf = sample.current;
    return () => {
      info.autoReset = previousAutoReset;
      delete window.__phnModelViewerPerf;
    };
  }, [gl]);

  useFrame(() => {
    const now = performance.now();
    const previous = lastFrameTime.current;
    lastFrameTime.current = now;

    if (previous !== null) {
      const delta = now - previous;
      emaFrameMs.current =
        emaFrameMs.current === 0
          ? delta
          : emaFrameMs.current * (1 - FRAME_MS_EMA_WEIGHT) + delta * FRAME_MS_EMA_WEIGHT;
    }

    const info = gl.info;
    const frameMs = emaFrameMs.current;
    const next = sample.current;
    next.calls = info.render.calls;
    next.triangles = info.render.triangles;
    next.geometries = info.memory.geometries;
    next.textures = info.memory.textures;
    next.programs = info.programs?.length ?? 0;
    next.frameMs = frameMs;
    next.fps = frameMs > 0 ? 1000 / frameMs : 0;

    if (now - lastStoreUpdate.current >= STORE_UPDATE_INTERVAL_MS) {
      lastStoreUpdate.current = now;
      useModelViewerPerfStore.getState().setSample({ ...next });
    }

    // Reset now (autoReset is off) so the upcoming frame's passes accumulate
    // cleanly into the counters we read on the next tick.
    info.reset();
  });

  return null;
}
