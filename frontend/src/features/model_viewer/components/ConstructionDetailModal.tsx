import { useMemo, useState } from "react";
import {
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { buildConstructionLayers, totalThicknessM } from "../lib/constructionLayers";
import { THERMAL_FIELD_TOOLTIPS } from "../lib/fieldConfigs";
import { splitFormattedMeasurement } from "../lib/formattedMeasurement";
import { ConstructionLayerTable } from "./ConstructionLayerTable";
import { ConstructionStackSvg } from "./ConstructionStackSvg";
import type { DetailedOpaqueConstruction } from "../types";

/** Read-only assembly detail for one HBJSON opaque construction: header
 *  figures (LBT-verbatim, D-7), a to-scale section drawing, and the
 *  expandable layer schedule. Deliberately shows nothing from the App's
 *  Envelope data — this is a sandboxed view of the model file (D-8). */
export function ConstructionDetailModal({
  construction,
  onClose,
}: {
  construction: DetailedOpaqueConstruction;
  onClose: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  // Hover is shared by the drawing and the table (row ↔ layer highlight),
  // so the modal owns it; expansion lives in the table alone.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const layers = useMemo(() => buildConstructionLayers(construction), [construction]);

  const stats: { id: string; label: string; value: string; tooltip?: string }[] = [
    {
      id: "thickness",
      label: "Thickness",
      value: formatLengthFromMm(totalThicknessM(layers) * 1000, { unitSystem, empty: "--" }),
      tooltip: "Sum of layer thicknesses",
    },
    {
      id: "u_factor",
      label: "U-Factor",
      value: formatUValueFromWm2K(construction.u_factor, { unitSystem, empty: "--" }),
      tooltip: THERMAL_FIELD_TOOLTIPS.u_factor,
    },
    {
      id: "u_value",
      label: "U-Value",
      value: formatUValueFromWm2K(construction.u_value, { unitSystem, empty: "--" }),
      tooltip: THERMAL_FIELD_TOOLTIPS.u_value,
    },
    {
      id: "r_factor",
      label: "R-Factor",
      value: formatRValueFromM2KPerW(construction.r_factor, { unitSystem, empty: "--" }),
      tooltip: THERMAL_FIELD_TOOLTIPS.r_factor,
    },
    {
      id: "r_value",
      label: "R-Value",
      value: formatRValueFromM2KPerW(construction.r_value, { unitSystem, empty: "--" }),
      tooltip: THERMAL_FIELD_TOOLTIPS.r_value,
    },
  ];

  return (
    <ModalDialog
      id="construction-detail"
      title={construction.identifier}
      titleId="construction-detail-title"
      onClose={onClose}
    >
      <p className="modal-subtitle">
        {construction.type} · {layers.length} {layers.length === 1 ? "layer" : "layers"} · HBJSON
        model (read-only)
      </p>
      {layers.length === 0 ? (
        <p className="construction-detail-empty">
          No layer detail available for this construction.
        </p>
      ) : (
        <>
          <dl className="construction-detail-stats">
            {stats.map((stat) => {
              const measurement = splitFormattedMeasurement(stat.value);
              return (
                <div key={stat.id} className="construction-detail-stat" title={stat.tooltip}>
                  <dt>{stat.label}</dt>
                  <dd>
                    <span>{measurement.value}</span>
                    {measurement.unit ? <small>{measurement.unit}</small> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="construction-detail-body">
            <ConstructionStackSvg
              constructionName={construction.identifier}
              layers={layers}
              hoveredIndex={hoveredIndex}
              onHoverLayer={setHoveredIndex}
            />
            <ConstructionLayerTable
              key={construction.identifier}
              layers={layers}
              unitSystem={unitSystem}
              hoveredIndex={hoveredIndex}
              onHoverLayer={setHoveredIndex}
            />
          </div>
        </>
      )}
    </ModalDialog>
  );
}
