import { Minus, Plus } from "lucide-react";
import { createSearchParams, useNavigate } from "react-router-dom";
import { formatLengthFromMm, useUnitPreference } from "../../../lib/units";
import { statusLabel, totalThicknessMm } from "../lib";
import { envelopeAssemblyPath } from "../paths";
import type { Assembly } from "../types";

export function AssemblyHeader({
  projectId,
  assemblies,
  activeAssembly,
  search,
  zoom,
  canEdit,
  onZoomIn,
  onZoomOut,
  onRename,
  onTypeChange,
  onDuplicate,
  onDelete,
  onFlipOrientation,
  onFlipLayers,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeAssembly: Assembly;
  search: URLSearchParams;
  zoom: number;
  canEdit: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRename: () => void;
  onTypeChange: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  const navigate = useNavigate();
  const query = createSearchParams(search).toString();
  return (
    <header className="assembly-header">
      <div>
        <label htmlFor="assembly-picker">Assembly</label>
        <select
          id="assembly-picker"
          value={activeAssembly.id}
          onChange={(event) => {
            const path = envelopeAssemblyPath(projectId, event.currentTarget.value);
            navigate(`${path}${query ? `?${query}` : ""}`);
          }}
        >
          {assemblies.map((assembly) => (
            <option key={assembly.id} value={assembly.id}>
              {assembly.name}
            </option>
          ))}
        </select>
      </div>
      <dl className="assembly-header-metrics">
        <div>
          <dt>Total thickness</dt>
          <dd data-testid="total-thickness">
            {formatLengthFromMm(totalThicknessMm(activeAssembly), { unitSystem })}
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{statusLabel(activeAssembly.status.flags)}</dd>
        </div>
      </dl>
      <div className="assembly-toolbar" aria-label="Assembly tools">
        <button
          type="button"
          className="icon-button"
          aria-label="Zoom out"
          onClick={onZoomOut}
          data-tooltip="Zoom out"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span data-testid="canvas-zoom">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="icon-button"
          aria-label="Zoom in"
          onClick={onZoomIn}
          data-tooltip="Zoom in"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <button type="button" className="secondary-button" disabled={!canEdit} onClick={onRename}>
          Rename
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!canEdit}
          onClick={onTypeChange}
        >
          Type
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!canEdit}
          onClick={onDuplicate}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!canEdit}
          onClick={onFlipOrientation}
        >
          Flip outside
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={!canEdit}
          onClick={onFlipLayers}
        >
          Flip layers
        </button>
        <button type="button" className="danger-button" disabled={!canEdit} onClick={onDelete}>
          Delete
        </button>
      </div>
    </header>
  );
}
