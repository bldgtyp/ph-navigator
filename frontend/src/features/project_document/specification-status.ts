export type SpecificationStatus = "complete" | "needed" | "question" | "na";

export type DocumentationStatusAxis = "spec" | "datasheet" | "photo";

export const STATUS_AXIS_LABELS: Record<
  DocumentationStatusAxis,
  { column: string; meter: string; filter: string }
> = {
  spec: { column: "Spec. Status", meter: "Spec. Status", filter: "Needs spec" },
  datasheet: { column: "Datasheet", meter: "Datasheets", filter: "Needs datasheet" },
  photo: { column: "Site Photos", meter: "Site Photos", filter: "Needs site photos" },
};

export const STATUS_AXIS_TOOLTIPS: Record<DocumentationStatusAxis, string> = {
  spec: "Design specification: is the product selected and are its performance values confirmed? Datasheets and site photos are tracked separately.",
  datasheet: "Manufacturer datasheet PDF on file for this product.",
  photo: "Installed-condition photos from the site.",
};

export const STATUS_LEGEND_RESOLVED_COPY =
  "A record is resolved when its status is Complete or N/A.";

/**
 * Done/total per evidence axis — the shape every documentation rollup returns,
 * for a project, a section, or a group. Lives here rather than in the
 * Documentation feature because the Overview pane renders the same meters from
 * a counts-only projection, and both read it through `StatusAxisRollup`.
 */
export type StatusAxisCounts = {
  spec_done: number;
  spec_total: number;
  ds_done: number;
  ds_total: number;
  photo_done: number;
  photo_total: number;
};

export function completeCountLabel(done: number, total: number): string {
  return `${done}/${total}`;
}

/** Evidence slots still unresolved, summed across all three axes. */
function unresolvedCount(counts: StatusAxisCounts): number {
  return (
    counts.spec_total -
    counts.spec_done +
    (counts.ds_total - counts.ds_done) +
    (counts.photo_total - counts.photo_done)
  );
}

/** Every evidence slot tracked — three per record, one per axis. */
function trackedCount(counts: StatusAxisCounts): number {
  return counts.spec_total + counts.ds_total + counts.photo_total;
}

/** Bare count, for surfaces that track a single axis (e.g. the U-value report). */
export function needAttentionLabel(count: number): string {
  return `${count} need attention`;
}

/** Every tracked evidence slot on this rollup is resolved. */
export function isCountsComplete(counts: StatusAxisCounts): boolean {
  return unresolvedCount(counts) === 0;
}

/**
 * The evidence count sums three axes, so it routinely exceeds the section's
 * record count — a bare "107 need attention" on 55 records reads as a bug.
 * Carrying the denominator makes the number self-explaining.
 *
 * Returns `null` when nothing is outstanding: a resolved section says nothing
 * rather than displaying a zero.
 */
export function evidenceAttentionLabel(counts: StatusAxisCounts): string | null {
  const outstanding = unresolvedCount(counts);
  if (outstanding <= 0) return null;
  return `${outstanding} of ${trackedCount(counts)} need attention`;
}

export function resolvedLabel(resolved: number, total: number): string {
  return `${resolved} of ${total} resolved`;
}

/**
 * The canonical status vocabulary, in the order status controls display it.
 *
 * Every surface that renders, filters, or counts specification statuses reads
 * this rather than re-listing the members: the Materials panel, the Glazings /
 * Frames spec report, and the Documentation page all showed the same four
 * labels, so a rename or a fifth member has one edit site, not four.
 */
export const SPECIFICATION_STATUSES = [
  "needed",
  "question",
  "complete",
  "na",
] as const satisfies readonly SpecificationStatus[];

export const SPECIFICATION_STATUS_LABELS: Record<SpecificationStatus, string> = {
  needed: "Needed",
  question: "Question",
  complete: "Complete",
  na: "N/A",
};

export const STATUS_LEGEND_ITEMS = [
  { label: SPECIFICATION_STATUS_LABELS.needed, description: "work remains; follow up." },
  {
    label: SPECIFICATION_STATUS_LABELS.question,
    description: "open question; see the record's Notes. (Spec. Status only)",
  },
  { label: SPECIFICATION_STATUS_LABELS.complete, description: "confirmed and on file." },
  {
    label: SPECIFICATION_STATUS_LABELS.na,
    description: "requirement intentionally does not apply.",
  },
] as const;

export type EvidenceStatus = Exclude<SpecificationStatus, "question">;

export const EVIDENCE_STATUSES = [
  "needed",
  "complete",
  "na",
] as const satisfies readonly EvidenceStatus[];

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  needed: SPECIFICATION_STATUS_LABELS.needed,
  complete: SPECIFICATION_STATUS_LABELS.complete,
  na: SPECIFICATION_STATUS_LABELS.na,
};

export type SpecificationStatusOption = {
  value: SpecificationStatus;
  label: string;
  tone: SpecificationStatus;
};

/** Status-select options in display order; tone tracks the value. */
export const SPECIFICATION_STATUS_OPTIONS: SpecificationStatusOption[] = SPECIFICATION_STATUSES.map(
  (status) => ({
    value: status,
    label: SPECIFICATION_STATUS_LABELS[status],
    tone: status,
  }),
);

export function isSpecificationStatus(value: string): value is SpecificationStatus {
  return (SPECIFICATION_STATUSES as readonly string[]).includes(value);
}

/**
 * What a response may carry on the wire. The backend is canonical `needed` as
 * of schema v8, but a browser can outlive a deploy, so reads still tolerate the
 * legacy `missing`. Removed in Cleanup Release C once the observation window
 * is clean.
 */
export type WireSpecificationStatus = SpecificationStatus | "missing";
export type WireSpecificationStatusRecord<T extends { specification_status: unknown }> = Omit<
  T,
  "specification_status"
> & {
  specification_status: WireSpecificationStatus;
};

export function normalizeSpecificationStatus(value: unknown): SpecificationStatus {
  if (value === "missing") return "needed";
  if (value === "complete" || value === "needed" || value === "question" || value === "na") {
    return value;
  }
  throw new Error(`Unsupported specification status: ${String(value)}`);
}

export function normalizeSpecificationStatusRecord<T extends { specification_status: unknown }>(
  record: T,
): Omit<T, "specification_status"> & { specification_status: SpecificationStatus } {
  const specificationStatus = normalizeSpecificationStatus(record.specification_status);
  if (specificationStatus === record.specification_status) {
    return record as Omit<T, "specification_status"> & {
      specification_status: SpecificationStatus;
    };
  }
  return {
    ...record,
    specification_status: specificationStatus,
  };
}

/**
 * Resolve a value for a built-in specification-status write. `unknown` is a
 * response-only sentinel (D-7) that is never persisted; an editor leaving it
 * alone writes canonical `needed`.
 *
 * Legacy `missing` is deliberately not accepted here: writes originate from
 * this build's own UI state, so the wire-tolerance boundary is
 * `normalizeSpecificationStatus` on the read path, not this one.
 */
export function serializeSpecificationStatus(
  value: SpecificationStatus | "unknown",
): SpecificationStatus {
  return value === "unknown" ? "needed" : value;
}
