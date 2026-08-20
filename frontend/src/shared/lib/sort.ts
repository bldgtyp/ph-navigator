type NaturalPart = { kind: "number"; value: string } | { kind: "text"; value: string };

export function naturalSortByName<T extends { id: string; name: string }>(items: T[]): T[] {
  return items
    .map((item) => ({ item, parts: naturalParts(item.name) }))
    .sort(
      (left, right) =>
        compareNaturalParts(left.parts, right.parts) ||
        compareCodePoints(left.item.id, right.item.id),
    )
    .map(({ item }) => item);
}

function compareNaturalParts(leftParts: NaturalPart[], rightParts: NaturalPart[]): number {
  const sharedLength = Math.min(leftParts.length, rightParts.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (!leftPart || !rightPart) continue;
    let compared: number;
    if (leftPart.kind === "number" && rightPart.kind === "number") {
      compared = compareNumericStrings(leftPart.value, rightPart.value);
    } else if (leftPart.kind !== rightPart.kind) {
      compared = leftPart.kind === "text" ? -1 : 1;
    } else {
      compared = compareCodePoints(leftPart.value, rightPart.value);
    }
    if (compared !== 0) return compared;
  }
  return leftParts.length - rightParts.length;
}

function naturalParts(value: string): NaturalPart[] {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .split(/(\d+)/u)
    .filter(Boolean)
    .map((part) =>
      /^\d+$/u.test(part) ? { kind: "number", value: part } : { kind: "text", value: part },
    );
}

function compareNumericStrings(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/u, "");
  const normalizedRight = right.replace(/^0+(?=\d)/u, "");
  return (
    normalizedLeft.length - normalizedRight.length ||
    compareCodePoints(normalizedLeft, normalizedRight)
  );
}

function compareCodePoints(left: string, right: string): number {
  const leftIterator = left[Symbol.iterator]();
  const rightIterator = right[Symbol.iterator]();
  while (true) {
    const leftPoint = leftIterator.next();
    const rightPoint = rightIterator.next();
    if (leftPoint.done || rightPoint.done) {
      if (leftPoint.done && rightPoint.done) return 0;
      return leftPoint.done ? -1 : 1;
    }
    const compared = (leftPoint.value.codePointAt(0) ?? 0) - (rightPoint.value.codePointAt(0) ?? 0);
    if (compared !== 0) return compared;
  }
}
