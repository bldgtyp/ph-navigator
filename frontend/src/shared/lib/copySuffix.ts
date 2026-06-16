const COPY_SUFFIX_RE = /^(.*?)\s*\(copy(?:\s+(\d+))?\)$/;

export function nextCopySuffix(baseName: string, siblingNames: Iterable<string>): string {
  const match = COPY_SUFFIX_RE.exec(baseName);
  const root = match ? match[1] : baseName;
  const siblings = new Set(siblingNames);
  let candidate = `${root} (copy)`;
  if (!siblings.has(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = `${root} (copy ${n})`;
    if (!siblings.has(candidate)) return candidate;
    n += 1;
  }
}
