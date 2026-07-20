export type SpecificationStatus = "complete" | "needed" | "question" | "na";

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
