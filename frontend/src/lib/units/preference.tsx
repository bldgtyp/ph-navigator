import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSessionQuery, useUpdateUnitsPreferenceMutation } from "../../features/auth/hooks";
import { isAuthFailure } from "../../features/auth/lib";
import { UnitPreferenceContext } from "./preference-context";
import type { UnitPreferenceSource, UnitSystem } from "./types";

const STORAGE_KEY = "phn.units_preference";

export function UnitPreferenceProvider({ children }: { children: ReactNode }) {
  const sessionQuery = useSessionQuery();
  const updateMutation = useUpdateUnitsPreferenceMutation();
  const lastConfirmedServerValue = useRef<UnitSystem | null>(null);
  const [initialPreference] = useState(readInitialPreference);
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(initialPreference.unitSystem);
  const [source, setSource] = useState<UnitPreferenceSource>(initialPreference.source);
  const [error, setError] = useState<string | null>(null);
  const sessionUnits = sessionQuery.data?.user.units_preference;
  const isAuthenticated = Boolean(sessionQuery.data);

  useEffect(() => {
    if (!sessionUnits) return;
    lastConfirmedServerValue.current = sessionUnits;
    setUnitSystemState(sessionUnits);
    setSource("server");
    setError(null);
  }, [sessionUnits]);

  const setUnitSystem = useCallback(
    (next: UnitSystem) => {
      const serverAlreadyMatches =
        lastConfirmedServerValue.current === next || sessionUnits === next;
      if (next === unitSystem && error === null && (!isAuthenticated || serverAlreadyMatches)) {
        return;
      }

      setError(null);
      setUnitSystemState(next);
      writeStoredPreference(next);

      if (!isAuthenticated) {
        setSource("local");
        return;
      }

      setSource("server");
      updateMutation.mutate(next, {
        onSuccess: (session) => {
          lastConfirmedServerValue.current = session.user.units_preference;
          setUnitSystemState(session.user.units_preference);
          writeStoredPreference(session.user.units_preference);
          setSource("server");
        },
        onError: (mutationError) => {
          const fallback =
            lastConfirmedServerValue.current ?? sessionUnits ?? readInitialPreference().unitSystem;
          setUnitSystemState(fallback);
          writeStoredPreference(fallback);
          setSource("server");
          setError(
            isAuthFailure(mutationError)
              ? "Sign in again to save units."
              : "Could not save units preference.",
          );
        },
      });
    },
    [error, isAuthenticated, sessionUnits, unitSystem, updateMutation],
  );

  const toggleUnitSystem = useCallback(() => {
    setUnitSystem(unitSystem === "SI" ? "IP" : "SI");
  }, [setUnitSystem, unitSystem]);

  const value = useMemo(
    () => ({ unitSystem, source, error, setUnitSystem, toggleUnitSystem }),
    [error, setUnitSystem, source, toggleUnitSystem, unitSystem],
  );

  return <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>;
}

function readInitialPreference(): { unitSystem: UnitSystem; source: UnitPreferenceSource } {
  if (typeof window === "undefined") return { unitSystem: "SI", source: "default" };
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "IP" || stored === "SI") {
    return { unitSystem: stored, source: "local" };
  }
  return { unitSystem: "SI", source: "default" };
}

function writeStoredPreference(value: UnitSystem): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value);
}
