// Seven common operation patterns from PRD §11.3. The preset menu
// dispatches the preset's ``payload`` through ``setElementOperation``;
// the user can still tweak type / directions after picking a preset.
//
// ``id`` is stable across sessions so a future "favorites" or
// per-project default list can reference presets without depending on
// label text.

import type { ApertureOperationDirection } from "./types";

export type OperationPresetPayload = {
  type: "swing" | "slide";
  directions: ApertureOperationDirection[];
};

export type OperationPreset = {
  id: string;
  label: string;
  payload: OperationPresetPayload;
};

export const OPERATION_PRESETS: OperationPreset[] = [
  { id: "tilt-turn", label: "Tilt-Turn", payload: { type: "swing", directions: ["left", "up"] } },
  { id: "awning", label: "Awning", payload: { type: "swing", directions: ["up"] } },
  { id: "hopper", label: "Hopper", payload: { type: "swing", directions: ["down"] } },
  {
    id: "casement-left",
    label: "Casement, hinge left",
    payload: { type: "swing", directions: ["left"] },
  },
  {
    id: "casement-right",
    label: "Casement, hinge right",
    payload: { type: "swing", directions: ["right"] },
  },
  {
    id: "slider-left",
    label: "Slider, opens left",
    payload: { type: "slide", directions: ["left"] },
  },
  {
    id: "slider-right",
    label: "Slider, opens right",
    payload: { type: "slide", directions: ["right"] },
  },
];
