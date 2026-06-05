// One row inside an element card for a per-side frame slot.
// Composes label, FramePicker, CatalogBadges, headline column values
// (width / U-value / psi_g), and a More fields expander with the rest
// of the field set per PRD §11.2 / §12.

import type { ApertureSide, ApertureOperation, FrameRef } from "../types";
import { CatalogBadges } from "./CatalogBadges";
import { FramePicker } from "./FramePicker";
import { InlineOverrideInput } from "./InlineOverrideInput";
import { MoreFieldsExpander } from "./MoreFieldsExpander";
import { frameRowLabel, type ViewDirection } from "../frame-label-map";

export type FrameRowProps = {
  side: ApertureSide;
  viewDirection: ViewDirection;
  frame: FrameRef | null;
  operation: ApertureOperation | null;
  canEdit: boolean;
  onPick: (frame: FrameRef) => void;
  onEditField: (fieldKey: string, value: string | number | null) => void;
};

const FRAME_MORE_FIELDS: { key: string; label: string; kind: "string" | "number" }[] = [
  { key: "manufacturer", label: "Manufacturer", kind: "string" },
  { key: "brand", label: "Brand", kind: "string" },
  { key: "use", label: "Use", kind: "string" },
  { key: "operation", label: "Operation", kind: "string" },
  { key: "location", label: "Location", kind: "string" },
  { key: "mull_type", label: "Mull type", kind: "string" },
  { key: "psi_install_w_mk", label: "Ψ install (W/mK)", kind: "number" },
  { key: "color", label: "Color", kind: "string" },
  { key: "source", label: "Source / datasheet URL", kind: "string" },
  { key: "comments", label: "Comments", kind: "string" },
];

export function FrameRow({
  side,
  viewDirection,
  frame,
  operation,
  canEdit,
  onPick,
  onEditField,
}: FrameRowProps) {
  const overrides = new Set(frame?.catalog_origin?.local_overrides ?? []);
  return (
    <div className="aperture-card-row aperture-card-row--frame" data-testid={`frame-row-${side}`}>
      <div className="aperture-card-row__label">{frameRowLabel(side, viewDirection)}:</div>
      <div className="aperture-card-row__main">
        <FramePicker
          side={side}
          operation={operation}
          currentName={frame?.name ?? null}
          disabled={!canEdit}
          onPick={onPick}
        />
        <CatalogBadges
          origin={frame?.catalog_origin ?? null}
          datasheetUrl={frame?.source ?? null}
        />
      </div>
      {frame && (
        <div className="aperture-card-row__columns">
          <InlineOverrideInput
            fieldKey="width_mm"
            label="Width (mm)"
            value={frame.width_mm}
            kind="number"
            overridden={overrides.has("width_mm")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("width_mm", v)}
          />
          <InlineOverrideInput
            fieldKey="u_value_w_m2k"
            label="U (W/m²K)"
            value={frame.u_value_w_m2k}
            kind="number"
            overridden={overrides.has("u_value_w_m2k")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("u_value_w_m2k", v)}
          />
          <InlineOverrideInput
            fieldKey="psi_g_w_mk"
            label="Ψ glass (W/mK)"
            value={frame.psi_g_w_mk}
            kind="number"
            overridden={overrides.has("psi_g_w_mk")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("psi_g_w_mk", v)}
          />
        </div>
      )}
      {frame && (
        <MoreFieldsExpander>
          <InlineOverrideInput
            fieldKey="name"
            label="Name"
            value={frame.name}
            kind="string"
            overridden={overrides.has("name")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("name", v)}
          />
          {FRAME_MORE_FIELDS.map((f) => (
            <InlineOverrideInput
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              value={(frame as unknown as Record<string, string | number | null>)[f.key] ?? null}
              kind={f.kind}
              overridden={overrides.has(f.key)}
              disabled={!canEdit}
              onCommit={(v) => onEditField(f.key, v)}
            />
          ))}
        </MoreFieldsExpander>
      )}
    </div>
  );
}
