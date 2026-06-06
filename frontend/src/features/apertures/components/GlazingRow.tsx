// Glazing row in an element card. Mirrors ``FrameRow`` with the
// glazing-specific column set (U-value, g-value, name).

import type { GlazingRef } from "../types";
import { CatalogBadges } from "./CatalogBadges";
import { GlazingPicker } from "./GlazingPicker";
import { InlineOverrideInput } from "./InlineOverrideInput";
import { MoreFieldsExpander } from "./MoreFieldsExpander";

export type GlazingRowProps = {
  glazing: GlazingRef | null;
  canEdit: boolean;
  /** Phase 12: threaded into CatalogBadges so the drift badge can look
   *  up the live entry from DriftContext. */
  elementId?: string;
  onPick: (glazing: GlazingRef) => void;
  onEditField: (fieldKey: string, value: string | number | null) => void;
};

const GLAZING_MORE_FIELDS: { key: string; label: string; kind: "string" | "number" }[] = [
  { key: "manufacturer", label: "Manufacturer", kind: "string" },
  { key: "brand", label: "Brand", kind: "string" },
  { key: "suffix", label: "Suffix", kind: "string" },
  { key: "color", label: "Color", kind: "string" },
  { key: "source", label: "Source / datasheet URL", kind: "string" },
  { key: "comments", label: "Comments", kind: "string" },
];

export function GlazingRow({ glazing, canEdit, elementId, onPick, onEditField }: GlazingRowProps) {
  const overrides = new Set(glazing?.catalog_origin?.local_overrides ?? []);
  return (
    <div className="aperture-card-row aperture-card-row--glazing" data-testid="glazing-row">
      <div className="aperture-card-row__label">Glazing:</div>
      <div className="aperture-card-row__main">
        <GlazingPicker currentName={glazing?.name ?? null} disabled={!canEdit} onPick={onPick} />
        <CatalogBadges
          origin={glazing?.catalog_origin ?? null}
          datasheetUrl={glazing?.source ?? null}
          elementId={elementId}
          target="glazing"
        />
      </div>
      {glazing && (
        <div className="aperture-card-row__columns">
          <InlineOverrideInput
            fieldKey="u_value_w_m2k"
            label="U (W/m²K)"
            value={glazing.u_value_w_m2k}
            kind="number"
            overridden={overrides.has("u_value_w_m2k")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("u_value_w_m2k", v)}
          />
          <InlineOverrideInput
            fieldKey="g_value"
            label="g (–)"
            value={glazing.g_value}
            kind="number"
            overridden={overrides.has("g_value")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("g_value", v)}
          />
        </div>
      )}
      {glazing && (
        <MoreFieldsExpander>
          <InlineOverrideInput
            fieldKey="name"
            label="Name"
            value={glazing.name}
            kind="string"
            overridden={overrides.has("name")}
            disabled={!canEdit}
            onCommit={(v) => onEditField("name", v)}
          />
          {GLAZING_MORE_FIELDS.map((f) => (
            <InlineOverrideInput
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              value={(glazing as unknown as Record<string, string | number | null>)[f.key] ?? null}
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
