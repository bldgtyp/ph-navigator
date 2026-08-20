import { formatProjectDateTime } from "../../../shared/lib/dates";
import type { ProjectVersion } from "../../projects/types";
import { VERSION_KIND_LABELS } from "../types/versionControls";

export function VersionSummary({
  version,
  isDefault,
  headingId,
}: {
  version: ProjectVersion;
  isDefault: boolean;
  headingId?: string;
}) {
  return (
    <div className="version-summary">
      <strong id={headingId}>{version.name}</strong>
      <span>
        {VERSION_KIND_LABELS[version.kind]}
        {version.locked ? " · Locked" : ""}
        {isDefault ? " · Default" : ""}
      </span>
      <span title={new Date(version.updated_at).toLocaleString()}>
        Last edited {formatProjectDateTime(version.updated_at)}
      </span>
    </div>
  );
}
