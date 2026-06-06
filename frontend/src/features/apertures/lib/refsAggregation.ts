// Phase 12 — collect every distinct catalog-aware ref used on any
// aperture element + the list of element usages per ref.
//
// Dedup key:
//   - catalog-sourced refs: ``catalog_origin.catalog_record_id``
//   - hand-entered refs: a per-occurrence synthetic key so each one
//     shows individually (a fresh row in the refs view).

import type { ApertureSide, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

export type RefKind = "frame_types" | "glazing_types";

export type RefUsageTarget = {
  aperture_type_id: string;
  aperture_type_name: string;
  element_id: string;
  element_name: string;
  target: string;
};

export type FrameRefUsage = {
  refSnapshot: FrameRef;
  origin: "catalog" | "hand_enter";
  catalogRecordId: string | null;
  usages: RefUsageTarget[];
};

export type GlazingRefUsage = {
  refSnapshot: GlazingRef;
  origin: "catalog" | "hand_enter";
  catalogRecordId: string | null;
  usages: RefUsageTarget[];
};

const SIDES: ApertureSide[] = ["top", "right", "bottom", "left"];

export function aggregateFrameRefs(apertures: ApertureTypeEntry[]): FrameRefUsage[] {
  const byKey = new Map<string, FrameRefUsage>();
  for (const apt of apertures) {
    for (const el of apt.elements) {
      for (const side of SIDES) {
        const ref = el.frames[side];
        if (!ref) continue;
        const recId = ref.catalog_origin?.catalog_record_id ?? null;
        const key = recId ?? `hand:${apt.id}:${el.id}:${side}`;
        const usage: RefUsageTarget = {
          aperture_type_id: apt.id,
          aperture_type_name: apt.name,
          element_id: el.id,
          element_name: el.name,
          target: `frame.${side}`,
        };
        const existing = byKey.get(key);
        if (existing) {
          existing.usages.push(usage);
        } else {
          byKey.set(key, {
            refSnapshot: ref,
            origin: recId ? "catalog" : "hand_enter",
            catalogRecordId: recId,
            usages: [usage],
          });
        }
      }
    }
  }
  return Array.from(byKey.values());
}

export function aggregateGlazingRefs(apertures: ApertureTypeEntry[]): GlazingRefUsage[] {
  const byKey = new Map<string, GlazingRefUsage>();
  for (const apt of apertures) {
    for (const el of apt.elements) {
      const ref = el.glazing;
      if (!ref) continue;
      const recId = ref.catalog_origin?.catalog_record_id ?? null;
      const key = recId ?? `hand:${apt.id}:${el.id}:glazing`;
      const usage: RefUsageTarget = {
        aperture_type_id: apt.id,
        aperture_type_name: apt.name,
        element_id: el.id,
        element_name: el.name,
        target: "glazing",
      };
      const existing = byKey.get(key);
      if (existing) {
        existing.usages.push(usage);
      } else {
        byKey.set(key, {
          refSnapshot: ref,
          origin: recId ? "catalog" : "hand_enter",
          catalogRecordId: recId,
          usages: [usage],
        });
      }
    }
  }
  return Array.from(byKey.values());
}
