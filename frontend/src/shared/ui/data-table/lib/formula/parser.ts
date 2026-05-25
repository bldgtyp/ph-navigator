// Recursive-descent parser for the AirTable-style formula grammar.
// Mirror of `backend/features/project_document/formula/parser.py`. The
// shared grammar corpus pins both implementations to the same AST and
// error envelope on every case.
//
// Grammar (plan-13 §4.4):
//
//   expr     ::= ternary
//   ternary  ::= "if" "(" expr "," expr "," expr ")" | or_expr
//   or_expr  ::= and_expr ("or" and_expr)*
//   and_expr ::= not_expr ("and" not_expr)*
//   not_expr ::= "not" not_expr | cmp
//   cmp      ::= add ( ("=" | "!=" | "<" | "<=" | ">" | ">=") add )?
//   add      ::= mul ( ("+" | "-") mul )*
//   mul      ::= unary ( ("*" | "/" | "%") unary )*
//   unary    ::= "-" atom | atom
//   atom     ::= number | string | bool | "null"
//              | field_ref | func_call | "(" expr ")"
//   field_ref::= "{" display_name "}"
//   func_call::= name "(" [ expr ("," expr)* ] ")"
//
// The parser returns *unresolved* FieldRef nodes (`field_id=null`);
// `resolveRefs` walks the tree against the table registry to fill
// `field_id`.

import {
  BinaryOpNode,
  FieldRefNode,
  FormulaAST,
  FuncCallNode,
  IfExprNode,
  LiteralNode,
  UnaryOpNode,
  BinaryOp,
} from "./ast";
import {
  FormulaParseError,
  FormulaResourceLimitError,
  FormulaUnsupportedFunctionError,
} from "./errors";
import {
  AST_DEPTH_MAX,
  AST_NODE_COUNT_MAX,
  DEP_COUNT_MAX,
  SOURCE_LENGTH_MAX,
} from "./limits";
import { Token, TokenKind } from "./tokens";

// v1 function allow-list. Mirror of backend ALLOWED_FUNCTIONS. `if` is
// grammar-level, not a function.
export const ALLOWED_FUNCTIONS: readonly string[] = [
  "concat",
  "len",
  "lower",
  "number",
  "replace",
  "substring",
  "text",
  "trim",
  "upper",
];

const KEYWORDS: Readonly<Record<string, TokenKind>> = {
  and: TokenKind.AND,
  or: TokenKind.OR,
  not: TokenKind.NOT,
  if: TokenKind.IF,
  true: TokenKind.BOOL,
  false: TokenKind.BOOL,
  null: TokenKind.NULL,
};

const SINGLE_CHAR_TOKENS: Readonly<Record<string, TokenKind>> = {
  "(": TokenKind.LPAREN,
  ")": TokenKind.RPAREN,
  ",": TokenKind.COMMA,
  "+": TokenKind.PLUS,
  "-": TokenKind.MINUS,
  "*": TokenKind.STAR,
  "/": TokenKind.SLASH,
  "%": TokenKind.PERCENT,
  "=": TokenKind.EQ,
  "<": TokenKind.LT,
  ">": TokenKind.GT,
};

const FUNCTION_ARITY: Readonly<Record<string, readonly [number, number]>> = {
  // [min, max]; max=-1 means unbounded.
  concat: [1, -1],
  len: [1, 1],
  lower: [1, 1],
  number: [1, 1],
  replace: [3, 3],
  substring: [2, 3],
  text: [1, 1],
  trim: [1, 1],
  upper: [1, 1],
};

// --------------------------------------------------------------------------
// Tokenizer
// --------------------------------------------------------------------------

const DIGIT_RE = /[0-9]/;
const ALPHA_RE = /[A-Za-z_]/;
const ALNUM_RE = /[A-Za-z0-9_]/;

export function tokenize(source: string): Token[] {
  if (source.length > SOURCE_LENGTH_MAX) {
    throw new FormulaResourceLimitError(
      "source_length",
      source.length,
      SOURCE_LENGTH_MAX,
    );
  }

  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;

  while (i < n) {
    const ch = source[i]!;
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    const offset = i;

    // Numbers.
    if (
      DIGIT_RE.test(ch) ||
      (ch === "." && i + 1 < n && DIGIT_RE.test(source[i + 1]!))
    ) {
      let j = i;
      let hasDot = false;
      let hasExp = false;
      while (j < n) {
        const c = source[j]!;
        if (DIGIT_RE.test(c)) {
          j++;
        } else if (c === "." && !hasDot && !hasExp) {
          hasDot = true;
          j++;
        } else if ((c === "e" || c === "E") && !hasExp) {
          hasExp = true;
          j++;
          if (j < n && (source[j] === "+" || source[j] === "-")) {
            j++;
          }
        } else {
          break;
        }
      }
      const text = source.slice(i, j);
      const value = Number(text);
      if (!Number.isFinite(value)) {
        throw new FormulaParseError(
          `invalid number literal '${text}'`,
          offset,
          source,
        );
      }
      tokens.push({ kind: TokenKind.NUMBER, text, offset, value });
      i = j;
      continue;
    }

    // Strings.
    if (ch === '"') {
      let j = i + 1;
      const buf: string[] = [];
      let closed = false;
      while (j < n) {
        const c = source[j]!;
        if (c === "\\") {
          if (j + 1 >= n) {
            throw new FormulaParseError(
              "unterminated string escape",
              offset,
              source,
            );
          }
          const esc = source[j + 1]!;
          if (esc === "\\") buf.push("\\");
          else if (esc === '"') buf.push('"');
          else if (esc === "n") buf.push("\n");
          else if (esc === "t") buf.push("\t");
          else
            throw new FormulaParseError(
              `unknown string escape \\${esc}`,
              j,
              source,
            );
          j += 2;
        } else if (c === '"') {
          j++;
          closed = true;
          break;
        } else {
          buf.push(c);
          j++;
        }
      }
      if (!closed) {
        throw new FormulaParseError(
          "unterminated string literal",
          offset,
          source,
        );
      }
      tokens.push({
        kind: TokenKind.STRING,
        text: source.slice(i, j),
        offset,
        value: buf.join(""),
      });
      i = j;
      continue;
    }

    // Field reference.
    if (ch === "{") {
      let j = i + 1;
      const buf2: string[] = [];
      let closed = false;
      while (j < n) {
        const c = source[j]!;
        if (c === "}") {
          closed = true;
          break;
        }
        if (c === "{") {
          throw new FormulaParseError(
            "nested '{' inside field reference",
            j,
            source,
          );
        }
        buf2.push(c);
        j++;
      }
      if (!closed) {
        throw new FormulaParseError(
          "unterminated field reference",
          offset,
          source,
        );
      }
      const displayName = buf2.join("").trim();
      if (displayName === "") {
        throw new FormulaParseError(
          "empty field reference {}",
          offset,
          source,
        );
      }
      tokens.push({
        kind: TokenKind.FIELD_REF,
        text: source.slice(i, j + 1),
        offset,
        value: displayName,
      });
      i = j + 1;
      continue;
    }

    // Identifiers / keywords.
    if (ALPHA_RE.test(ch)) {
      let j = i;
      while (j < n && ALNUM_RE.test(source[j]!)) j++;
      const text = source.slice(i, j);
      const keywordKind = KEYWORDS[text.toLowerCase()];
      if (keywordKind === TokenKind.BOOL) {
        tokens.push({
          kind: TokenKind.BOOL,
          text,
          offset,
          value: text.toLowerCase() === "true",
        });
      } else if (keywordKind === TokenKind.NULL) {
        tokens.push({ kind: TokenKind.NULL, text, offset, value: null });
      } else if (keywordKind !== undefined) {
        tokens.push({ kind: keywordKind, text, offset });
      } else {
        tokens.push({ kind: TokenKind.IDENT, text, offset });
      }
      i = j;
      continue;
    }

    // Multi-char operators.
    const two = source.slice(i, i + 2);
    if (two === "!=") {
      tokens.push({ kind: TokenKind.NEQ, text: two, offset });
      i += 2;
      continue;
    }
    if (two === "<=") {
      tokens.push({ kind: TokenKind.LTE, text: two, offset });
      i += 2;
      continue;
    }
    if (two === ">=") {
      tokens.push({ kind: TokenKind.GTE, text: two, offset });
      i += 2;
      continue;
    }

    const singleKind = SINGLE_CHAR_TOKENS[ch];
    if (singleKind !== undefined) {
      tokens.push({ kind: singleKind, text: ch, offset });
      i++;
      continue;
    }

    throw new FormulaParseError(
      `unexpected character '${ch}'`,
      offset,
      source,
    );
  }

  tokens.push({ kind: TokenKind.EOF, text: "", offset: n });
  return tokens;
}

// --------------------------------------------------------------------------
// Parser
// --------------------------------------------------------------------------

const CMP_OP_BY_KIND: Readonly<Record<string, BinaryOp>> = {
  [TokenKind.EQ]: "=",
  [TokenKind.NEQ]: "!=",
  [TokenKind.LT]: "<",
  [TokenKind.LTE]: "<=",
  [TokenKind.GT]: ">",
  [TokenKind.GTE]: ">=",
};

class Parser {
  private readonly source: string;
  private readonly tokens: Token[];
  private pos = 0;
  private nodeCount = 0;
  private depth = 0;
  private readonly distinctRefs = new Set<string>();

  constructor(source: string, tokens: Token[]) {
    this.source = source;
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset]!;
  }

  private advance(): Token {
    const tok = this.tokens[this.pos]!;
    this.pos++;
    return tok;
  }

  private expect(kind: TokenKind, message: string): Token {
    const tok = this.peek();
    if (tok.kind !== kind) {
      throw new FormulaParseError(message, tok.offset, this.source);
    }
    return this.advance();
  }

  private bumpNode(): void {
    this.nodeCount++;
    if (this.nodeCount > AST_NODE_COUNT_MAX) {
      throw new FormulaResourceLimitError(
        "ast_node_count",
        this.nodeCount,
        AST_NODE_COUNT_MAX,
      );
    }
  }

  private enterDepth(): void {
    this.depth++;
    if (this.depth > AST_DEPTH_MAX) {
      throw new FormulaResourceLimitError(
        "ast_depth",
        this.depth,
        AST_DEPTH_MAX,
      );
    }
  }

  private exitDepth(): void {
    this.depth--;
  }

  parseRoot(): FormulaAST {
    const node = this.expr();
    if (this.peek().kind !== TokenKind.EOF) {
      const tok = this.peek();
      throw new FormulaParseError(
        `unexpected token '${tok.text}'`,
        tok.offset,
        this.source,
      );
    }
    return node;
  }

  private expr(): FormulaAST {
    return this.ternary();
  }

  private ternary(): FormulaAST {
    if (this.peek().kind === TokenKind.IF) {
      return this.ifExpr();
    }
    return this.orExpr();
  }

  private ifExpr(): FormulaAST {
    this.enterDepth();
    try {
      this.advance(); // 'if'
      this.expect(TokenKind.LPAREN, "expected '(' after 'if'");
      const cond = this.expr();
      this.expect(TokenKind.COMMA, "expected ',' after 'if' condition");
      const thenBranch = this.expr();
      this.expect(TokenKind.COMMA, "expected ',' after 'if' then-branch");
      const elseBranch = this.expr();
      this.expect(TokenKind.RPAREN, "expected ')' closing 'if'");
      this.bumpNode();
      const node: IfExprNode = {
        kind: "if",
        condition: cond,
        then_branch: thenBranch,
        else_branch: elseBranch,
      };
      return node;
    } finally {
      this.exitDepth();
    }
  }

  private orExpr(): FormulaAST {
    let left = this.andExpr();
    while (this.peek().kind === TokenKind.OR) {
      this.advance();
      const right = this.andExpr();
      this.bumpNode();
      const node: BinaryOpNode = {
        kind: "binary_op",
        op: "or",
        left,
        right,
      };
      left = node;
    }
    return left;
  }

  private andExpr(): FormulaAST {
    let left = this.notExpr();
    while (this.peek().kind === TokenKind.AND) {
      this.advance();
      const right = this.notExpr();
      this.bumpNode();
      const node: BinaryOpNode = {
        kind: "binary_op",
        op: "and",
        left,
        right,
      };
      left = node;
    }
    return left;
  }

  private notExpr(): FormulaAST {
    if (this.peek().kind === TokenKind.NOT) {
      this.advance();
      this.enterDepth();
      let operand: FormulaAST;
      try {
        operand = this.notExpr();
      } finally {
        this.exitDepth();
      }
      this.bumpNode();
      const node: UnaryOpNode = {
        kind: "unary_op",
        op: "not",
        operand,
      };
      return node;
    }
    return this.cmp();
  }

  private cmp(): FormulaAST {
    const left = this.add();
    const kind = this.peek().kind;
    const op = CMP_OP_BY_KIND[kind];
    if (op !== undefined) {
      this.advance();
      const right = this.add();
      // Reject chained comparisons: a < b < c is ambiguous.
      const nextKind = this.peek().kind;
      if (CMP_OP_BY_KIND[nextKind] !== undefined) {
        const tok = this.peek();
        throw new FormulaParseError(
          "chained comparison operators are not allowed",
          tok.offset,
          this.source,
        );
      }
      this.bumpNode();
      const node: BinaryOpNode = {
        kind: "binary_op",
        op,
        left,
        right,
      };
      return node;
    }
    return left;
  }

  private add(): FormulaAST {
    let left = this.mul();
    while (
      this.peek().kind === TokenKind.PLUS ||
      this.peek().kind === TokenKind.MINUS
    ) {
      const op: BinaryOp = this.advance().kind === TokenKind.PLUS ? "+" : "-";
      const right = this.mul();
      this.bumpNode();
      const node: BinaryOpNode = {
        kind: "binary_op",
        op,
        left,
        right,
      };
      left = node;
    }
    return left;
  }

  private mul(): FormulaAST {
    let left = this.unary();
    while (
      this.peek().kind === TokenKind.STAR ||
      this.peek().kind === TokenKind.SLASH ||
      this.peek().kind === TokenKind.PERCENT
    ) {
      const kind = this.advance().kind;
      const op: BinaryOp =
        kind === TokenKind.STAR
          ? "*"
          : kind === TokenKind.SLASH
            ? "/"
            : "%";
      const right = this.unary();
      this.bumpNode();
      const node: BinaryOpNode = {
        kind: "binary_op",
        op,
        left,
        right,
      };
      left = node;
    }
    return left;
  }

  private unary(): FormulaAST {
    if (this.peek().kind === TokenKind.MINUS) {
      this.advance();
      this.enterDepth();
      let operand: FormulaAST;
      try {
        operand = this.unary();
      } finally {
        this.exitDepth();
      }
      this.bumpNode();
      const node: UnaryOpNode = {
        kind: "unary_op",
        op: "-",
        operand,
      };
      return node;
    }
    return this.atom();
  }

  private atom(): FormulaAST {
    const tok = this.peek();
    if (tok.kind === TokenKind.NUMBER) {
      this.advance();
      this.bumpNode();
      const node: LiteralNode = {
        kind: "literal",
        value: tok.value as number,
        inferred_type: "number",
      };
      return node;
    }
    if (tok.kind === TokenKind.STRING) {
      this.advance();
      this.bumpNode();
      const node: LiteralNode = {
        kind: "literal",
        value: tok.value as string,
        inferred_type: "text",
      };
      return node;
    }
    if (tok.kind === TokenKind.BOOL) {
      this.advance();
      this.bumpNode();
      const node: LiteralNode = {
        kind: "literal",
        value: tok.value as boolean,
        inferred_type: "bool",
      };
      return node;
    }
    if (tok.kind === TokenKind.NULL) {
      this.advance();
      this.bumpNode();
      const node: LiteralNode = {
        kind: "literal",
        value: null,
        inferred_type: "null",
      };
      return node;
    }
    if (tok.kind === TokenKind.FIELD_REF) {
      this.advance();
      this.bumpNode();
      const displayName = String(tok.value);
      // Distinct-ref count tracks display_name identity at parse time;
      // resolution later folds equivalent references to the same id.
      const normalized = displayName.trim().toLocaleLowerCase();
      this.distinctRefs.add(normalized);
      if (this.distinctRefs.size > DEP_COUNT_MAX) {
        throw new FormulaResourceLimitError(
          "dep_count",
          this.distinctRefs.size,
          DEP_COUNT_MAX,
        );
      }
      const node: FieldRefNode = {
        kind: "field_ref",
        display_name: displayName,
        field_id: null,
      };
      return node;
    }
    if (tok.kind === TokenKind.LPAREN) {
      this.advance();
      this.enterDepth();
      let inner: FormulaAST;
      try {
        inner = this.expr();
      } finally {
        this.exitDepth();
      }
      this.expect(TokenKind.RPAREN, "expected ')'");
      return inner;
    }
    if (tok.kind === TokenKind.IDENT) {
      return this.funcCall();
    }
    if (tok.kind === TokenKind.IF) {
      return this.ifExpr();
    }
    throw new FormulaParseError(
      `unexpected token '${tok.text}'`,
      tok.offset,
      this.source,
    );
  }

  private funcCall(): FormulaAST {
    const nameTok = this.advance();
    const name = nameTok.text;
    if (this.peek().kind !== TokenKind.LPAREN) {
      throw new FormulaParseError(
        `expected '(' after function name '${name}'`,
        this.peek().offset,
        this.source,
      );
    }
    if (!ALLOWED_FUNCTIONS.includes(name)) {
      throw new FormulaUnsupportedFunctionError(name, ALLOWED_FUNCTIONS);
    }
    this.advance(); // consume '('
    const args: FormulaAST[] = [];
    this.enterDepth();
    try {
      if (this.peek().kind !== TokenKind.RPAREN) {
        args.push(this.expr());
        while (this.peek().kind === TokenKind.COMMA) {
          this.advance();
          if (this.peek().kind === TokenKind.RPAREN) {
            throw new FormulaParseError(
              "trailing comma in function call",
              this.peek().offset,
              this.source,
            );
          }
          args.push(this.expr());
        }
      }
    } finally {
      this.exitDepth();
    }
    this.expect(TokenKind.RPAREN, `expected ')' closing call to '${name}'`);
    validateFunctionArity(name, args.length, nameTok.offset, this.source);
    this.bumpNode();
    const node: FuncCallNode = { kind: "func_call", name, args };
    return node;
  }
}

function validateFunctionArity(
  name: string,
  count: number,
  offset: number,
  source: string,
): void {
  const arity = FUNCTION_ARITY[name];
  if (arity === undefined) return;
  const [minArgs, maxArgs] = arity;
  if (count < minArgs || (maxArgs !== -1 && count > maxArgs)) {
    const expected = minArgs === maxArgs ? `${minArgs}` : `${minArgs}..${maxArgs}`;
    throw new FormulaParseError(
      `function '${name}' expects ${expected} arguments, got ${count}`,
      offset,
      source,
    );
  }
}

export function parse(source: string): FormulaAST {
  if (typeof source !== "string") {
    throw new FormulaParseError("source must be a string", 0, "");
  }
  if (source.trim() === "") {
    throw new FormulaParseError("formula source is empty", 0, source);
  }
  const tokens = tokenize(source);
  const parser = new Parser(source, tokens);
  return parser.parseRoot();
}
