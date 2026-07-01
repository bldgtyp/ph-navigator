import { create } from "zustand";

/**
 * Render knobs for the viewer's "solid study-model" look (rendering-style
 * refactor, `planning/refactor/model-viewer-rendering-style/`). The defaults
 * below ARE the shipped look — soft key+fill lighting + ambient occlusion, tuned
 * with Ed on 2026-06-30. The dev-only render-controls panel and the Playwright
 * perf harness flip them to keep tuning; the full stack is ~free on Hillandale
 * (see `working/perf-knobs.json`).
 */
export type ViewerRenderSettings = {
  /** Ambient occlusion (N8AO post pass) — the #1 "solid model" lever. */
  ao: boolean;
  /** N8AO darkening strength. */
  aoIntensity: number;
  /** N8AO sampling radius, world units (metres, Z-up model). */
  aoRadius: number;
  /** Render AO at half resolution — large perf win, usually invisible. */
  aoHalfRes: boolean;
  /** N8AO quality tier — the main perf lever when AO is too slow. */
  aoQuality: "performance" | "low" | "medium" | "high";
  /** Soft key+fill lighting (bright directional key + hemisphere fill + cool
   *  background) vs today's flat hard key + flat ambient. The key is what makes
   *  sunlit faces pop to white while shadowed faces stay grey (the Spacio look).*/
  softLighting: boolean;
  /** Directional key intensity under soft lighting — pushes lit faces to white. */
  keyIntensity: number;
  /** Hemisphere fill intensity under soft lighting — keeps shadowed faces grey,
   *  not black. Key >> fill gives the crisp white-vs-grey range. */
  fillIntensity: number;
  /** Key-light elevation, degrees above the horizon (90 = straight overhead,
   *  ~45 = a raking 3/4 sun that lights some walls directly). */
  keyElevation: number;
  /** Key-light azimuth, degrees (compass bearing of the sun around the model). */
  keyAzimuth: number;
};

export const DEFAULT_RENDER_SETTINGS: ViewerRenderSettings = {
  ao: true,
  aoIntensity: 3,
  aoRadius: 2.5,
  aoHalfRes: true,
  aoQuality: "medium",
  softLighting: true,
  keyIntensity: 3.4,
  fillIntensity: 1.4,
  keyElevation: 45,
  keyAzimuth: 264,
};

type RenderSettingsStore = ViewerRenderSettings & {
  set: (patch: Partial<ViewerRenderSettings>) => void;
};

/**
 * Render-knob store, separate from the main viewer store so toggling a knob
 * never churns selection/lens/theme state.
 */
export const useViewerRenderSettings = create<RenderSettingsStore>((set) => ({
  ...DEFAULT_RENDER_SETTINGS,
  set: (patch) => set(patch),
}));

declare global {
  interface Window {
    /**
     * Dev-only handle for the perf harness to flip render knobs between orbits
     * (e.g. `__phnViewerRender.set({ ao: true })`). Installed/torn down by
     * {@link ViewerRenderControls}, which only mounts when the debug hook is on.
     */
    __phnViewerRender?: {
      get: () => ViewerRenderSettings;
      set: (patch: Partial<ViewerRenderSettings>) => void;
    };
  }
}

/** Install the dev `window.__phnViewerRender` mirror; returns an uninstaller. */
export function installRenderSettingsWindowMirror(): () => void {
  window.__phnViewerRender = {
    // Current knob snapshot. The store's `set` method rides along harmlessly (the
    // harness reads knob fields); this auto-stays in sync as knobs are added.
    get: () => useViewerRenderSettings.getState(),
    set: (patch) => useViewerRenderSettings.getState().set(patch),
  };
  return () => {
    delete window.__phnViewerRender;
  };
}
