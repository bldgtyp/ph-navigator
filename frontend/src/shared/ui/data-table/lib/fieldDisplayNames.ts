export type FieldDisplayName = {
  fieldKey: string;
  displayName: string;
};

export function normalizeDisplayName(name: string): string {
  return name.trim().toLowerCase();
}

export function findDuplicateDisplayName(
  candidate: string,
  existingFields: ReadonlyArray<FieldDisplayName>,
  excludeFieldKey?: string,
): FieldDisplayName | null {
  const normalizedCandidate = normalizeDisplayName(candidate);
  return (
    existingFields.find(
      (field) =>
        field.fieldKey !== excludeFieldKey &&
        normalizeDisplayName(field.displayName) === normalizedCandidate,
    ) ?? null
  );
}

export function uniqueCopyDisplayName(
  sourceName: string,
  existingNames: ReadonlyArray<string>,
): string {
  const normalized = new Set(existingNames.map(normalizeDisplayName));
  const base = `${sourceName.trim()} copy`;
  if (!normalized.has(normalizeDisplayName(base))) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base} ${index}`;
    if (!normalized.has(normalizeDisplayName(candidate))) return candidate;
  }
}
