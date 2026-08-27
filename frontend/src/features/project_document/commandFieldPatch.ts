// Shared field-patch rules for command-journal bindings.
//
// A command may be written optimistically only when the client can reproduce
// the server's edit exactly. In practice that means it patches a small set of
// allowlisted fields on one row and nothing else — the backend applies these
// commands with `exclude_unset` and then does extra bookkeeping (catalog
// override tracking) for any field outside that set. These two helpers are the
// allowlist rule and the patch it produces, so every surface states it the
// same way.

export type DefinedFieldPatch<TSource, TField extends keyof TSource> = {
  [P in TField]?: NonNullable<TSource[P]>;
};

/**
 * The subset of `fields` that `source` actually sets.
 *
 * `null` is dropped along with `undefined`: on these commands a null would mean
 * "clear it" server-side, which no allowlisted field supports, so a command
 * carrying only nulls patches nothing and is not journaled at all.
 */
export function definedFieldPatch<TSource extends object, TField extends keyof TSource>(
  source: TSource,
  fields: readonly TField[],
): DefinedFieldPatch<TSource, TField> {
  const patch: DefinedFieldPatch<TSource, TField> = {};
  for (const field of fields) {
    const value = source[field];
    if (value !== undefined && value !== null) {
      patch[field] = value as NonNullable<TSource[TField]>;
    }
  }
  return patch;
}

/** True when `source` sets nothing outside `fields` and the `identity` keys. */
export function setsOnlyFields<TSource extends object>(
  source: TSource,
  fields: readonly PropertyKey[],
  identity: readonly PropertyKey[],
): boolean {
  const allowed = new Set<PropertyKey>([...fields, ...identity]);
  return Object.entries(source).every(([key, value]) => value === undefined || allowed.has(key));
}

/**
 * True when `command` sets at least one allowlisted field and nothing else —
 * the whole precondition for journaling it.
 */
export function patchesOnlyFields<TSource extends object, TField extends keyof TSource>(
  command: TSource,
  fields: readonly TField[],
  identity: readonly PropertyKey[],
): boolean {
  return (
    Object.keys(definedFieldPatch(command, fields)).length > 0 &&
    setsOnlyFields(command, fields as readonly PropertyKey[], identity)
  );
}
