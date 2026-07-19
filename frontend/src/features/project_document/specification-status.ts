export type SpecificationStatus = "complete" | "missing" | "question" | "na";
export type WireSpecificationStatus = SpecificationStatus | "needed";
export type WireSpecificationStatusRecord<T extends { specification_status: unknown }> = Omit<
  T,
  "specification_status"
> & {
  specification_status: WireSpecificationStatus;
};

export function normalizeSpecificationStatus(value: unknown): SpecificationStatus {
  if (value === "needed") return "missing";
  if (value === "complete" || value === "missing" || value === "question" || value === "na") {
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

export function serializeReleaseASpecificationStatus(
  value: WireSpecificationStatus | "unknown",
): SpecificationStatus {
  return value === "needed" || value === "unknown" ? "missing" : value;
}
