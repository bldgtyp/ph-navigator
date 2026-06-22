import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useUnitPreference, type UnitSystem } from "../../lib/units";
import { parseNumberInput } from "../../lib/units/format";
import { climateQueryKeys } from "../climate/query-keys";
import {
  useParseProjectLocationEpwMutation,
  useDeriveProjectLocationMutation,
  useGeocodeProjectLocationMutation,
  useLookupElevationMutation,
  useProjectLocationQuery,
  useUpdateProjectLocationMutation,
} from "./hooks";
import {
  applyGeocodeCandidateToLocationValues,
  applyEpwSuggestionToLocationValues,
  buildProjectLocationDerivePayload,
  buildProjectLocationPayload,
  elevationCoordsKey,
  elevationInputFromMeters,
  elevationSourceLabel,
  emptyLocationFormValues,
  locationFormValuesFromLocation,
  reformatElevationForUnitSystem,
  type ProjectLocationFormValues,
} from "./location-form";
import type { EpwParseResponse, GeocodeProjectLocationResponse, ProjectLocation } from "./types";

// Debounce for the coordinate-driven elevation auto-fill so direct lat/long
// typing fires one lookup once the value settles, not one per keystroke.
const AUTO_ELEVATION_DEBOUNCE_MS = 500;
const COULD_NOT_DETECT_MESSAGE = "Couldn't auto-detect elevation — enter it manually.";

export type ProjectLocationFormController = {
  location: ProjectLocation | undefined;
  values: ProjectLocationFormValues;
  unitSystem: UnitSystem;
  warnings: string[];
  isLoading: boolean;
  loadError: Error | null;
  validationError: string | null;
  isDirty: boolean;
  isSaving: boolean;
  canSave: boolean;
  saveError: Error | null;
  isDeriving: boolean;
  isGeocoding: boolean;
  isParsingEpw: boolean;
  // True while a coordinate-driven elevation lookup is in flight.
  isLookingUpElevation: boolean;
  // Provider label for the last auto-filled elevation ("USGS 3DEP" / "Open-Meteo");
  // null when the field is empty, manually entered, or freshly loaded from the server.
  elevationSource: string | null;
  // Set when an auto-fill could not resolve elevation, prompting manual entry.
  elevationNote: string | null;
  // True once the user hand-edits elevation: auto-fill stops clobbering it until reset.
  elevationOverridden: boolean;
  updateField: (field: keyof ProjectLocationFormValues, value: string) => void;
  applyEpwSuggestion: (response: EpwParseResponse) => void;
  applyGeocodeCandidate: (candidate: GeocodeProjectLocationResponse["candidates"][number]) => void;
  geocodeAddress: (query: string) => Promise<GeocodeProjectLocationResponse>;
  deriveLocation: () => Promise<void>;
  parseEpw: (assetId: string) => Promise<EpwParseResponse>;
  // Re-enable elevation auto-fill after a manual override and re-pull for the current coordinates.
  resetElevationToAuto: () => void;
  save: () => Promise<void>;
};

// Owns the project-location edit form: form-value state, the load-sync and
// IP/SI reformat effects, payload diffing/validation, the coordinate-driven
// elevation auto-fill (P5), and the save round-trip. Extracted from the settings
// modal so the Climate tab can host the editor (D-CL-3) while settings keeps
// only a read-only summary.
export function useProjectLocationForm(projectId: string): ProjectLocationFormController {
  const queryClient = useQueryClient();
  const { unitSystem } = useUnitPreference();
  const previousUnitSystem = useRef<UnitSystem>(unitSystem);
  const loadedLocation = useRef<ProjectLocation | undefined>(undefined);
  // Tracks whether the user has touched the form, so a late-resolving (or
  // refetched) location query never clobbers in-progress edits.
  const locationEdited = useRef(false);
  const [values, setValues] = useState<ProjectLocationFormValues>(emptyLocationFormValues);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [elevationOverridden, setElevationOverridden] = useState(false);
  const [elevationSource, setElevationSource] = useState<string | null>(null);
  const [elevationNote, setElevationNote] = useState<string | null>(null);

  // Reset the elevation status flags together: clear the source label and note,
  // and set whether the field is now under manual control (`overridden`).
  const resetElevationStatus = (overridden = false) => {
    setElevationOverridden(overridden);
    setElevationSource(null);
    setElevationNote(null);
  };

  const locationQuery = useProjectLocationQuery(projectId);
  const updateMutation = useUpdateProjectLocationMutation(projectId);
  const deriveMutation = useDeriveProjectLocationMutation(projectId);
  const geocodeMutation = useGeocodeProjectLocationMutation(projectId);
  const parseEpwMutation = useParseProjectLocationEpwMutation(projectId);
  const elevationMutation = useLookupElevationMutation(projectId);

  // The coordinate key the displayed elevation already reflects; auto-fill only
  // re-pulls when coordinates move off it. Mirror refs let the debounced
  // callback read the latest state without widening the watch effect's deps.
  const lastAutoElevationCoords = useRef("");
  const autoElevationSeq = useRef(0);
  const overriddenRef = useRef(elevationOverridden);
  overriddenRef.current = elevationOverridden;
  const unitSystemRef = useRef(unitSystem);
  unitSystemRef.current = unitSystem;
  const elevationFieldRef = useRef(values.elevation);
  elevationFieldRef.current = values.elevation;

  useEffect(() => {
    if (
      locationQuery.data &&
      loadedLocation.current !== locationQuery.data &&
      !locationEdited.current
    ) {
      setValues(locationFormValuesFromLocation(locationQuery.data, unitSystem));
      loadedLocation.current = locationQuery.data;
      previousUnitSystem.current = unitSystem;
      // A freshly loaded, already-saved elevation must not trigger a re-pull;
      // anchor the auto-fill key to the loaded coordinates.
      lastAutoElevationCoords.current = elevationCoordsKey(
        locationQuery.data.latitude,
        locationQuery.data.longitude,
      );
      resetElevationStatus();
    }
  }, [locationQuery.data, unitSystem]);

  useEffect(() => {
    setValues((current) => {
      if (previousUnitSystem.current === unitSystem) return current;
      return {
        ...current,
        elevation: reformatElevationForUnitSystem(
          current.elevation,
          previousUnitSystem.current,
          unitSystem,
        ),
      };
    });
    previousUnitSystem.current = unitSystem;
  }, [unitSystem]);

  // Held on a ref so the debounced watch effect can invoke it without listing
  // the elevation mutation (whose identity churns on status) as a dependency.
  const runAutoFill = useRef<(lat: number, lon: number, coordsKey: string) => Promise<void>>(
    async () => {},
  );
  runAutoFill.current = async (latitude, longitude, coordsKey) => {
    const seq = (autoElevationSeq.current += 1);
    setElevationNote(null);
    try {
      const result = await elevationMutation.mutateAsync({ latitude, longitude });
      // Drop a result the user has outraced: a newer lookup, or a manual override.
      if (seq !== autoElevationSeq.current || overriddenRef.current) return;
      if (result.elevation_m === null) {
        setElevationSource(null);
        setElevationNote(result.warning ?? COULD_NOT_DETECT_MESSAGE);
        return;
      }
      const elevationM = result.elevation_m;
      lastAutoElevationCoords.current = coordsKey;
      locationEdited.current = true;
      setValues((current) => ({
        ...current,
        elevation: elevationInputFromMeters(elevationM, unitSystemRef.current),
      }));
      setElevationSource(elevationSourceLabel(result.source));
    } catch {
      if (seq === autoElevationSeq.current) setElevationNote(COULD_NOT_DETECT_MESSAGE);
    }
  };

  // Auto-fill elevation whenever the coordinates settle on a new valid point and
  // the user has not taken manual control. One debounced watcher covers
  // candidate-apply, pin-drop, and direct lat/long typing.
  useEffect(() => {
    if (elevationOverridden) return;
    const latitude = parseNumberInput(values.latitude);
    const longitude = parseNumberInput(values.longitude);
    if (latitude === null || longitude === null) return;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;
    const coordsKey = elevationCoordsKey(latitude, longitude);
    // Skip when the field already reflects these coordinates; still fire when it
    // is empty (e.g. a saved site whose elevation was never derived).
    if (coordsKey === lastAutoElevationCoords.current && elevationFieldRef.current.trim() !== "") {
      return;
    }
    const handle = window.setTimeout(() => {
      void runAutoFill.current(latitude, longitude, coordsKey);
    }, AUTO_ELEVATION_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [values.latitude, values.longitude, elevationOverridden]);

  const payloadResult = useMemo(
    () => buildProjectLocationPayload(locationQuery.data, values, unitSystem),
    [locationQuery.data, values, unitSystem],
  );
  const payload = payloadResult.ok ? payloadResult.payload : {};
  const validationError = payloadResult.ok ? null : payloadResult.error;
  const isDirty = Object.keys(payload).length > 0;
  const isSaving = updateMutation.isPending;
  const canSave = isDirty && !validationError && !isSaving;

  const updateField = (field: keyof ProjectLocationFormValues, value: string) => {
    locationEdited.current = true;
    // A hand-edit of elevation takes control: stop auto-fill clobbering it.
    if (field === "elevation") resetElevationStatus(true);
    setValues((current) => ({ ...current, [field]: value }));
  };

  const applyEpwSuggestion = (response: EpwParseResponse) => {
    locationEdited.current = true;
    setValues((current) => applyEpwSuggestionToLocationValues(current, response, unitSystem));
    // The EPW header supplies its own elevation; anchor the auto-fill key to its
    // coordinates so the watcher does not overwrite it with a DEM lookup.
    lastAutoElevationCoords.current = elevationCoordsKey(
      response.suggestion.latitude,
      response.suggestion.longitude,
    );
    resetElevationStatus();
  };

  const applyGeocodeCandidate = (
    candidate: GeocodeProjectLocationResponse["candidates"][number],
  ) => {
    locationEdited.current = true;
    // Picking a new address is a fresh-location gesture: drop any manual override
    // so the coordinate change re-derives elevation (matches applyEpwSuggestion).
    resetElevationStatus();
    setValues((current) => applyGeocodeCandidateToLocationValues(current, candidate));
  };

  const resetElevationToAuto = () => {
    resetElevationStatus();
    lastAutoElevationCoords.current = "";
    setValues((current) => ({ ...current, elevation: "" }));
  };

  // Adopt a server location into the form and anchor the auto-fill key to it, so
  // a derive/save round-trip never re-pulls elevation for unchanged coordinates.
  const adoptServerLocation = (location: ProjectLocation) => {
    loadedLocation.current = location;
    setValues(locationFormValuesFromLocation(location, unitSystem));
    locationEdited.current = false;
    lastAutoElevationCoords.current = elevationCoordsKey(location.latitude, location.longitude);
    resetElevationStatus();
  };

  const deriveLocation = async (): Promise<void> => {
    const derivePayload = buildProjectLocationDerivePayload(values);
    if (!derivePayload.ok) throw new Error(derivePayload.error);
    const response = await deriveMutation.mutateAsync(derivePayload.payload);
    adoptServerLocation(response.location);
    setWarnings(response.warnings);
    await queryClient.refetchQueries({
      queryKey: climateQueryKeys.sources(projectId),
      type: "active",
    });
  };

  const save = async (): Promise<void> => {
    if (!canSave) return;
    const response = await updateMutation.mutateAsync(payload);
    adoptServerLocation(response.location);
    setWarnings(response.warnings);
  };

  return {
    location: locationQuery.data,
    values,
    unitSystem,
    warnings,
    isLoading: locationQuery.isLoading,
    loadError: locationQuery.error,
    validationError,
    isDirty,
    isSaving,
    canSave,
    saveError: updateMutation.isError ? updateMutation.error : null,
    isDeriving: deriveMutation.isPending,
    isGeocoding: geocodeMutation.isPending,
    isParsingEpw: parseEpwMutation.isPending,
    isLookingUpElevation: elevationMutation.isPending,
    elevationSource,
    elevationNote,
    elevationOverridden,
    updateField,
    applyEpwSuggestion,
    applyGeocodeCandidate,
    geocodeAddress: (query) => geocodeMutation.mutateAsync(query),
    deriveLocation,
    parseEpw: (assetId) => parseEpwMutation.mutateAsync(assetId),
    resetElevationToAuto,
    save,
  };
}
