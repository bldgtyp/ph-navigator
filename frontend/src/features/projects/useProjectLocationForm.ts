import { useEffect, useMemo, useRef, useState } from "react";
import { useUnitPreference, type UnitSystem } from "../../lib/units";
import {
  useParseProjectLocationEpwMutation,
  useDeriveProjectLocationMutation,
  useGeocodeProjectLocationMutation,
  useProjectLocationQuery,
  useUpdateProjectLocationMutation,
} from "./hooks";
import {
  applyGeocodeCandidateToLocationValues,
  applyEpwSuggestionToLocationValues,
  buildProjectLocationDerivePayload,
  buildProjectLocationPayload,
  emptyLocationFormValues,
  locationFormValuesFromLocation,
  reformatElevationForUnitSystem,
  type ProjectLocationFormValues,
} from "./location-form";
import type { EpwParseResponse, GeocodeProjectLocationResponse, ProjectLocation } from "./types";

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
  updateField: (field: keyof ProjectLocationFormValues, value: string) => void;
  applyEpwSuggestion: (response: EpwParseResponse) => void;
  applyGeocodeCandidate: (candidate: GeocodeProjectLocationResponse["candidates"][number]) => void;
  geocodeAddress: (query: string) => Promise<GeocodeProjectLocationResponse>;
  deriveLocation: () => Promise<void>;
  parseEpw: (assetId: string) => Promise<EpwParseResponse>;
  save: () => Promise<void>;
};

// Owns the project-location edit form: form-value state, the load-sync and
// IP/SI reformat effects, payload diffing/validation, and the save round-trip.
// Extracted from the settings modal so the Climate tab can host the editor
// (D-CL-3) while settings keeps only a read-only summary.
export function useProjectLocationForm(projectId: string): ProjectLocationFormController {
  const { unitSystem } = useUnitPreference();
  const previousUnitSystem = useRef<UnitSystem>(unitSystem);
  const loadedLocation = useRef<ProjectLocation | undefined>(undefined);
  // Tracks whether the user has touched the form, so a late-resolving (or
  // refetched) location query never clobbers in-progress edits.
  const locationEdited = useRef(false);
  const [values, setValues] = useState<ProjectLocationFormValues>(emptyLocationFormValues);
  const [warnings, setWarnings] = useState<string[]>([]);

  const locationQuery = useProjectLocationQuery(projectId);
  const updateMutation = useUpdateProjectLocationMutation(projectId);
  const deriveMutation = useDeriveProjectLocationMutation(projectId);
  const geocodeMutation = useGeocodeProjectLocationMutation(projectId);
  const parseEpwMutation = useParseProjectLocationEpwMutation(projectId);

  useEffect(() => {
    if (
      locationQuery.data &&
      loadedLocation.current !== locationQuery.data &&
      !locationEdited.current
    ) {
      setValues(locationFormValuesFromLocation(locationQuery.data, unitSystem));
      loadedLocation.current = locationQuery.data;
      previousUnitSystem.current = unitSystem;
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
    setValues((current) => ({ ...current, [field]: value }));
  };

  const applyEpwSuggestion = (response: EpwParseResponse) => {
    locationEdited.current = true;
    setValues((current) => applyEpwSuggestionToLocationValues(current, response, unitSystem));
  };

  const applyGeocodeCandidate = (
    candidate: GeocodeProjectLocationResponse["candidates"][number],
  ) => {
    locationEdited.current = true;
    setValues((current) => applyGeocodeCandidateToLocationValues(current, candidate));
  };

  const deriveLocation = async (): Promise<void> => {
    const derivePayload = buildProjectLocationDerivePayload(values);
    if (!derivePayload.ok) throw new Error(derivePayload.error);
    const response = await deriveMutation.mutateAsync(derivePayload.payload);
    loadedLocation.current = response.location;
    setValues(locationFormValuesFromLocation(response.location, unitSystem));
    locationEdited.current = false;
    setWarnings(response.warnings);
  };

  const save = async (): Promise<void> => {
    if (!canSave) return;
    const response = await updateMutation.mutateAsync(payload);
    loadedLocation.current = response.location;
    setValues(locationFormValuesFromLocation(response.location, unitSystem));
    locationEdited.current = false;
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
    updateField,
    applyEpwSuggestion,
    applyGeocodeCandidate,
    geocodeAddress: (query) => geocodeMutation.mutateAsync(query),
    deriveLocation,
    parseEpw: (assetId) => parseEpwMutation.mutateAsync(assetId),
    save,
  };
}
