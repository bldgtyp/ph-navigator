import { fetchJson } from "../../shared/api/client";
import { draftWriteHeaders } from "../project_document/table-slice";
import { normalizeSpecificationStatusRecord } from "../project_document/specification-status";
import type {
  ApertureCommand,
  ApertureElementFrames,
  ApertureProductCommand,
  ApertureReadSource,
  ApertureSpecReportResponse,
  AperturesSlice,
  ProjectFrame,
  WireApertureElementFrames,
  WireAperturesSlice,
  WireApertureSpecReportResponse,
} from "./types";

type DraftWriteResult = {
  version_id: string;
  draft_etag: string | null;
};

export async function fetchAperturesSlice(
  projectId: string,
  versionId: string,
  accessMode: "editor" | "viewer",
  signal?: AbortSignal,
): Promise<AperturesSlice> {
  const path =
    accessMode === "editor"
      ? `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/apertures`
      : `/api/v1/projects/${projectId}/versions/${versionId}/document/tables/apertures`;
  const slice = await fetchJson<WireAperturesSlice>(path, { signal });
  return hydrateAperturesSlice(slice);
}

export async function applyApertureCommand(
  projectId: string,
  versionId: string,
  current: AperturesSlice,
  command: ApertureCommand,
): Promise<AperturesSlice> {
  const slice = await fetchJson<WireAperturesSlice>(
    `/api/v1/projects/${projectId}/versions/${versionId}/apertures/command`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify(command),
    },
  );
  return hydrateAperturesSlice(slice);
}

export async function fetchApertureSpecReport(
  projectId: string,
  versionId: string,
  source: ApertureReadSource,
  signal?: AbortSignal,
): Promise<ApertureSpecReportResponse> {
  const response = await fetchJson<WireApertureSpecReportResponse>(
    `/api/v1/projects/${projectId}/versions/${versionId}/apertures/spec-report?source=${source}`,
    { signal },
  );
  return normalizeApertureSpecReport(response);
}

export async function applyApertureProductCommand(
  projectId: string,
  versionId: string,
  current: ApertureSpecReportResponse,
  command: ApertureProductCommand,
): Promise<DraftWriteResult> {
  return fetchJson<DraftWriteResult>(
    `/api/v1/projects/${projectId}/versions/${versionId}/draft/envelope/commands`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify({ command }),
    },
  );
}

export async function applyApertureReportRefreshCommand(
  projectId: string,
  versionId: string,
  current: ApertureSpecReportResponse,
  command: Extract<ApertureCommand, { kind: "refreshRefFromCatalog" }>,
): Promise<DraftWriteResult> {
  return fetchJson<DraftWriteResult>(
    `/api/v1/projects/${projectId}/versions/${versionId}/apertures/command`,
    {
      method: "POST",
      headers: draftWriteHeaders(current),
      body: JSON.stringify(command),
    },
  );
}

function hydrateAperturesSlice(slice: WireAperturesSlice): AperturesSlice {
  const projectFrames = slice.project_frames.map(normalizeSpecificationStatusRecord);
  const projectGlazings = slice.project_glazings.map(normalizeSpecificationStatusRecord);
  const framesById = new Map(projectFrames.map((frame) => [frame.id, frame]));
  const glazingsById = new Map(projectGlazings.map((glazing) => [glazing.id, glazing]));
  return {
    ...slice,
    project_frames: projectFrames,
    project_glazings: projectGlazings,
    apertures: slice.apertures.map((aperture) => ({
      ...aperture,
      elements: aperture.elements.map((element) => ({
        id: element.id,
        name: element.name,
        row_span: element.row_span,
        column_span: element.column_span,
        frames: hydrateFrames(element.frames, framesById),
        glazing: element.glazing_id ? (glazingsById.get(element.glazing_id) ?? null) : null,
        operation: element.operation,
      })),
    })),
  };
}

export function normalizeApertureSpecReport(
  response: WireApertureSpecReportResponse,
): ApertureSpecReportResponse {
  return {
    ...response,
    project_glazings: response.project_glazings.map(normalizeSpecificationStatusRecord),
    project_frames: response.project_frames.map(normalizeSpecificationStatusRecord),
  };
}

function hydrateFrames(
  frameIds: WireApertureElementFrames,
  framesById: Map<string, ProjectFrame>,
): ApertureElementFrames {
  return {
    top: frameIds.top ? (framesById.get(frameIds.top) ?? null) : null,
    right: frameIds.right ? (framesById.get(frameIds.right) ?? null) : null,
    bottom: frameIds.bottom ? (framesById.get(frameIds.bottom) ?? null) : null,
    left: frameIds.left ? (framesById.get(frameIds.left) ?? null) : null,
  };
}
