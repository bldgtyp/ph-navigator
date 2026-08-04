// Per-aperture Installs modal (aperture-psi-install D-6c/d): read-only
// key-view SVG with per-edge tint overlay, pick-type-then-paint-edges,
// bulk apply, copy-to-identical-grid, and inline type creation. All
// writes go through the apertures command dispatch (drafts + conflict
// handling for free); the legend reads the `InstallTypesProvider`
// summaries so it can never disagree with the FrameRow Ψ cells. No
// builder-canvas changes; `ModalDialog` consumes Escape, so closing
// never clears the builder selection underneath.
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { useOutsidePointerDown } from "../../../shared/ui/useOutsidePointerDown";
import { formatLinearPsiFromWmK, parseLinearPsiToWmK, useUnitPreference } from "../../../lib/units";
import { psiUnitLabel } from "../../catalogs/components/unit-labels";
import type { ProjectDetail } from "../../projects/types";
import { totalApertureWidthMm } from "../aperture-geometry";
import { BASE_PX_PER_MM, pxFromMm } from "../canvas-constants";
import {
  apertureGridSignature,
  installOverlayModel,
  installTintColors,
  installUsageCounts,
  nextInstallForClick,
  DEFAULT_TINT_TOKEN,
} from "../install-overlay";
import type { ApertureCommand, ApertureSide, ApertureTypeEntry } from "../types";
import { useInstallTypeSummaries } from "../hooks/useInstallTypes";
import { useCreateInstallType } from "../installs/useCreateInstallType";
import { ApertureSvgCanvas } from "./ApertureSvgCanvas";

// Key view fits the aperture to exactly this width, which equals the SVG
// canvas MIN_CANVAS_WIDTH_PX floor — so the floor can never re-scale the
// canvas out from under the absolutely-positioned overlay. Tall apertures
// grow vertically and scroll inside the key-view column.
const KEY_VIEW_WIDTH_PX = 360;

export function InstallsModal({
  project,
  aperture,
  apertures,
  canEdit,
  onDispatch,
  onClose,
}: {
  project: ProjectDetail;
  aperture: ApertureTypeEntry;
  apertures: readonly ApertureTypeEntry[];
  canEdit: boolean;
  onDispatch: (command: ApertureCommand) => Promise<boolean>;
  onClose: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  const installTypes = useInstallTypeSummaries();
  const createInstallType = useCreateInstallType(project);
  const [armedTypeId, setArmedTypeId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const overlay = useMemo(
    () => installOverlayModel(aperture, installTypes),
    [aperture, installTypes],
  );
  const colors = useMemo(() => installTintColors(installTypes), [installTypes]);
  const usage = useMemo(() => installUsageCounts(apertures), [apertures]);
  const copyCandidates = useMemo(() => {
    const signature = apertureGridSignature(aperture);
    return apertures.filter(
      (candidate) => candidate.id !== aperture.id && apertureGridSignature(candidate) === signature,
    );
  }, [aperture, apertures]);

  const fitZoom =
    KEY_VIEW_WIDTH_PX / (Math.max(totalApertureWidthMm(aperture), 1) * BASE_PX_PER_MM);

  const dispatchGuarded = async (command: ApertureCommand) => {
    if (busy) return;
    setBusy(true);
    try {
      await onDispatch(command);
    } finally {
      setBusy(false);
    }
  };

  const handleEdgeClick = (elementId: string, side: ApertureSide, rawSlot: string | null) => {
    if (!canEdit) return;
    const next = nextInstallForClick(rawSlot, armedTypeId);
    if (next === undefined) return;
    void dispatchGuarded({
      kind: "setElementInstall",
      aperture_type_id: aperture.id,
      element_id: elementId,
      side,
      install_type_id: next,
    });
  };

  const handleCreateType = async (name: string, psiWmk: number | null) => {
    setCreateError(null);
    const error = await createInstallType.create(name, psiWmk);
    if (error) setCreateError(error);
    else setCreating(false);
  };

  const psi = (value: number | null) =>
    formatLinearPsiFromWmK(value, { unitSystem, empty: "-", showUnit: true });

  return (
    <ModalDialog
      id="installs-modal"
      title={`Installs — ${aperture.name}`}
      titleId="installs-modal-title"
      onClose={onClose}
    >
      <div className="installs-modal__body">
        <div className="installs-modal__key-view" data-testid="installs-key-view">
          <div className="installs-modal__canvas">
            <ApertureSvgCanvas aperture={aperture} zoom={fitZoom} viewDirection="exterior" />
            <div className="installs-modal__overlay">
              {overlay.map((cell) => {
                const typeName =
                  cell.kind === "mull"
                    ? "Mulled edge — Ψ-install 0 (derived)"
                    : `${cell.resolved.installTypeName ?? "Default"}${
                        cell.kind === "default" ? " (inherited default)" : ""
                      }`;
                return (
                  <button
                    key={`${cell.elementId}:${cell.side}`}
                    type="button"
                    className="installs-modal__edge"
                    data-testid={`install-edge-${cell.elementId}-${cell.side}`}
                    data-kind={cell.kind}
                    disabled={cell.kind === "mull" || busy}
                    title={typeName}
                    aria-label={`${cell.side} edge — ${typeName}`}
                    style={
                      {
                        left: `${pxFromMm(cell.rect.x, fitZoom)}px`,
                        top: `${pxFromMm(cell.rect.y, fitZoom)}px`,
                        width: `${pxFromMm(cell.rect.width, fitZoom)}px`,
                        height: `${pxFromMm(cell.rect.height, fitZoom)}px`,
                        ...(cell.color ? { "--installs-tint": cell.color } : {}),
                      } as CSSProperties
                    }
                    onClick={() => handleEdgeClick(cell.elementId, cell.side, cell.rawSlot)}
                  />
                );
              })}
            </div>
          </div>
          <p className="form-note">
            Mulled interior edges are derived Ψ = 0 and cannot carry an assignment.
          </p>
        </div>
        <div className="installs-modal__legend" data-testid="installs-legend">
          <ul className="installs-modal__type-list" aria-label="Install types">
            {installTypes.map((installType) => (
              <li key={installType.id}>
                <button
                  type="button"
                  aria-pressed={armedTypeId === installType.id}
                  className="installs-modal__type"
                  data-armed={armedTypeId === installType.id ? "true" : undefined}
                  disabled={!canEdit}
                  onClick={() =>
                    setArmedTypeId(armedTypeId === installType.id ? null : installType.id)
                  }
                >
                  <span
                    className="installs-modal__swatch"
                    style={
                      {
                        "--installs-tint": colors.get(installType.id) ?? DEFAULT_TINT_TOKEN,
                      } as CSSProperties
                    }
                    aria-hidden
                  />
                  <span className="installs-modal__type-name">
                    {installType.name ?? installType.id}
                  </span>
                  <span className="installs-modal__type-psi">{psi(installType.psi_w_mk)}</span>
                  {installType.has_pdf ? (
                    <span
                      className="chip chip--sm chip--outline"
                      title="Justification PDF attached"
                    >
                      PDF
                    </span>
                  ) : null}
                  <span className="installs-modal__type-usage">
                    {usage.get(installType.id) ?? 0} edges
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {canEdit ? (
            creating ? (
              <InlineCreateTypeForm
                busy={createInstallType.isPending}
                ready={createInstallType.ready}
                error={createError}
                onCancel={() => {
                  setCreating(false);
                  setCreateError(null);
                }}
                onCreate={(name, psiValue) => void handleCreateType(name, psiValue)}
              />
            ) : (
              <button
                type="button"
                className="text-button"
                onClick={() => setCreating(true)}
                data-testid="installs-new-type"
              >
                + New type…
              </button>
            )
          ) : null}
          <p className="form-note">
            {armedTypeId
              ? "Click perimeter edges to paint; clicking an edge that already carries the type clears it."
              : "Select a type to arm painting, or hover edges to inspect assignments."}
          </p>
        </div>
      </div>
      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!canEdit || armedTypeId === null || busy}
          onClick={() =>
            void dispatchGuarded({
              kind: "applyInstallToApertures",
              aperture_ids: [aperture.id],
              install_type_id: armedTypeId,
            })
          }
        >
          Apply selected to all edges
        </button>
        <CopyAssignmentsControl
          aperture={aperture}
          candidates={copyCandidates}
          canEdit={canEdit}
          busy={busy}
          onCopy={(targetIds) =>
            dispatchGuarded({
              kind: "copyElementInstalls",
              source_aperture_id: aperture.id,
              target_aperture_ids: targetIds,
            })
          }
        />
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
      </div>
    </ModalDialog>
  );
}

function CopyAssignmentsControl({
  aperture,
  candidates,
  canEdit,
  busy,
  onCopy,
}: {
  aperture: ApertureTypeEntry;
  candidates: readonly ApertureTypeEntry[];
  canEdit: boolean;
  busy: boolean;
  onCopy: (targetIds: string[]) => Promise<void>;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<ReadonlySet<string>>(new Set());
  useOutsidePointerDown(rootRef, open, () => setOpen(false));

  return (
    <span ref={rootRef} className="modal-actions-extra installs-modal__copy">
      <button
        type="button"
        className="secondary-button"
        disabled={!canEdit || candidates.length === 0 || busy}
        aria-expanded={open}
        aria-haspopup="true"
        title={
          candidates.length === 0
            ? "No other aperture shares this grid layout."
            : `Copy ${aperture.name}'s assignments to identical-grid apertures.`
        }
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        Copy assignments to…
      </button>
      {open ? (
        <div className="installs-modal__copy-popover" role="group" aria-label="Copy targets">
          {candidates.map((candidate) => (
            <label key={candidate.id} className="installs-modal__copy-option">
              <input
                type="checkbox"
                checked={targets.has(candidate.id)}
                onChange={(event) => {
                  const next = new Set(targets);
                  if (event.target.checked) next.add(candidate.id);
                  else next.delete(candidate.id);
                  setTargets(next);
                }}
              />
              {candidate.name}
            </label>
          ))}
          <button
            type="button"
            className="primary-button"
            disabled={targets.size === 0 || busy}
            onClick={() => {
              void onCopy([...targets]).then(() => {
                setOpen(false);
                setTargets(new Set());
              });
            }}
          >
            Copy
          </button>
        </div>
      ) : null}
    </span>
  );
}

function InlineCreateTypeForm({
  busy,
  ready,
  error,
  onCancel,
  onCreate,
}: {
  busy: boolean;
  ready: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (name: string, psiWmk: number | null) => void;
}) {
  const { unitSystem } = useUnitPreference();
  const [name, setName] = useState("");
  const [psiText, setPsiText] = useState("");
  // Empty Ψ is allowed (stored null → resolver degradation warning);
  // non-empty input parses through the unit-aware helper so IP-mode
  // entries convert to SI instead of being stored as-typed.
  const parsed = psiText.trim() === "" ? null : parseLinearPsiToWmK(psiText, { unitSystem });
  const psiError = parsed !== null && !parsed.ok ? parsed.message : null;
  return (
    <form
      className="installs-modal__create"
      data-testid="installs-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === "" || psiError !== null) return;
        onCreate(name.trim(), parsed?.ok ? parsed.valueSi : null);
      }}
    >
      <input
        type="text"
        value={name}
        placeholder="Type name"
        aria-label="New install type name"
        onChange={(event) => setName(event.target.value)}
      />
      <input
        type="text"
        inputMode="decimal"
        value={psiText}
        placeholder={`Ψ ${psiUnitLabel(unitSystem)}`}
        aria-label={`New install type psi-value in ${psiUnitLabel(unitSystem)}`}
        onChange={(event) => setPsiText(event.target.value)}
      />
      {error || psiError ? (
        <p className="form-error" role="alert">
          {error ?? psiError}
        </p>
      ) : null}
      <div className="installs-modal__create-actions">
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="primary-button"
          disabled={busy || !ready || name.trim() === ""}
        >
          Create
        </button>
      </div>
    </form>
  );
}
