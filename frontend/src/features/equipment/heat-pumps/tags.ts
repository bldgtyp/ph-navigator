/**
 * Resolves a unique tag inside a table by appending `(2)`, `(3)`, … on collision.
 * Comparison is trim + case-fold so "AHU-1" and "ahu-1 " collide.
 * Used on add only — rename collisions are rejected with an error instead.
 */
export function uniqueTagForAdd(desired: string, existing: readonly { tag: string }[]): string {
  const trimmed = desired.trim();
  const taken = new Set(existing.map((row) => row.tag.trim().toLocaleLowerCase()));
  if (!taken.has(trimmed.toLocaleLowerCase())) return trimmed;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${trimmed} (${suffix})`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${trimmed} (${Date.now()})`;
}

/**
 * Returns true when `desired` collides with another row in `existing` (excluding the
 * row being renamed by id). Caller uses this on rename to reject duplicates.
 */
export function tagCollides(
  desired: string,
  existing: readonly { id: string; tag: string }[],
  excludeId: string,
): boolean {
  const target = desired.trim().toLocaleLowerCase();
  return existing.some(
    (row) => row.id !== excludeId && row.tag.trim().toLocaleLowerCase() === target,
  );
}
