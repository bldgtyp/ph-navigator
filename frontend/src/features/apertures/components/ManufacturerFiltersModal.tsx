// Phase 11 — modal that edits ``tables.manufacturer_filters``.
//
// Two side-by-side checkbox columns (Frame Manufacturers + Glazing
// Manufacturers) drive the per-document enabled lists. The user opens
// the modal from the Aperture header's overflow menu; saving dispatches
// a ``setManufacturerFilters`` command through the existing aperture
// command pipeline. Locked / Viewer states render the modal read-only.
//
// Error handling: in-use enforcement happens on both sides. The client
// guards Clear-all (preserves in-use rows) and the server re-validates
// on every save so a stale tab can't strand picks.

import { useEffect, useState } from "react";
import type { ApertureTypeEntry, ManufacturerFilters } from "../types";
import { useManufacturerRoster } from "../hooks/useManufacturerRoster";
import { inUseManufacturers } from "../lib/inUseManufacturers";
import { ManufacturerColumn } from "./ManufacturerColumn";

export type ManufacturerFiltersModalProps = {
  open: boolean;
  apertures: ApertureTypeEntry[];
  filters: ManufacturerFilters | null;
  readOnly?: boolean;
  onSave: (next: ManufacturerFilters) => void | Promise<void>;
  onClose: () => void;
};

export function ManufacturerFiltersModal({
  open,
  apertures,
  filters,
  readOnly = false,
  onSave,
  onClose,
}: ManufacturerFiltersModalProps) {
  const frameRoster = useManufacturerRoster("frame_types", open);
  const glazingRoster = useManufacturerRoster("glazing_types", open);

  const [draft, setDraft] = useState<ManufacturerFilters>({
    frame_manufacturers_enabled: filters?.frame_manufacturers_enabled ?? null,
    glazing_manufacturers_enabled: filters?.glazing_manufacturers_enabled ?? null,
  });
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft({
      frame_manufacturers_enabled: filters?.frame_manufacturers_enabled ?? null,
      glazing_manufacturers_enabled: filters?.glazing_manufacturers_enabled ?? null,
    });
    setNote(null);
  }, [open, filters]);

  if (!open) return null;

  const frameInUse = inUseManufacturers(apertures, "frame_types");
  const glazingInUse = inUseManufacturers(apertures, "glazing_types");

  const isDirty =
    !arraysEqual(draft.frame_manufacturers_enabled, filters?.frame_manufacturers_enabled ?? null) ||
    !arraysEqual(
      draft.glazing_manufacturers_enabled,
      filters?.glazing_manufacturers_enabled ?? null,
    );

  const handleSave = async () => {
    await onSave(draft);
  };

  return (
    <div className="manufacturer-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="manufacturer-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Configure manufacturer filters"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="manufacturer-modal__header">
          <h2>Configure manufacturer filters</h2>
        </header>
        {frameRoster.isLoading || glazingRoster.isLoading ? (
          <p className="manufacturer-modal__loading">Loading catalog rosters…</p>
        ) : (
          <div className="manufacturer-modal__columns">
            <ManufacturerColumn
              title="Frame manufacturers"
              roster={frameRoster.roster}
              inUse={frameInUse}
              enabled={draft.frame_manufacturers_enabled}
              readOnly={readOnly}
              onChange={(next) =>
                setDraft((prev) => ({ ...prev, frame_manufacturers_enabled: next }))
              }
              onClearAllNote={(count) =>
                setNote(
                  `${count} frame manufacturer${count === 1 ? "" : "s"} stayed enabled because they're in use.`,
                )
              }
            />
            <ManufacturerColumn
              title="Glazing manufacturers"
              roster={glazingRoster.roster}
              inUse={glazingInUse}
              enabled={draft.glazing_manufacturers_enabled}
              readOnly={readOnly}
              onChange={(next) =>
                setDraft((prev) => ({ ...prev, glazing_manufacturers_enabled: next }))
              }
              onClearAllNote={(count) =>
                setNote(
                  `${count} glazing manufacturer${count === 1 ? "" : "s"} stayed enabled because they're in use.`,
                )
              }
            />
          </div>
        )}
        {note ? (
          <p className="manufacturer-modal__note" role="status">
            {note}
          </p>
        ) : null}
        <footer className="manufacturer-modal__footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {readOnly ? null : (
            <button
              type="button"
              className="manufacturer-modal__save"
              disabled={!isDirty}
              onClick={() => void handleSave()}
            >
              Save
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  const aSet = new Set(a.map((m) => m.trim().toLowerCase()));
  return b.every((m) => aSet.has(m.trim().toLowerCase()));
}
