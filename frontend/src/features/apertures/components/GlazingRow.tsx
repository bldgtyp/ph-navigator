// Glazing row in an element card. Mirrors ``FrameRow`` with the
// glazing-specific reported value set (U-value, g-value).

import type { GlazingRef } from "../types";
import { GlazingPicker } from "./GlazingPicker";

export type GlazingRowProps = {
  glazing: GlazingRef | null;
  canEdit: boolean;
  onPick: (glazing: GlazingRef) => void;
};

export function GlazingRow({ glazing, canEdit, onPick }: GlazingRowProps) {
  return (
    <div
      className="aperture-element-table__row aperture-card-row aperture-card-row--glazing"
      data-testid="glazing-row"
      role="row"
    >
      <div className="aperture-card-row__label" role="cell">
        Glazing:
      </div>
      <div className="aperture-card-row__main" role="cell">
        <GlazingPicker
          currentName={glazing?.name ?? null}
          currentCatalogId={glazing?.catalog_origin?.catalog_record_id ?? null}
          disabled={!canEdit}
          onPick={onPick}
        />
      </div>
      <div className="aperture-card-row__metric" role="cell">
        {formatNumber(glazing?.u_value_w_m2k ?? null)}
      </div>
      <div className="aperture-card-row__metric" role="cell">
        -
      </div>
      <div className="aperture-card-row__metric" role="cell">
        {formatNumber(glazing?.g_value ?? null)}
      </div>
    </div>
  );
}

function formatNumber(value: number | null): string {
  return value == null ? "-" : `${value}`;
}
