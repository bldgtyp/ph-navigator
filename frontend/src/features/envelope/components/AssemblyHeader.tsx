import {
  ArrowLeftRight,
  ArrowUpDown,
  Copy,
  Download,
  FlipVertical2,
  type LucideIcon,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Shapes,
  Trash2,
  Undo2,
} from "lucide-react";
import { createSearchParams, useNavigate } from "react-router-dom";
import {
  formatLengthFromMm,
  formatRValueFromM2KPerW,
  formatUValueFromWm2K,
  useUnitPreference,
} from "../../../lib/units";
import { statusLabel, totalThicknessMm } from "../lib";
import { envelopeAssemblyPath } from "../paths";
import type { AssemblyCanvasPaintController } from "../canvas-paint";
import type { Assembly, AssemblyThermalResponse } from "../types";

export function AssemblyHeader({
  projectId,
  assemblies,
  activeAssembly,
  search,
  zoom,
  canEdit,
  thermal,
  thermalLoading,
  exportBusy,
  commandBusy,
  paint,
  onZoomIn,
  onZoomOut,
  onExportHbjson,
  onRename,
  onTypeChange,
  onDuplicate,
  onDelete,
  onFlipOrientation,
  onFlipLayers,
  onFlipSegments,
}: {
  projectId: string;
  assemblies: Assembly[];
  activeAssembly: Assembly;
  search: URLSearchParams;
  zoom: number;
  canEdit: boolean;
  thermal: AssemblyThermalResponse | null;
  thermalLoading: boolean;
  exportBusy: boolean;
  commandBusy: boolean;
  paint: AssemblyCanvasPaintController;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExportHbjson: () => void;
  onRename: () => void;
  onTypeChange: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFlipOrientation: () => void;
  onFlipLayers: () => void;
  onFlipSegments: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  const navigate = useNavigate();
  const query = createSearchParams(search).toString();
  const thermalLabel = formatThermalLabel(thermal, thermalLoading, unitSystem);
  const commandDisabled = !canEdit || commandBusy;
  const flipDisabled = commandDisabled || paint.mode === "picking" || paint.mode === "pasting";
  return (
    <header className="assembly-header">
      <div className="assembly-picker-field">
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
        <div>
          <dt>Thermal</dt>
          <dd title={thermalTooltip(thermal)} data-testid="assembly-thermal-label">
            {thermalLabel}
          </dd>
        </div>
      </dl>
      <div className="assembly-toolbar" aria-label="Assembly tools">
        <AssemblyToolButton label="Zoom out" tooltip="Zoom out" icon={Minus} onClick={onZoomOut} />
        <span data-testid="canvas-zoom">{Math.round(zoom * 100)}%</span>
        <AssemblyToolButton label="Zoom in" tooltip="Zoom in" icon={Plus} onClick={onZoomIn} />
        <AssemblyToolButton
          label="Pick segment assignment"
          tooltip="Pick assignment"
          icon={Pipette}
          disabled={!canEdit}
          pressed={paint.mode === "picking"}
          onClick={paint.mode === "picking" ? paint.clear : paint.startPicking}
        />
        <AssemblyToolButton
          label="Paint picked assignment"
          tooltip="Paint assignment"
          icon={PaintBucket}
          disabled={!canEdit || !paint.canStartPasting}
          pressed={paint.mode === "pasting"}
          onClick={paint.mode === "pasting" ? paint.clear : paint.startPasting}
        />
        <AssemblyToolButton
          label="Undo last paint"
          tooltip="Undo last paint"
          icon={Undo2}
          disabled={commandDisabled || !paint.canUndoPaint}
          onClick={paint.undoLastPaint}
        />
        <AssemblyToolButton
          label="Download constructions HBJSON"
          tooltip="Download constructions (HBJSON)"
          icon={Download}
          disabled={exportBusy}
          onClick={onExportHbjson}
        />
        <AssemblyToolButton
          label="Rename"
          tooltip="Rename assembly"
          icon={Pencil}
          disabled={commandDisabled}
          onClick={onRename}
        />
        <AssemblyToolButton
          label="Type"
          tooltip="Change assembly type"
          icon={Shapes}
          disabled={commandDisabled}
          onClick={onTypeChange}
        />
        <AssemblyToolButton
          label="Duplicate"
          tooltip="Duplicate assembly"
          icon={Copy}
          disabled={commandDisabled}
          onClick={onDuplicate}
        />
        <AssemblyToolButton
          label="Flip outside"
          tooltip="Flip outside"
          icon={ArrowUpDown}
          disabled={flipDisabled}
          onClick={onFlipOrientation}
        />
        <AssemblyToolButton
          label="Flip layers"
          tooltip="Flip layers"
          icon={FlipVertical2}
          disabled={flipDisabled}
          onClick={onFlipLayers}
        />
        <AssemblyToolButton
          label="Flip segments"
          tooltip="Flip segments"
          icon={ArrowLeftRight}
          disabled={flipDisabled}
          onClick={onFlipSegments}
        />
        <button
          type="button"
          className="danger-button assembly-delete-button"
          disabled={commandDisabled}
          aria-label="Delete"
          data-tooltip="Delete assembly"
          onClick={onDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </div>
    </header>
  );
}

function AssemblyToolButton({
  label,
  tooltip,
  icon: Icon,
  disabled = false,
  pressed,
  onClick,
}: {
  label: string;
  tooltip: string;
  icon: LucideIcon;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      aria-pressed={pressed ?? undefined}
      data-tooltip={tooltip}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

function formatThermalLabel(
  thermal: AssemblyThermalResponse | null,
  loading: boolean,
  unitSystem: "IP" | "SI",
): string {
  if (loading) return "Calculating";
  if (!thermal) return "Unavailable";
  if (thermal.r_effective_m2k_w === null || thermal.u_effective_w_m2k === null) {
    return statusLabel(thermal.status.flags);
  }
  const value =
    unitSystem === "IP"
      ? formatRValueFromM2KPerW(thermal.r_effective_m2k_w, {
          unitSystem,
          fractionDigits: 1,
        })
      : formatUValueFromWm2K(thermal.u_effective_w_m2k, {
          unitSystem,
          fractionDigits: 3,
        });
  return thermal.status.is_complete ? value : `${value} (${statusLabel(thermal.status.flags)})`;
}

function thermalTooltip(thermal: AssemblyThermalResponse | null): string {
  if (!thermal) return "Construction-only thermal value. Surface films are excluded.";
  return [
    "Construction-only PH average of Parallel-Path and Isothermal-Planes. Surface films are excluded.",
    ...thermal.warnings,
  ].join(" ");
}
