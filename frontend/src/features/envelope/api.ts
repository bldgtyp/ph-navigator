import type { UnitSystem } from "../../lib/units/types";
import { fetchBlob, fetchJson } from "../../shared/api/client";
import { draftWriteHeaders } from "../project_document/table-slice";
import type {
  AssemblyThermalResponse,
  EnvelopeCommandBody,
  EnvelopeReadResponse,
  EnvelopeReadSource,
  ImportConstructionsPreview,
  PhppPreflightResponse,
  ProjectMaterialDriftReport,
} from "./types";

export async function fetchEnvelopeReadModel(
  projectId: string,
  versionId: string,
  source: EnvelopeReadSource,
  signal?: AbortSignal,
): Promise<EnvelopeReadResponse> {
  return fetchJson<EnvelopeReadResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope?source=${source}`,
    { signal },
  );
}

export async function postEnvelopeCommand(
  projectId: string,
  versionId: string,
  current: EnvelopeReadResponse,
  body: EnvelopeCommandBody,
): Promise<EnvelopeReadResponse> {
  return fetchJson<EnvelopeReadResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/envelope/commands`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify(body),
    },
  );
}

export async function fetchAssemblyThermal(
  projectId: string,
  versionId: string,
  assemblyId: string,
  source: EnvelopeReadSource,
  signal?: AbortSignal,
): Promise<AssemblyThermalResponse> {
  return fetchJson<AssemblyThermalResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope/assemblies/${assemblyId}/thermal?source=${source}`,
    { signal },
  );
}

export async function fetchMaterialCatalogDrift(
  projectId: string,
  versionId: string,
  source: EnvelopeReadSource,
  signal?: AbortSignal,
): Promise<ProjectMaterialDriftReport> {
  return fetchJson<ProjectMaterialDriftReport>(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope/material-catalog-drift?source=${source}`,
    { signal },
  );
}

export async function downloadEnvelopeHbjson(projectId: string, versionId: string): Promise<Blob> {
  return fetchBlob(`/api/v1/projects/${projectId}/versions/${versionId}/envelope/export/hbjson`);
}

export async function fetchPhppPreflight(
  projectId: string,
  versionId: string,
  signal?: AbortSignal,
): Promise<PhppPreflightResponse> {
  return fetchJson<PhppPreflightResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope/export/phpp/preflight`,
    { signal },
  );
}

export async function downloadEnvelopePhpp(
  projectId: string,
  versionId: string,
  units: UnitSystem,
): Promise<Blob> {
  return fetchBlob(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope/export/phpp?units=${units}`,
  );
}

export async function previewEnvelopeHbjsonImport(
  projectId: string,
  versionId: string,
  file: File,
): Promise<ImportConstructionsPreview> {
  const form = new FormData();
  form.append("file", file);
  return fetchJson<ImportConstructionsPreview>(
    `/api/v1/projects/${projectId}/versions/${versionId}/envelope/import/hbjson/preview`,
    { method: "POST", body: form },
  );
}
