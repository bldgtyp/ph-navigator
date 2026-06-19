import { create } from "zustand";

/**
 * A single rendered-frame readout of the renderer's cost. Sourced from
 * `THREE.WebGLRenderer.info` plus a derived frame-time/FPS. This is the
 * Phase-00 evidence surface for the model-viewer performance refactor: `calls`
 * is the headline draw-call metric (PRD §7 A1), `programs` approximates the
 * live material/shader buckets (A3), and `fps`/`frameMs` track interaction
 * smoothness (A2).
 */
export type ModelViewerPerfSample = {
  /** `renderer.info.render.calls` — draw calls for the last rendered frame. */
  calls: number;
  /** `renderer.info.render.triangles` — triangles drawn last frame. */
  triangles: number;
  /** `renderer.info.memory.geometries` — live GPU geometries. */
  geometries: number;
  /** `renderer.info.memory.textures` — live GPU textures. */
  textures: number;
  /** Compiled shader programs (≈ distinct material/shader buckets). */
  programs: number;
  /** Smoothed frame time in ms, sampled only on rendered frames. */
  frameMs: number;
  /** Frames per second derived from `frameMs`. */
  fps: number;
};

export const EMPTY_PERF_SAMPLE: ModelViewerPerfSample = {
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  frameMs: 0,
  fps: 0,
};

declare global {
  interface Window {
    /**
     * Live perf readout for Playwright MCP capture during a scripted orbit.
     * Mounted/torn down by {@link ModelViewerPerfProbe}, which only runs when
     * the debug hook is enabled (dev/test). The probe mutates this object in
     * place each frame; see the Phase-00 runbook in
     * `planning/refactor/model-viewer-performance/`.
     */
    __phnModelViewerPerf?: ModelViewerPerfSample;
  }
}

type PerfStore = {
  sample: ModelViewerPerfSample;
  setSample: (sample: ModelViewerPerfSample) => void;
  /** Whether the dev perf overlay is shown. Hidden by default; toggled from the
   *  dev button beside the scene-info button. */
  overlayVisible: boolean;
  toggleOverlay: () => void;
};

/**
 * Holds the most recent perf sample for the dev overlay. Kept separate from the
 * main viewer store so high-frequency frame updates never churn viewer state.
 */
export const useModelViewerPerfStore = create<PerfStore>((set) => ({
  sample: EMPTY_PERF_SAMPLE,
  setSample: (sample) => set({ sample }),
  overlayVisible: false,
  toggleOverlay: () => set((state) => ({ overlayVisible: !state.overlayVisible })),
}));
