// Pointer-drag tuning constants shared by `useGridPointerDrag` (cell /
// column range drag, Phase 3) and `useGridFill` (Phase 7 fill drag).
// Both hooks run independently but use identical autoscroll edge / step
// numbers; the axis threshold is fill-only but lives here to keep all
// pointer-drag numerics in one file.

// Distance from the container edge at which auto-scroll kicks in.
export const EDGE_PX = 30;

// Pixels per animation frame scrolled while the pointer sits in the edge
// band.
export const SCROLL_PX = 12;

// Minimum pointer-delta on one axis before fill commits to that axis.
// Below the threshold the hook leaves the axis unlocked.
export const AXIS_THRESHOLD = 8;
