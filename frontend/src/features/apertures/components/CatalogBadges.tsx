// Status badges rendered next to each catalog-aware ref (FrameRef /
// GlazingRef) in the element card. Five distinct badges:
//
//   * Sourced-from-catalog (Library icon) — when ``catalog_origin`` is
//     non-null. Tooltip names the catalog row and ``synced_at``.
//   * Drift (RefreshCw icon) — non-functional placeholder for Phase 12.
//     Renders only when ``has_drift`` is provided as true; otherwise
//     hidden. Phase 06 never passes ``has_drift = true`` from the
//     dispatch layer; Phase 12 attaches the dialog and the input.
//   * Hand-enter (PencilLine icon) — when ``catalog_origin`` is null.
//   * Datasheet link — when ``datasheet_url`` is set (currently only
//     materials carry this field; FrameRef / GlazingRef will pick up
//     the field in a later refactor — Phase 06 surfaces it via the
//     ``source`` field if it looks like a URL).
//   * "You edited this" pill — applied per-field on the parent card,
//     not via this component.

import type { CatalogOrigin } from "../types";

export type CatalogBadgesProps = {
  origin: CatalogOrigin | null;
  datasheetUrl?: string | null;
  /** Phase 12 placeholder. Always false in Phase 06. */
  hasDrift?: boolean;
};

export function CatalogBadges({ origin, datasheetUrl, hasDrift }: CatalogBadgesProps) {
  return (
    <span className="aperture-catalog-badges" data-testid="catalog-badges">
      {origin === null ? (
        <span
          className="aperture-catalog-badge aperture-catalog-badge--hand-enter"
          title="Hand-entered. Not linked to the catalog."
          data-testid="badge-hand-enter"
          aria-label="Hand-entered"
        >
          ✎
        </span>
      ) : (
        <span
          className="aperture-catalog-badge aperture-catalog-badge--sourced"
          title={`From catalog: ${origin.catalog_record_id} · Synced ${formatSynced(origin.synced_at)}`}
          data-testid="badge-sourced"
          aria-label="Sourced from catalog"
        >
          ⌘
        </span>
      )}
      {hasDrift && (
        <span
          className="aperture-catalog-badge aperture-catalog-badge--drift"
          title="Catalog has changed since pick. Click to review (Phase 12)."
          data-testid="badge-drift"
          aria-disabled="true"
        >
          ↻
        </span>
      )}
      {datasheetUrl && datasheetUrl.startsWith("http") && (
        <a
          href={datasheetUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="aperture-catalog-badge aperture-catalog-badge--datasheet"
          title="Open datasheet"
          data-testid="badge-datasheet"
        >
          ↗
        </a>
      )}
    </span>
  );
}

function formatSynced(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}
