import { useUnitPreference } from "../../../lib/units";
import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import { nameCollides } from "../lib";
import type { ApertureTypeEntry } from "../types";
import type { ApertureUValueResult } from "../hooks/useApertureUValues";
import { UValueChip } from "./UValueChip";

export function AperturesHeader({
  activeAperture,
  apertures,
  uValue,
  loading = false,
  canEdit,
  busy,
  onRename,
}: {
  activeAperture: ApertureTypeEntry | null;
  apertures: ApertureTypeEntry[];
  uValue?: ApertureUValueResult | null;
  loading?: boolean;
  canEdit: boolean;
  busy: boolean;
  onRename: (name: string) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const activeName = activeAperture?.name ?? "Apertures";
  return (
    <header className="apertures-page__header" data-reveal-edit-on-hover>
      <div className="apertures-page__header-main">
        <InlineHeaderNameEditor
          value={activeName}
          canEdit={canEdit && activeAperture !== null}
          busy={busy}
          editLabel="Edit aperture type name"
          inputLabel="Aperture type name"
          getValidationMessage={(name) => {
            if (!activeAperture || !nameCollides(apertures, name.trim(), activeAperture.id)) {
              return null;
            }
            return `An aperture type named '${name.trim()}' already exists in this version.`;
          }}
          onSubmit={onRename}
        />
      </div>
      <div className="apertures-page__header-summary">
        <UValueChip
          valueWm2k={uValue?.window_u_value_w_m2k ?? null}
          unitSystem={unitSystem === "IP" ? "ip" : "si"}
          unfinishedCount={uValue?.warnings.length ?? 0}
          loading={loading}
        />
      </div>
    </header>
  );
}
