import { useCallback, useEffect, useRef, useState } from "react";

export const FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY = "phn.apertures.frame_picker_filters.v1";

export type FramePickerFilterPreferences = {
  filterFramesBySide: boolean;
  filterFramesByOperation: boolean;
};

export type FramePickerFilterPreferencesState = FramePickerFilterPreferences & {
  setFilterFramesBySide: (enabled: boolean) => void;
  setFilterFramesByOperation: (enabled: boolean) => void;
};

const DEFAULT_FRAME_PICKER_FILTER_PREFERENCES: FramePickerFilterPreferences = {
  filterFramesBySide: true,
  filterFramesByOperation: false,
};

function hasStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizePreferences(value: unknown): FramePickerFilterPreferences {
  if (!value || typeof value !== "object") return DEFAULT_FRAME_PICKER_FILTER_PREFERENCES;
  const candidate = value as Partial<Record<keyof FramePickerFilterPreferences, unknown>>;
  return {
    filterFramesBySide:
      typeof candidate.filterFramesBySide === "boolean"
        ? candidate.filterFramesBySide
        : DEFAULT_FRAME_PICKER_FILTER_PREFERENCES.filterFramesBySide,
    filterFramesByOperation:
      typeof candidate.filterFramesByOperation === "boolean"
        ? candidate.filterFramesByOperation
        : DEFAULT_FRAME_PICKER_FILTER_PREFERENCES.filterFramesByOperation,
  };
}

function readStoredEnvelope(): Record<string, FramePickerFilterPreferences> {
  if (!hasStorage()) return {};
  const raw = window.localStorage.getItem(FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([projectId, value]) => [projectId, normalizePreferences(value)]),
    );
  } catch {
    return {};
  }
}

function readProjectPreferences(
  projectId: string | null | undefined,
): FramePickerFilterPreferences {
  if (!projectId) return DEFAULT_FRAME_PICKER_FILTER_PREFERENCES;
  return readStoredEnvelope()[projectId] ?? DEFAULT_FRAME_PICKER_FILTER_PREFERENCES;
}

function writeProjectPreferences(
  projectId: string | null | undefined,
  preferences: FramePickerFilterPreferences,
) {
  if (!projectId || !hasStorage()) return;
  const envelope = readStoredEnvelope();
  envelope[projectId] = preferences;
  window.localStorage.setItem(
    FRAME_PICKER_FILTER_PREFERENCES_STORAGE_KEY,
    JSON.stringify(envelope),
  );
}

function preferencesEqual(
  left: FramePickerFilterPreferences,
  right: FramePickerFilterPreferences,
): boolean {
  return (
    left.filterFramesBySide === right.filterFramesBySide &&
    left.filterFramesByOperation === right.filterFramesByOperation
  );
}

export function useFramePickerFilterPreferences(
  projectId: string | null | undefined,
): FramePickerFilterPreferencesState {
  const [preferences, setPreferences] = useState<FramePickerFilterPreferences>(() =>
    readProjectPreferences(projectId),
  );
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    const stored = readProjectPreferences(projectId);
    preferencesRef.current = stored;
    setPreferences(stored);
  }, [projectId]);

  const updatePreferences = useCallback(
    (next: Partial<FramePickerFilterPreferences>) => {
      const current = preferencesRef.current;
      const updated = { ...current, ...next };
      if (preferencesEqual(current, updated)) return;
      preferencesRef.current = updated;
      writeProjectPreferences(projectId, updated);
      setPreferences(updated);
    },
    [projectId],
  );

  const setFilterFramesBySide = useCallback(
    (enabled: boolean) => updatePreferences({ filterFramesBySide: enabled }),
    [updatePreferences],
  );

  const setFilterFramesByOperation = useCallback(
    (enabled: boolean) => updatePreferences({ filterFramesByOperation: enabled }),
    [updatePreferences],
  );

  return {
    ...preferences,
    setFilterFramesBySide,
    setFilterFramesByOperation,
  };
}
