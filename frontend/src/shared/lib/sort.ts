const NATURAL_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function naturalSortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => NATURAL_COLLATOR.compare(left.name, right.name));
}
