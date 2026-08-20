// The section's left-hand dimension column: semantic thickness presentation
// for every viewer, with editor-only mutation controls layered onto it.
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { parseLengthToMm, type UnitSystem } from "../../../lib/units";
import { DIMENSION_COLUMN_WIDTH_PX, pxFromMm } from "../canvas-constants";
import type { AssemblyCanvasLayerGeometry } from "../canvas-geometry";
import { formatAssemblyLayerThickness } from "../lib";
import type { AssemblyLayer } from "../types";
import { CanvasAddButton } from "./CanvasAddButton";
import type { AssemblyCanvasOverlayActions } from "./AssemblyCanvasOverlay";

export function AssemblyLayerDimensions({
  layerGeometry,
  unitSystem,
  zoom,
  canEdit,
  actions,
}: {
  layerGeometry: AssemblyCanvasLayerGeometry;
  unitSystem: UnitSystem;
  zoom: number;
  canEdit: boolean;
  actions: AssemblyCanvasOverlayActions;
}) {
  const { layer } = layerGeometry;
  const layerNumber = layer.order + 1;
  if (layerGeometry.isMembrane && !canEdit) return null;

  // The cell tracks the drawn band. A membrane's reserved drawing height keeps
  // its editor-only delete/add controls aligned without implying a dimension.
  const topPx = pxFromMm(layerGeometry.yMm, zoom);
  const heightPx = pxFromMm(layerGeometry.heightMm, zoom);
  const className = layerGeometry.isMembrane
    ? "assembly-layer-dimension assembly-layer-dimension--controls-only"
    : "assembly-layer-dimension dimension-chrome-cell dimension-chrome-cell--vertical";
  let content: ReactNode;
  if (layerGeometry.isMembrane) {
    content = (
      <LayerDeleteButton layerNumber={layerNumber} onDelete={() => actions.onDeleteLayer(layer)} />
    );
  } else if (canEdit) {
    content = (
      <LayerThicknessEditor
        layer={layer}
        layerNumber={layerNumber}
        unitSystem={unitSystem}
        onDelete={() => actions.onDeleteLayer(layer)}
        onSubmit={(thicknessMm) => actions.onUpdateLayerThickness(layer, thicknessMm)}
      />
    );
  } else {
    content = (
      <span
        className="dimension-label-text"
        aria-label={`Layer ${layerNumber} thickness: ${formatAssemblyLayerThickness(layer.thickness_mm, unitSystem, true)}`}
      >
        {formatAssemblyLayerThickness(layer.thickness_mm, unitSystem)}
      </span>
    );
  }

  return (
    <div
      id={`assembly-layer-dimension-${layer.id}`}
      className={className}
      data-readonly={canEdit ? undefined : "true"}
      style={{
        top: `${topPx}px`,
        width: `${DIMENSION_COLUMN_WIDTH_PX}px`,
        height: `${heightPx}px`,
      }}
      aria-label={canEdit ? `Layer ${layerNumber} thickness controls` : undefined}
    >
      {!layerGeometry.isMembrane ? <DimensionTicks /> : null}
      {content}
      {canEdit ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}

function DimensionTicks() {
  return (
    <>
      <span
        className="dimension-tick dimension-chrome-tick dimension-chrome-tick--vertical dimension-tick-top"
        aria-hidden="true"
      />
      <span
        className="dimension-tick dimension-chrome-tick dimension-chrome-tick--vertical dimension-tick-bottom"
        aria-hidden="true"
      />
    </>
  );
}

/** A membrane has no physical-thickness dimension; editors only get its controls. */
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
  const [draft, setDraft] = useState(() =>
    formatAssemblyLayerThickness(layer.thickness_mm, unitSystem),
  );
  const [error, setError] = useState<string | null>(null);
  const committedRef = useRef(false);

  function startEditing(): void {
    setEditorUnitSystem(unitSystem);
    setDraft(formatAssemblyLayerThickness(layer.thickness_mm, unitSystem));
    setError(null);
    committedRef.current = false;
    setIsEditing(true);
  }

  function cancelEditing(): void {
    setDraft(formatAssemblyLayerThickness(layer.thickness_mm, editorUnitSystem));
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

  return (
    <button
      id={`assembly-layer-${layer.id}-thickness-editor`}
      type="button"
      className="dimension-label-button dimension-chrome-label-button"
      aria-label={`Edit layer ${layerNumber} thickness`}
      onClick={startEditing}
    >
      {formatAssemblyLayerThickness(layer.thickness_mm, unitSystem)}
    </button>
  );
}
