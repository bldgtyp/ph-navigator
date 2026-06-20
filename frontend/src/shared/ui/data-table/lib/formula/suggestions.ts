import { ALLOWED_FUNCTIONS } from "./parser";
import type { FieldRegistryEntry } from "./resolver";

export type FormulaSuggestionMode = "field" | "bare" | "none";

export type FormulaCaretContext = {
  mode: FormulaSuggestionMode;
  query: string;
  range: { start: number; end: number };
};

export type FormulaSuggestion = {
  id: string;
  kind: "field" | "function";
  label: string;
  detail: string;
  insertText: string;
  rank: number;
};

const WORD_RE = /[A-Za-z0-9_]/;
const MAX_SUGGESTIONS = 8;

export function getFormulaCaretContext(
  source: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): FormulaCaretContext {
  const start = clampSelection(selectionStart, source.length);
  const end = clampSelection(selectionEnd, source.length);
  if (start !== end) return noneContext(start, end);
  if (isInsideString(source, start)) return noneContext(start, end);

  const openBrace = source.lastIndexOf("{", start - 1);
  const closeBrace = source.lastIndexOf("}", start - 1);
  if (openBrace > closeBrace) {
    const query = source.slice(openBrace + 1, start);
    if (!query.includes("{")) {
      return { mode: "field", query, range: { start: openBrace, end } };
    }
  }

  let wordStart = start;
  while (wordStart > 0 && WORD_RE.test(source[wordStart - 1] ?? "")) {
    wordStart--;
  }
  if (wordStart < start) {
    return {
      mode: "bare",
      query: source.slice(wordStart, start),
      range: { start: wordStart, end },
    };
  }
  return noneContext(start, end);
}

export function buildFormulaSuggestions(
  context: FormulaCaretContext,
  fields: ReadonlyArray<FieldRegistryEntry>,
): FormulaSuggestion[] {
  if (context.mode === "none") return [];
  const query = context.query.trim().toLocaleLowerCase();
  const fieldSuggestions = fields
    .map((field): FormulaSuggestion | null => {
      const rank = matchRank(field.display_name, query);
      if (rank === null) return null;
      return {
        id: `field:${field.field_id}`,
        kind: "field" as const,
        label: field.display_name,
        detail: fieldTypeLabel(field.field_type),
        insertText: `{${field.display_name}}`,
        rank,
      };
    })
    .filter((suggestion): suggestion is FormulaSuggestion => suggestion !== null);
  const functionSuggestions =
    context.mode === "bare"
      ? ALLOWED_FUNCTIONS.map((name): FormulaSuggestion | null => {
          const rank = matchRank(name, query);
          if (rank === null) return null;
          return {
            id: `function:${name}`,
            kind: "function" as const,
            label: name,
            detail: "function",
            insertText: `${name}(`,
            rank,
          };
        }).filter((suggestion): suggestion is FormulaSuggestion => suggestion !== null)
      : [];
  return [...fieldSuggestions, ...functionSuggestions]
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .slice(0, MAX_SUGGESTIONS);
}

export function formulaSuggestionOptionId(panelId: string, index: number): string {
  return `${panelId}-option-${index}`;
}

function clampSelection(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

function noneContext(start: number, end: number): FormulaCaretContext {
  return { mode: "none", query: "", range: { start, end } };
}

function isInsideString(source: string, caret: number): boolean {
  let inString = false;
  for (let i = 0; i < caret; i++) {
    const ch = source[i]!;
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === '"') inString = !inString;
  }
  return inString;
}

function matchRank(label: string, query: string): number | null {
  if (query === "") return 2;
  const haystack = label.toLocaleLowerCase();
  if (haystack.startsWith(query)) return 0;
  if (haystack.includes(query)) return 1;
  return null;
}

function fieldTypeLabel(fieldType: FieldRegistryEntry["field_type"]): string {
  switch (fieldType) {
    case "text":
      return "Text column";
    case "number":
      return "Number column";
    case "single_select":
      return "Single-select column";
    case "formula":
      return "Formula column";
    case "bool":
      return "Boolean column";
  }
}
