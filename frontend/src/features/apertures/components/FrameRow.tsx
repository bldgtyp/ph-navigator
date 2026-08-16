// One row inside an element card for a per-side frame slot.
// Composes label, catalog picker, and reported frame values.

import type { ApertureSide, ApertureOperation, FrameRef } from "../types";
import type { ResolvedInstallPsi } from "../install-psi";
import { FramePicker } from "./FramePicker";
import { frameRowLabel, type ViewDirection } from "../frame-label-map";
import {
  formatLengthFromMm,
  formatLinearPsiFromWmK,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import type { UnitSystem } from "../../../lib/units";

export type FrameRowProps = {
  side: ApertureSide;
  viewDirection: ViewDirection;
  frame: FrameRef | null;
  operation: ApertureOperation | null;
  canEdit: boolean;
  /** Phase 07 per-side ⚠ tooltip when the catalog operation no longer
   *  matches the element operation. Null when the row is in agreement
   *  or the warning was dismissed. */
  mismatchIndicator?: string | null;
  /** Effective Ψ-install for this edge (aperture-psi-install D-6a).
   *  Undefined when the parent has no install-type data to resolve
   *  against — the cell then falls back to "-". */
  install?: ResolvedInstallPsi | null;
  onPick: (frame: FrameRef) => void;
};

export function FrameRow({
  side,
  viewDirection,
  frame,
  operation,
  canEdit,
  mismatchIndicator,
  install,
  onPick,
}: FrameRowProps) {
  const { unitSystem } = useUnitPreference();

  return (
    <div
      className="aperture-element-table__row aperture-card-row aperture-card-row--frame"
      data-testid={`frame-row-${side}`}
      role="row"
    >
      <div className="aperture-card-row__label" role="cell">
        {frameRowLabel(side, viewDirection)}:
      </div>
      <div className="aperture-card-row__main" role="cell">
        <FramePicker
          side={side}
          operation={operation}
          currentName={frame?.name ?? null}
          currentCatalogId={frame?.catalog_origin?.catalog_record_id ?? null}
          disabled={!canEdit}
          onPick={onPick}
        />
        {mismatchIndicator && (
          <span
            className="aperture-frame-row__mismatch"
            title={mismatchIndicator}
            data-testid={`frame-mismatch-${side}`}
            aria-label="Operation mismatch"
          >
            ⚠
          </span>
        )}
      </div>
      <div className="aperture-card-row__metric" role="cell">
        {formatUValueFromWm2K(frame?.u_value_w_m2k ?? null, {
          unitSystem,
          empty: "-",
          showUnit: false,
        })}
      </div>
      <div className="aperture-card-row__metric" role="cell">
        {formatLengthFromMm(frame?.width_mm ?? null, {
          unitSystem,
          empty: "-",
          showUnit: false,
        })}
      </div>
      <div className="aperture-card-row__metric" role="cell">
        -
      </div>
      <InstallPsiCell side={side} install={install ?? null} unitSystem={unitSystem} />
    </div>
  );
}

/** Effective Ψ-install: muted when inherited from the Default, muted
 *  "0 (mull)" on interior edges, normal weight when assigned. */
function InstallPsiCell({
  side,
  install,
  unitSystem,
}: {
  side: ApertureSide;
  install: ResolvedInstallPsi | null;
  unitSystem: UnitSystem;
}) {
  if (install === null) {
    return (
      <div className="aperture-card-row__metric" role="cell">
        -
      </div>
    );
  }
  const formattedWithUnit = formatLinearPsiFromWmK(install.psiWmk, { unitSystem, showUnit: true });
  const muted = install.source !== "assigned";
  const tooltip =
    install.source === "mull"
      ? `Mulled interior edge — ${formattedWithUnit} (derived)`
      : `${install.installTypeName ?? install.installTypeId ?? "Install type"} — ${formattedWithUnit}${
          install.source === "default" ? " (inherited default)" : ""
        }`;
  return (
    <div
      className={`aperture-card-row__metric${muted ? " aperture-card-row__metric--muted" : ""}`}
      role="cell"
      title={tooltip}
      data-testid={`install-psi-${side}`}
    >
      {install.source === "mull" ? "0 (mull)" : formattedWithUnit.replace(/ .*$/, "")}
    </div>
  );
}
