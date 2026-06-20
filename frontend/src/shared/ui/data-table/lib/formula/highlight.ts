export type FormulaHighlightKind = "plain" | "field" | "string" | "number";

export type FormulaHighlightSpan = {
  kind: FormulaHighlightKind;
  text: string;
  start: number;
  end: number;
};

const DIGIT_RE = /[0-9]/;
const ALNUM_RE = /[A-Za-z0-9_]/;

export function highlightFormulaSource(source: string): FormulaHighlightSpan[] {
  const spans: FormulaHighlightSpan[] = [];
  const n = source.length;
  let i = 0;

  while (i < n) {
    const ch = source[i]!;
    if (ch === "{") {
      const end = readFieldEnd(source, i);
      spans.push({ kind: "field", text: source.slice(i, end), start: i, end });
      i = end;
      continue;
    }
    if (ch === '"') {
      const end = readStringEnd(source, i);
      spans.push({ kind: "string", text: source.slice(i, end), start: i, end });
      i = end;
      continue;
    }
    if (isNumberStart(source, i)) {
      const end = readNumberEnd(source, i);
      spans.push({ kind: "number", text: source.slice(i, end), start: i, end });
      i = end;
      continue;
    }

    const start = i;
    i++;
    while (i < n && source[i] !== "{" && source[i] !== '"' && !isNumberStart(source, i)) {
      i++;
    }
    spans.push({ kind: "plain", text: source.slice(start, i), start, end: i });
  }

  return spans;
}

function readFieldEnd(source: string, start: number): number {
  const closing = source.indexOf("}", start + 1);
  return closing === -1 ? source.length : closing + 1;
}

function readStringEnd(source: string, start: number): number {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === '"') return i + 1;
    i++;
  }
  return source.length;
}

function isNumberStart(source: string, index: number): boolean {
  const ch = source[index]!;
  if (!DIGIT_RE.test(ch) && !(ch === "." && DIGIT_RE.test(source[index + 1] ?? ""))) {
    return false;
  }
  const prev = source[index - 1];
  return prev === undefined || !ALNUM_RE.test(prev);
}

function readNumberEnd(source: string, start: number): number {
  let i = start;
  let hasDot = false;
  let hasExp = false;
  while (i < source.length) {
    const ch = source[i]!;
    if (DIGIT_RE.test(ch)) {
      i++;
      continue;
    }
    if (ch === "." && !hasDot && !hasExp) {
      hasDot = true;
      i++;
      continue;
    }
    if ((ch === "e" || ch === "E") && !hasExp) {
      const sign = source[i + 1];
      const expDigitIndex = sign === "+" || sign === "-" ? i + 2 : i + 1;
      if (!DIGIT_RE.test(source[expDigitIndex] ?? "")) break;
      hasExp = true;
      i = expDigitIndex + 1;
      continue;
    }
    break;
  }
  return i;
}
