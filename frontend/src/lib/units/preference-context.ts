import { createContext } from "react";
import type { UnitPreferenceSource, UnitSystem } from "./types";

export type UnitPreferenceContextValue = {
  unitSystem: UnitSystem;
  source: UnitPreferenceSource;
  error: string | null;
  setUnitSystem: (next: UnitSystem) => void;
  toggleUnitSystem: () => void;
};

export const UnitPreferenceContext = createContext<UnitPreferenceContextValue | null>(null);
