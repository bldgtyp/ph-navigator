import type { ReactNode } from "react";
import { useUnitPreference } from "../../../lib/units";
import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import type { ApertureThermalComfortResult } from "../comfort-types";
import { nameCollides } from "../lib";
import type { ApertureTypeEntry } from "../types";
import type { ApertureUValueResult } from "../hooks/useApertureUValues";
import { ThermalComfortChip } from "./ThermalComfortChip";
import { UValueChip } from "./UValueChip";

export function AperturesHeader({
  activeAperture,
  apertures,
  uValue,
  comfort = null,
  comfortLoading = false,
  comfortUnavailable = false,
  loading = false,
  canEdit,
  busy,
  actions,
  onRename,
  onOpenComfort,
}: {
  activeAperture: ApertureTypeEntry;
  apertures: ApertureTypeEntry[];
  uValue?: ApertureUValueResult | null;
  comfort?: ApertureThermalComfortResult | null;
  comfortLoading?: boolean;
  comfortUnavailable?: boolean;
  loading?: boolean;
  canEdit: boolean;
  busy: boolean;
  actions?: ReactNode;
  onRename: (name: string) => void;
  onOpenComfort?: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  return (
    <header className="apertures-page__header" data-reveal-edit-on-hover>
      <div className="apertures-page__header-main">
        <InlineHeaderNameEditor
          value={activeAperture.name}
          canEdit={canEdit}
          busy={busy}
          editLabel="Edit aperture type name"
          inputLabel="Aperture type name"
          getValidationMessage={(name) => {
            if (!nameCollides(apertures, name.trim(), activeAperture.id)) {
              return null;
            }
            return `An aperture type named '${name.trim()}' already exists in this version.`;
          }}
          onSubmit={onRename}
        />
        {actions ? <div className="apertures-page__header-actions">{actions}</div> : null}
      </div>
      <div className="apertures-page__header-summary">
        {onOpenComfort ? (
          <ThermalComfortChip
            result={comfort}
            loading={comfortLoading}
            unavailable={comfortUnavailable}
            onClick={onOpenComfort}
          />
        ) : null}
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
