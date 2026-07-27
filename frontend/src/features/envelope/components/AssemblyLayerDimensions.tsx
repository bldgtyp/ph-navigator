// The section's left-hand dimension column: one control block per layer,
// carrying the thickness label/editor, the delete action, and the
// add-layer-above/below buttons. Split out of AssemblyCanvasOverlay.tsx to
// keep that module under the 500-line guard; the overlay still owns segment
// hit targets and paint-mode behaviour.
import { type KeyboardEvent, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatLengthFromMm, parseLengthToMm, type UnitSystem } from "../../../lib/units";
import { DIMENSION_COLUMN_WIDTH_PX, pxFromMm } from "../canvas-constants";
import type { AssemblyCanvasLayerGeometry } from "../canvas-geometry";
import type { AssemblyLayer } from "../types";
import { CanvasAddButton } from "./CanvasAddButton";
import type { AssemblyCanvasOverlayActions } from "./AssemblyCanvasOverlay";

export function AssemblyLayerDimensions({
  layerGeometry,
  unitSystem,
  zoom,
  actions,
}: {
  layerGeometry: AssemblyCanvasLayerGeometry;
  unitSystem: UnitSystem;
  zoom: number;
  actions: AssemblyCanvasOverlayActions;
}) {
  const { layer } = layerGeometry;
  const layerNumber = layer.order + 1;
  // The cell tracks the drawn band. A membrane's band is the reserved drawing
  // space from the geometry, which is what keeps its thickness label clickable.
  const topPx = pxFromMm(layerGeometry.yMm, zoom);
  const heightPx = pxFromMm(layerGeometry.heightMm, zoom);
  return (
    <div
      id={`assembly-layer-dimension-${layer.id}`}
      className="assembly-layer-dimension dimension-chrome-cell dimension-chrome-cell--vertical"
      style={{
        top: `${topPx}px`,
        width: `${DIMENSION_COLUMN_WIDTH_PX}px`,
        height: `${heightPx}px`,
      }}
      aria-label={`Layer ${layerNumber} thickness controls`}
    >
      <span
        className="dimension-tick dimension-chrome-tick dimension-chrome-tick--vertical dimension-tick-top"
        aria-hidden="true"
      />
      <span
        className="dimension-tick dimension-chrome-tick dimension-chrome-tick--vertical dimension-tick-bottom"
        aria-hidden="true"
      />
      {/* A membrane's real thickness is not what its band shows and drives
          nothing the user can check, so the number is not offered here — it
          lives in Segment Properties beside the note that explains it. The
          delete action stays, because it is otherwise only reachable *through*
          the thickness editor and a membrane layer must still be removable. */}
      {layerGeometry.isMembrane ? (
        <LayerDeleteButton
          layerNumber={layerNumber}
          onDelete={() => actions.onDeleteLayer(layer)}
        />
      ) : (
        <LayerThicknessEditor
          layer={layer}
          layerNumber={layerNumber}
          unitSystem={unitSystem}
          onDelete={() => actions.onDeleteLayer(layer)}
          onSubmit={(thicknessMm) => actions.onUpdateLayerThickness(layer, thicknessMm)}
        />
      )}
      <CanvasAddButton
        id={`assembly-layer-add-above-${layer.id}`}
        label={`Add layer above layer ${layerNumber}`}
        className="layer-add-button add-above"
        onClick={() => actions.onAddLayer(layer, "above")}
      />
      <CanvasAddButton
        id={`assembly-layer-add-below-${layer.id}`}
        label={`Add layer below layer ${layerNumber}`}
        className="layer-add-button add-below"
        onClick={() => actions.onAddLayer(layer, "below")}
      />
    </div>
  );
}

/** The dimension cell for a membrane layer: delete only, no thickness value. */
function LayerDeleteButton({
  layerNumber,
  onDelete,
}: {
  layerNumber: number;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      className="dimension-chrome-delete-button"
      aria-label={`Delete layer ${layerNumber}`}
      title="Delete layer"
      onClick={onDelete}
    >
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}

function LayerThicknessEditor({
  layer,
  layerNumber,
  unitSystem,
  onDelete,
  onSubmit,
}: {
  layer: AssemblyLayer;
  layerNumber: number;
  unitSystem: UnitSystem;
  onDelete: () => void;
  onSubmit: (thicknessMm: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editorUnitSystem, setEditorUnitSystem] = useState<UnitSystem>(unitSystem);
  const [draft, setDraft] = useState(() => formatLayerThickness(layer.thickness_mm, unitSystem));
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef(false);

  function startEditing(): void {
    setEditorUnitSystem(unitSystem);
    setDraft(formatLayerThickness(layer.thickness_mm, unitSystem));
    setError(null);
    committedRef.current = false;
    setIsEditing(true);
  }

  function cancelEditing(): void {
    setDraft(formatLayerThickness(layer.thickness_mm, editorUnitSystem));
    setError(null);
    setIsEditing(false);
  }

  function commit(): void {
    const parsed = parseLengthToMm(draft, { unitSystem: editorUnitSystem });
    if (committedRef.current) return;
    if (!parsed.ok || parsed.valueSi <= 0) {
      setError(parsed.ok ? "Thickness must be greater than zero." : parsed.message);
      return;
    }
    if (Math.abs(parsed.valueSi - layer.thickness_mm) < 0.001) {
      setError(null);
      committedRef.current = true;
      setIsEditing(false);
      return;
    }
    setError(null);
    committedRef.current = true;
    setIsEditing(false);
    onSubmit(parsed.valueSi);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  if (isEditing) {
    return (
      <label className="dimension-input-wrap">
        <span className="sr-only">Layer {layerNumber} thickness</span>
        <input
          autoFocus
          aria-invalid={error ? "true" : "false"}
          aria-label={`Layer ${layerNumber} thickness`}
          className="dimension-input"
          value={draft}
          onBlur={commit}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setError(null);
          }}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={onKeyDown}
        />
        <button
          id={`assembly-layer-${layer.id}-delete`}
          type="button"
          className="dimension-chrome-delete-button"
          aria-label={`Delete layer ${layerNumber}`}
          title="Delete layer"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
        {error ? (
          <span className="dimension-error" role="alert">
            {error}
          </span>
        ) : null}
      </label>
    );
  }

  // Membranes never reach here — their band is not their thickness, so the
  // number would contradict the drawing. This label is always 1:1 with what is
  // rendered beside it.
  return (
    <button
      id={`assembly-layer-${layer.id}-thickness-editor`}
      type="button"
      className="dimension-label-button dimension-chrome-label-button"
      aria-label={`Edit layer ${layerNumber} thickness`}
      onClick={startEditing}
    >
      {formatLayerThickness(layer.thickness_mm, unitSystem)}
    </button>
  );
}

function formatLayerThickness(valueMm: number, unitSystem: UnitSystem): string {
  return formatLengthFromMm(valueMm, {
    unitSystem,
    showUnit: false,
    fractionDigits: unitSystem === "IP" ? 3 : 1,
  });
}
