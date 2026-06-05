// Safely evaluate a simple arithmetic expression. Supports `+ - * /` with
// standard precedence and now `( … )` for grouping — that grouping support
// is new in V2 (Phase 05 papercut closure; V1 returned NaN for parens).
//
// Returns NaN on any invalid input. Whitelist-only character set; never uses
// `eval` / `Function` so it stays safe against code injection.
//
// Examples:
//   "100"            → 100
//   "100 + 50"       → 150
//   "2 + 3 * 4"      → 14
//   "(1200 - 50)/4"  → 287.5
//   "((1+2)*3)"      → 9

const ALLOWED_CHARS = /^[\d\s+\-*/.()]+$/;
const NUMBER_OR_OP = /(\d+\.?\d*|[+\-*/()])/g;

type Token = { kind: "num"; value: number } | { kind: "op"; value: string };

function tokenize(input: string): Token[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!ALLOWED_CHARS.test(trimmed)) return null;

  const raw = trimmed.match(NUMBER_OR_OP);
  if (!raw || raw.length === 0) return null;

  const tokens: Token[] = [];
  for (const t of raw) {
    if (/^\d/.test(t)) {
      const num = parseFloat(t);
      if (Number.isNaN(num)) return null;
      tokens.push({ kind: "num", value: num });
    } else {
      tokens.push({ kind: "op", value: t });
    }
  }
  return tokens;
}

// Recursive-descent parser over the token stream.
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := number | '(' expr ')'
class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): number {
    const value = this.expr();
    if (this.pos !== this.tokens.length) return Number.NaN;
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private expr(): number {
    let left = this.term();
    while (true) {
      const tok = this.peek();
      if (!tok || tok.kind !== "op" || (tok.value !== "+" && tok.value !== "-")) break;
      this.consume();
      const right = this.term();
      left = tok.value === "+" ? left + right : left - right;
    }
    return left;
  }

  private term(): number {
    let left = this.factor();
    while (true) {
      const tok = this.peek();
      if (!tok || tok.kind !== "op" || (tok.value !== "*" && tok.value !== "/")) break;
      this.consume();
      const right = this.factor();
      if (tok.value === "/" && right === 0) return Number.NaN;
      left = tok.value === "*" ? left * right : left / right;
    }
    return left;
  }

  private factor(): number {
    const tok = this.consume();
    if (!tok) return Number.NaN;
    if (tok.kind === "num") return tok.value;
    if (tok.kind === "op" && tok.value === "(") {
      const inner = this.expr();
      const close = this.consume();
      if (!close || close.kind !== "op" || close.value !== ")") return Number.NaN;
      return inner;
    }
    return Number.NaN;
  }
}

export function evaluateSimpleExpression(input: string): number {
  const trimmed = input.trim();

  // Fast path: bare number.
  if (/^-?\d+\.?\d*$/.test(trimmed)) return parseFloat(trimmed);

  const tokens = tokenize(trimmed);
  if (!tokens) return Number.NaN;

  const result = new Parser(tokens).parse();
  return Number.isFinite(result) ? result : Number.NaN;
}
