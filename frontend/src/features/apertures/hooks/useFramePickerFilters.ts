import { createContext, useContext } from "react";
import {
  DEFAULT_FRAME_PICKER_FILTER_PREFERENCES,
  type FramePickerFilterPreferences,
} from "./useFramePickerFilterPreferences";

export type FramePickerFilterContextValue = FramePickerFilterPreferences;

const FramePickerFilterContext = createContext<FramePickerFilterContextValue | undefined>(
  undefined,
);

export const FramePickerFilterProvider = FramePickerFilterContext.Provider;

export function useFramePickerFilters(): FramePickerFilterContextValue {
  return useContext(FramePickerFilterContext) ?? DEFAULT_FRAME_PICKER_FILTER_PREFERENCES;
}
