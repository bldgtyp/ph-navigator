// Apertures-header overflow-menu action that downloads the
// ``WindowConstruction`` HBJSON payload (Phase 10). The label, icon, and
// filename pattern are PRD §17 contracts; the backend route is the
// single source of truth for shape and identifier escaping.
//
// Failure UI is intentionally minimal — no toast library lives in V2
// yet, so the action surfaces errors via the ``onError`` callback the
// host wires up to the existing apertures-page action-error banner.

import { Download } from "lucide-react";
import { useState } from "react";
import { ApiRequestError, fetchJson } from "../../../shared/api/client";
import { AppMenuItem } from "../../../shared/ui/AppMenu";
import { downloadJsonFile } from "../download-file";

type Props = {
  projectId: string;
  versionId: string;
  source: "draft" | "version";
  projectBtNumber: string;
  versionLabel: string;
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function ExportHbjsonAction({
  projectId,
  versionId,
  source,
  projectBtNumber,
  versionLabel,
  disabled = false,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const payload = await fetchJson<Record<string, unknown>>(
        `/api/v1/projects/${projectId}/versions/${versionId}/apertures/hbjson?source=${source}`,
      );
      downloadJsonFile(payload, suggestedFilename(projectBtNumber, versionLabel));
    } catch (err) {
      onError?.(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppMenuItem
      icon={Download}
      onClick={() => void handleClick()}
      disabled={busy || disabled}
      closeOnSelect={!disabled}
    >
      Export window constructions (HBJSON)
    </AppMenuItem>
  );
}

export function suggestedFilename(btNumber: string, versionLabel: string): string {
  // ``<bt>_<version>_apertures.hbjson.json`` — slug both for safety; the
  // server-side identifier escape rule lives elsewhere.
  const slug = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${slug(btNumber) || "project"}_${slug(versionLabel) || "version"}_apertures.hbjson.json`;
}

function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.errorCode === "aperture_hbjson_identifier_collision") {
      const collisions =
        (error.details?.collisions as Array<{ first: string; second: string }> | undefined) ?? [];
      const pair = collisions[0];
      if (pair) {
        return `Two apertures escape to the same Honeybee identifier — rename "${pair.first}" or "${pair.second}" and try again.`;
      }
    }
    if (error.errorCode === "aperture_hbjson_identifier_empty") {
      return "An aperture name has no alphanumeric characters and cannot be exported. Rename it.";
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Export failed.";
}
