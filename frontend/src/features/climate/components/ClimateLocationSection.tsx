import { errorMessage } from "../../../shared/lib/errors";
import { ProjectLocationEditor } from "../../projects/components/ProjectLocationEditor";
import { ProjectLocationSummary } from "../../projects/components/ProjectLocationSummary";
import { useProjectLocationForm } from "../../projects/useProjectLocationForm";
import type { ProjectDetail } from "../../projects/types";

// The project location, edited in the Climate tab (D-CL-3). Editors get the
// full editor + EPW flow with an independent Save; viewers get a read-only
// summary. Project settings now shows only the compact read-only summary.
export function ClimateLocationSection({ project }: { project: ProjectDetail }) {
  const isViewer = project.access_mode === "viewer";
  const form = useProjectLocationForm(project.id);

  // Status notes render alongside the editor (not in place of it) so a
  // late-resolving location query cannot discard in-progress edits.
  const status = (
    <>
      {form.isLoading ? <p className="form-note">Loading project location…</p> : null}
      {form.loadError ? (
        <p className="form-error">
          {errorMessage(form.loadError, "Could not load project location.")}
        </p>
      ) : null}
    </>
  );

  if (isViewer) {
    return (
      <>
        {status}
        <ProjectLocationSummary
          projectId={project.id}
          location={form.location}
          unitSystem={form.unitSystem}
        />
      </>
    );
  }

  return (
    <div className="climate-location-editor">
      {status}
      {form.warnings.length > 0 ? (
        <div className="draft-banner" role="status">
          {form.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      <ProjectLocationEditor
        location={form.location}
        values={form.values}
        unitSystem={form.unitSystem}
        projectId={project.id}
        isParsingEpw={form.isParsingEpw}
        isGeocoding={form.isGeocoding}
        isDeriving={form.isDeriving}
        onParseEpw={form.parseEpw}
        onGeocodeAddress={form.geocodeAddress}
        onApplyGeocodeCandidate={form.applyGeocodeCandidate}
        onDeriveLocation={form.deriveLocation}
        onChange={form.updateField}
        onApplyEpwSuggestion={form.applyEpwSuggestion}
      />
      {form.validationError ? <p className="form-error">{form.validationError}</p> : null}
      {form.saveError ? (
        <p className="form-error" role="alert">
          {errorMessage(form.saveError, "Could not save project location.")}
        </p>
      ) : null}
      <div className="climate-location-actions">
        <button
          type="button"
          onClick={() => void form.save().catch(() => undefined)}
          disabled={!form.canSave}
        >
          {form.isSaving ? "Saving…" : "Save location"}
        </button>
      </div>
    </div>
  );
}
