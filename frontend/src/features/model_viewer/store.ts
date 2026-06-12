import { create } from "zustand";

/**
 * Cross-component viewer state. Phase 1 holds only the active file id
 * (synced from the `?file=` URL param by ModelTab); later phases extend
 * this with lens, theme, selection, and measure state.
 */
type ModelViewerState = {
  activeFileId: string | null;
  setActiveFileId: (fileId: string | null) => void;
};

export const useModelViewerStore = create<ModelViewerState>()((set) => ({
  activeFileId: null,
  setActiveFileId: (fileId) => set({ activeFileId: fileId }),
}));
