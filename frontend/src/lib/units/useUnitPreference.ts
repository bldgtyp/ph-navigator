import { useContext } from "react";
import { UnitPreferenceContext } from "./preference-context";

export function useUnitPreference() {
  const context = useContext(UnitPreferenceContext);
  if (!context) {
    throw new Error("useUnitPreference must be used inside UnitPreferenceProvider");
  }
  return context;
}
