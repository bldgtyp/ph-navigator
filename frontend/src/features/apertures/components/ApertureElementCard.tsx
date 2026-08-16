// One full element card composing name row, U-Value chip, glazing row,
// four frame rows (top / right / bottom / left), and an operation row.
//
// The card surfaces five dispatch callbacks that the parent stack
// fans into the page-level command dispatch.

import { InlineHeaderNameEditor } from "../../../shared/ui/InlineHeaderNameEditor";
import { EMPTY_PANEL_CAPTION, EMPTY_PANEL_EXPLANATION } from "../empty-panel";
import type {
  ApertureElement,
  ApertureElementKind,
  ApertureSide,
  FrameRef,
  GlazingRef,
} from "../types";
import { APERTURE_SIDES } from "../types";
import type { ViewDirection } from "../frame-label-map";
import { FrameRow } from "./FrameRow";
import { GlazingRow } from "./GlazingRow";
import { OperationRow } from "./OperationRow";
import { OperationWarningBanner } from "./OperationWarningBanner";
import type { ApertureOperation } from "../types";
import { mismatchedSides } from "../operation-frame-match";
import { UValueChip } from "./UValueChip";
import { useUnitPreference } from "../../../lib/units";
import type { UnitSystem } from "../../../lib/units";
import { edgeClassKey } from "../edge-classification";
import type { ResolvedInstallPsi } from "../install-psi";

export type ApertureElementCardProps = {
  element: ApertureElement;
  viewDirection: ViewDirection;
  canEdit: boolean;
  isSelected: boolean;
  onSetName: (newName: string) => void;
  onPickFrame: (side: ApertureSide, frame: FrameRef) => void;
  onPickGlazing: (glazing: GlazingRef) => void;
  onSetOperation: (operation: ApertureOperation | null) => void;
  onSetKind: (kind: ApertureElementKind) => void;
  commandBusy?: boolean;
  operationWarningDismissed: boolean;
  onDismissOperationWarning: () => void;
  uValueWm2k?: number | null;
  /** Per-aperture effective Ψ-install resolution keyed by
   *  `edgeClassKey(elementId, side)`; undefined when the parent has no
   *  install-type data (frame rows then show "-"). */
  installResolution?: Map<string, ResolvedInstallPsi>;
};

export function ApertureElementCard({
  element,
  viewDirection,
  canEdit,
  isSelected,
  onSetName,
  onPickFrame,
  onPickGlazing,
  onSetOperation,
  onSetKind,
  commandBusy = false,
  operationWarningDismissed,
  onDismissOperationWarning,
  uValueWm2k,
  installResolution,
}: ApertureElementCardProps) {
  const { unitSystem } = useUnitPreference();
  const mismatched = operationWarningDismissed ? [] : mismatchedSides(element);
  const uValueUnit = uValueUnitLabel(unitSystem);
  const widthUnit = widthUnitLabel(unitSystem);
  const psiUnit = psiInstallUnitLabel(unitSystem);
  const kindControl = kindControlFor(element.kind);
  const kindContent = (() => {
    switch (element.kind) {
      case "void":
        return (
          <p className="aperture-element-card__void-caption" title={EMPTY_PANEL_EXPLANATION}>
            {EMPTY_PANEL_CAPTION}
          </p>
        );
      case "glazed":
        return (
          <>
            <div
              className="aperture-element-table"
              role="table"
              aria-label={`${element.name} details`}
            >
              <div className="aperture-element-table__head" role="row">
                <span role="columnheader">Element</span>
                <span role="columnheader">Name</span>
                <MetricColumnHeader label="U-Value" unit={uValueUnit} />
                <MetricColumnHeader label="Width" unit={widthUnit} />
                <span role="columnheader">g-Value</span>
                <MetricColumnHeader label="Ψ-inst" unit={psiUnit} />
              </div>
              <GlazingRow glazing={element.glazing} canEdit={canEdit} onPick={onPickGlazing} />
              {APERTURE_SIDES.map((side) => {
                const isMismatch = !operationWarningDismissed && mismatched.includes(side);
                return (
                  <FrameRow
                    key={side}
                    side={side}
                    viewDirection={viewDirection}
                    frame={element.frames[side]}
                    operation={element.operation}
                    canEdit={canEdit}
                    mismatchIndicator={
                      isMismatch
                        ? mismatchTooltip(element.frames[side]?.operation, element.operation)
                        : null
                    }
                    install={installResolution?.get(edgeClassKey(element.id, side)) ?? null}
                    onPick={(frame) => onPickFrame(side, frame)}
                  />
                );
              })}
              <OperationRow
                operation={element.operation}
                canEdit={canEdit}
                onCommit={onSetOperation}
              />
            </div>
            {!operationWarningDismissed && (
              <OperationWarningBanner
                mismatchedSides={mismatched}
                onDismiss={onDismissOperationWarning}
              />
            )}
          </>
        );
    }
  })();

  return (
    <div
      className="aperture-element-card"
      data-element-id={element.id}
      data-testid={`element-card-${element.id}`}
      data-selected={isSelected ? "true" : undefined}
    >
      <div className="aperture-element-card__header" data-reveal-edit-on-hover>
        <InlineHeaderNameEditor
          className="aperture-element-card__name"
          variant="inline"
          value={element.name}
          fallbackValue="Unnamed"
          canEdit={canEdit}
          busy={false}
          editLabel={`Rename ${element.name || "element"}`}
          inputLabel="Element name"
          getValidationMessage={(value) => {
            if (value.length === 0) return "Element name is required.";
            return null;
          }}
          onSubmit={onSetName}
        />
        <span className="aperture-element-card__header-actions">
          {kindControl.showUValue ? (
            <span className="aperture-element-card__summary-uvalue">
              U-w:{" "}
              <UValueChip
                valueWm2k={uValueWm2k ?? null}
                unitSystem={unitSystem === "IP" ? "ip" : "si"}
                compact
              />
            </span>
          ) : null}
          <button
            type="button"
            role="switch"
            className="aperture-element-kind-toggle"
            aria-checked={kindControl.checked}
            aria-label={kindControl.label}
            title={EMPTY_PANEL_EXPLANATION}
            disabled={!canEdit || commandBusy}
            onClick={() => onSetKind(kindControl.target)}
          >
            Empty
          </button>
        </span>
      </div>
      {kindContent}
    </div>
  );
}

function kindControlFor(kind: ApertureElementKind): {
  checked: boolean;
  label: string;
  showUValue: boolean;
  target: ApertureElementKind;
} {
  switch (kind) {
    case "glazed":
      return {
        checked: false,
        label: "Mark element Empty",
        showUValue: true,
        target: "void",
      };
    case "void":
      return {
        checked: true,
        label: "Mark element Glazed",
        showUValue: false,
        target: "glazed",
      };
  }
}

function MetricColumnHeader({ label, unit }: { label: string; unit: string }) {
  return (
    <span role="columnheader" aria-label={`${label} [${unit}]`}>
      <span>{label}</span>
      <span className="aperture-element-table__head-unit">[{unit}]</span>
    </span>
  );
}

function uValueUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(h-ft2-F)" : "W/(m2-K)";
}

function widthUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "in" : "mm";
}

function psiInstallUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === "IP" ? "Btu/(h-ft-F)" : "W/(m-K)";
}

function mismatchTooltip(
  frameOperation: string | null | undefined,
  elementOperation: ApertureElement["operation"],
): string {
  const elementLabel =
    elementOperation === null
      ? "Fixed"
      : `${elementOperation.type.charAt(0).toUpperCase()}${elementOperation.type.slice(1)}`;
  return `Frame catalog operation was '${frameOperation ?? "?"}'; element operation is now '${elementLabel}'.`;
}
