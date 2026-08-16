// Per-aperture Installs modal (aperture-psi-install D-6c/d): read-only
// key-view SVG with per-edge tint overlay, pick-type-then-paint-edges,
// bulk apply, copy-to-identical-grid, and inline type create/edit. Every
// edit is *staged* (`installs-draft.ts`) and written only on Save, so
// Cancel — and `ModalDialog`'s Escape — discards the whole session; the
// legend reads the `InstallTypesProvider` summaries with the staged edits
// laid over them, so it can never disagree with the FrameRow Ψ cells. No
// builder-canvas changes; closing never clears the builder selection.
import { useMemo, useState, type CSSProperties } from "react";
import { Pencil } from "lucide-react";
import { DialogActions } from "../../../shared/ui/DialogActions";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { TOOLTIP_HOVER_DELAY, Tooltip } from "../../../shared/ui/tooltip";
import { formatLinearPsiFromWmK, useUnitPreference } from "../../../lib/units";
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
import {
  EMPTY_INSTALLS_DRAFT,
  draftApertureEntry,
  draftInstallTypes,
  installsDraftCommands,
  installsDraftIsDirty,
  stageInstall,
  stageTypeCreate,
  stageTypeEdit,
} from "../installs-draft";
import { APERTURE_INSTALL_DEFAULT_TYPE_ID } from "../install-psi";
import type { ApertureCommand, ApertureSide, ApertureTypeEntry } from "../types";
import { useInstallTypeSummaries } from "../hooks/useInstallTypes";
import { newInstallTypeId, useInstallTypeWrites } from "../installs/useInstallTypeWrites";
import { ApertureSvgCanvas } from "./ApertureSvgCanvas";
import { CopyInstallsControl } from "./CopyInstallsControl";
import { InstallTypeForm } from "./InstallTypeForm";

// Key view fits the aperture to exactly this width, which equals the SVG
// canvas MIN_CANVAS_WIDTH_PX floor — so the floor can never re-scale the
// canvas out from under the absolutely-positioned overlay. Tall apertures
// grow vertically and scroll inside the key-view column.
const KEY_VIEW_WIDTH_PX = 360;

// Fallback band thickness for a side with no picked frame, in rendered pixels
// (converted to mm at the key view's zoom). Frame-carrying sides use the drawn
// strip verbatim, so this only ever backfills an otherwise invisible edge.
const MIN_BAND_PX = 8;

export function InstallsModal({
  project,
  aperture,
  apertures,
  canEdit,
  onDispatchAll,
  onClose,
}: {
  project: ProjectDetail;
  aperture: ApertureTypeEntry;
  apertures: readonly ApertureTypeEntry[];
  canEdit: boolean;
  /** Apply the staged commands in order as one user action. */
  onDispatchAll: (commands: readonly ApertureCommand[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const { unitSystem } = useUnitPreference();
  const savedTypes = useInstallTypeSummaries();
  const installTypeWrites = useInstallTypeWrites(project);
  const [armedTypeId, setArmedTypeId] = useState<string | null>(null);
  // At most one inline form is open: the create form, or one row's editor.
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [draft, setDraft] = useState(EMPTY_INSTALLS_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const installTypes = useMemo(() => draftInstallTypes(savedTypes, draft), [savedTypes, draft]);
  const stagedAperture = useMemo(() => draftApertureEntry(aperture, draft), [aperture, draft]);
  const armedTypeName =
    installTypes.find((installType) => installType.id === armedTypeId)?.name ?? "the armed type";

  const colors = useMemo(() => installTintColors(installTypes), [installTypes]);
  const usage = useMemo(
    () =>
      installUsageCounts(
        apertures.map((entry) => (entry.id === aperture.id ? stagedAperture : entry)),
      ),
    [apertures, aperture.id, stagedAperture],
  );
  const copyCandidates = useMemo(() => {
    const signature = apertureGridSignature(aperture);
    return apertures.filter(
      (candidate) => candidate.id !== aperture.id && apertureGridSignature(candidate) === signature,
    );
  }, [aperture, apertures]);

  const fitZoom =
    KEY_VIEW_WIDTH_PX / (Math.max(totalApertureWidthMm(aperture), 1) * BASE_PX_PER_MM);
  const overlay = useMemo(
    () =>
      installOverlayModel(stagedAperture, installTypes, MIN_BAND_PX / (BASE_PX_PER_MM * fitZoom)),
    [stagedAperture, installTypes, fitZoom],
  );

  const handleEdgeClick = (elementId: string, side: ApertureSide, rawSlot: string | null) => {
    if (!canEdit) return;
    const next = nextInstallForClick(rawSlot, armedTypeId);
    if (next === undefined) return;
    setDraft((current) => stageInstall(current, elementId, side, next));
  };

  const handleApplyToAllEdges = () => {
    if (!canEdit || armedTypeId === null) return;
    setDraft((current) =>
      overlay.reduce(
        (next, cell) =>
          cell.kind === "mull" ? next : stageInstall(next, cell.elementId, cell.side, armedTypeId),
        current,
      ),
    );
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (draft.creates.length > 0 || draft.patches.size > 0) {
        const error = await installTypeWrites.commit(draft.creates, [...draft.patches.values()]);
        if (error) {
          setSaveError(error);
          return;
        }
      }
      // Types first: an edge command may reference a row created above.
      const commands = installsDraftCommands(aperture, draft);
      if (commands.length > 0 && !(await onDispatchAll(commands))) {
        setSaveError("Could not save the edge assignments.");
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const psi = (value: number | null) =>
    formatLinearPsiFromWmK(value, { unitSystem, empty: "-", showUnit: true });
  // The row an edge with no explicit slot resolves to
  // (`resolveInstallPsiForAperture` rung 3). It is an ordinary legend row —
  // only its name is needed here, for the paint hint.
  const defaultTypeName =
    installTypes.find((installType) => installType.id === APERTURE_INSTALL_DEFAULT_TYPE_ID)?.name ??
    "Default";
  // Prefill for the Ψ input: the display-unit number with no unit suffix. An
  // untouched field is never written back (see `stageTypeEdit`), so the
  // formatter's rounding can't quantize a value the user did not edit.
  const psiInput = (value: number | null) =>
    formatLinearPsiFromWmK(value, { unitSystem, empty: "", showUnit: false });

  return (
    <ModalDialog
      id="installs-modal"
      title={`Installs — ${aperture.name}`}
      titleId="installs-modal-title"
      onClose={onClose}
      // The type library grows with the project; only the list scrolls, so the
      // key view and Cancel/Save stay put.
      scrollBody
      headerAccessory={
        <CopyInstallsControl
          aperture={aperture}
          candidates={copyCandidates}
          canEdit={canEdit}
          busy={saving}
          staged={draft.copyTargets}
          onStage={(targetIds) => setDraft((current) => ({ ...current, copyTargets: targetIds }))}
        />
      }
    >
      <div className="installs-modal__body">
        <div className="installs-modal__key-view" data-testid="installs-key-view">
          <div className="installs-modal__canvas" data-armed={armedTypeId ? "true" : undefined}>
            <ApertureSvgCanvas aperture={aperture} zoom={fitZoom} viewDirection="exterior" />
            <div className="installs-modal__overlay">
              {overlay.map((cell) => {
                // An edge with no explicit slot *is* Default — same name, same
                // Ψ, same swatch as any other row, so it is described the same
                // way. There is no separate "cleared" state to explain.
                const typeName =
                  cell.kind === "mull"
                    ? "Mulled edge — Ψ-install 0 (derived)"
                    : `${cell.resolved.installTypeName ?? defaultTypeName} (${psi(cell.resolved.psiWmk)})`;
                return (
                  <button
                    key={`${cell.elementId}:${cell.side}`}
                    type="button"
                    className="installs-modal__edge"
                    data-testid={`install-edge-${cell.elementId}-${cell.side}`}
                    data-kind={cell.kind}
                    disabled={cell.kind === "mull" || saving}
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
          {/* Painting status + its bulk action sit under the drawing they act
              on; the footer is the dialog's own Cancel/Save. */}
          <div className="installs-modal__paint-bar" data-armed={armedTypeId ? "true" : undefined}>
            <p className="installs-modal__paint-hint">
              {armedTypeId
                ? `Click edges to paint “${armedTypeName}” — click a painted edge again to set it back to ${defaultTypeName}.`
                : "Select a type to arm painting, or hover edges to inspect assignments."}
            </p>
            {/* Always rendered, enabled only while a type is armed: appearing
                and disappearing moved the key view under the cursor. The
                tooltip anchor keeps the hint reachable while it is disabled —
                that is exactly when "why can't I click this?" gets asked. */}
            <Tooltip
              content={
                armedTypeId
                  ? `Put “${armedTypeName}” on every perimeter edge of this aperture (mulled edges are skipped).`
                  : "Select a type in the list first — this puts it on every perimeter edge of this aperture."
              }
            >
              <span className="installs-modal__tooltip-anchor">
                <button
                  type="button"
                  className="secondary-button installs-modal__paint-action"
                  disabled={!canEdit || armedTypeId === null || saving}
                  onClick={handleApplyToAllEdges}
                >
                  Apply to all edges
                </button>
              </span>
            </Tooltip>
          </div>
        </div>
        <div className="installs-modal__legend" data-testid="installs-legend">
          <h3 className="installs-modal__legend-title" id="installs-modal-types">
            Install types
          </h3>
          <ul className="installs-modal__type-list" aria-labelledby="installs-modal-types">
            {installTypes.map((installType) => {
              const name = installType.name ?? installType.id;
              const edges = usage.get(installType.id) ?? 0;
              const isEditing = editing === installType.id;
              return (
                <li
                  key={installType.id}
                  className={
                    isEditing
                      ? "installs-modal__type-row installs-modal__type-row--editing"
                      : "installs-modal__type-row"
                  }
                  data-armed={armedTypeId === installType.id ? "true" : undefined}
                >
                  {isEditing ? (
                    <InstallTypeForm
                      testId="installs-edit-form"
                      initialName={installType.name ?? ""}
                      initialPsiText={psiInput(installType.psi_w_mk)}
                      submitTitle={`Save ${name}`}
                      // Usage belongs where you are deciding about the type,
                      // and it is a project-wide number — not a fact about the
                      // aperture on screen, which is what the legend implied.
                      usageNote={`Used on ${edges} ${edges === 1 ? "edge" : "edges"} in this project`}
                      onCancel={() => setEditing(null)}
                      onSubmit={(nextName, psiValue, psiEdited) => {
                        setDraft((current) =>
                          stageTypeEdit(current, installType.id, nextName, psiValue, psiEdited),
                        );
                        setEditing(null);
                      }}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-pressed={armedTypeId === installType.id}
                        className="installs-modal__type"
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
                        <span className="installs-modal__type-name">{name}</span>
                        <span className="installs-modal__type-psi">
                          {psi(installType.psi_w_mk)}
                        </span>
                        {installType.has_pdf ? (
                          <span
                            className="chip chip--sm chip--outline"
                            title="Justification PDF attached"
                          >
                            PDF
                          </span>
                        ) : null}
                      </button>
                      {canEdit ? (
                        <Tooltip
                          content={`Rename or re-value “${name}”`}
                          hoverDelay={TOOLTIP_HOVER_DELAY.long}
                        >
                          <button
                            type="button"
                            className="installs-modal__type-action"
                            data-testid={`installs-edit-type-${installType.id}`}
                            aria-label={`Edit install type: ${name}`}
                            // Editing a row also arms it: the row you are
                            // working on is the row highlighted in the key view.
                            onClick={() => {
                              setArmedTypeId(installType.id);
                              setEditing(installType.id);
                            }}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            editing === "new" ? (
              <InstallTypeForm
                testId="installs-create-form"
                className="installs-modal__create--panel"
                initialName=""
                initialPsiText=""
                submitTitle="Create install type"
                onCancel={() => setEditing(null)}
                onSubmit={(name, psiValue) => {
                  setDraft((current) =>
                    stageTypeCreate(current, { id: newInstallTypeId(), name, psiWmk: psiValue }),
                  );
                  setEditing(null);
                }}
              />
            ) : (
              <Tooltip content="Add a Ψ-install type to this project's library. It becomes paintable straight away and is written when you save.">
                <button
                  type="button"
                  className="installs-modal__new-type"
                  onClick={() => setEditing("new")}
                  data-testid="installs-new-type"
                >
                  + New type…
                </button>
              </Tooltip>
            )
          ) : null}
          {draft.copyTargets.length > 0 ? (
            <p className="installs-modal__staged-copy">
              Saving also copies these assignments to {draft.copyTargets.length}{" "}
              {draft.copyTargets.length === 1 ? "aperture" : "apertures"}.{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => setDraft((current) => ({ ...current, copyTargets: [] }))}
              >
                Undo
              </button>
            </p>
          ) : null}
        </div>
      </div>
      <DialogActions
        busy={saving}
        error={saveError}
        submitLabel={saving ? "Saving…" : "Save"}
        onClose={onClose}
        onConfirm={() => void handleSave()}
        submitDisabled={!canEdit || !installsDraftIsDirty(draft) || !installTypeWrites.ready}
      />
    </ModalDialog>
  );
}
