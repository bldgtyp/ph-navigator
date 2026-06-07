// Pure state-machine for the Eyedropper / Paint-bucket flow. Lives
// outside React so it can be tested independently of the Zustand
// store; the store calls ``nextMode`` to compute the new mode and
// updates ``pickedAssignment`` in the same set().
//
// Transitions:
//
//   idle    + click-eyedropper  → picking
//   picking + click-element     → picked
//   picked  + click-paint-bucket → pasting
//   pasting + click-element     → pasting   (stay; rapid fire)
//   (any non-idle) + esc        → idle
//   (any non-idle) + click-bg   → idle
//   (any non-idle) + clear      → idle

export type PickPasteMode = "idle" | "picking" | "picked" | "pasting";

export type PickPasteAction =
  | { type: "click-eyedropper" }
  | { type: "click-paint-bucket" }
  | { type: "click-element" }
  | { type: "click-background" }
  | { type: "esc" }
  | { type: "clear" };

export function nextMode(current: PickPasteMode, action: PickPasteAction): PickPasteMode {
  if (action.type === "esc" || action.type === "clear") return "idle";
  if (action.type === "click-background") return "idle";

  switch (current) {
    case "idle":
      return action.type === "click-eyedropper" ? "picking" : "idle";
    case "picking":
      if (action.type === "click-element") return "picked";
      if (action.type === "click-eyedropper") return "picking";
      return "picking";
    case "picked":
      if (action.type === "click-paint-bucket") return "pasting";
      if (action.type === "click-eyedropper") return "picking";
      return "picked";
    case "pasting":
      if (action.type === "click-element") return "pasting";
      if (action.type === "click-eyedropper") return "picking";
      if (action.type === "click-paint-bucket") return "pasting";
      return "pasting";
  }
}
