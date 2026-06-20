import type { LocalFormulaState } from "./localState";

export type FormulaLocalMessage = {
  title: string;
  body: string;
  detail?: string;
};

export function formatLocalFormulaMessage(state: LocalFormulaState): FormulaLocalMessage | null {
  switch (state.kind) {
    case "empty":
    case "ok":
      return null;
    case "parse_error":
      return {
        title: "Formula syntax error",
        body: `Couldn't parse the formula near position ${state.offset}.`,
        detail: `${state.message}. Add an operator such as +, -, *, /, %, or a comma inside a function.`,
      };
    case "resource_limit":
      return {
        title: "Formula is too large",
        body: `Formula exceeds the ${state.limit} limit (${state.actual}/${state.max}).`,
        detail: "Simplify the expression and try again.",
      };
    case "unsupported_function":
      return {
        title: "Function not supported",
        body: `Function "${state.name}" is not supported.`,
        detail: `Available functions: ${state.available.join(", ")}.`,
      };
    case "missing_ref":
      return {
        title: "Field not found",
        body: `No field named "${state.display_name}" exists in this table.`,
        detail: "Choose a field from the palette or update the field reference.",
      };
    case "cycle":
      return {
        title: "Circular formula",
        body: "This formula references itself.",
        detail: "Remove the self-reference before saving.",
      };
  }
}
