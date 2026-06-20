// Token kinds + Token interface for the formula tokenizer.
// Mirror of `backend/features/project_document/formula/tokens.py`. The
// `TokenKind` values are stable wire constants — used in error messages
// and the shared corpus.

export const TokenKind = {
  NUMBER: "NUMBER",
  STRING: "STRING",
  BOOL: "BOOL",
  NULL: "NULL",
  IDENT: "IDENT",
  FIELD_REF: "FIELD_REF",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  COMMA: "COMMA",
  AMPERSAND: "AMPERSAND",
  PLUS: "PLUS",
  MINUS: "MINUS",
  STAR: "STAR",
  SLASH: "SLASH",
  PERCENT: "PERCENT",
  EQ: "EQ",
  NEQ: "NEQ",
  LT: "LT",
  LTE: "LTE",
  GT: "GT",
  GTE: "GTE",
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  IF: "IF",
  EOF: "EOF",
} as const;

export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

export type TokenValue = string | number | boolean | null;

export interface Token {
  kind: TokenKind;
  text: string;
  offset: number;
  // Populated for NUMBER / STRING / BOOL / NULL / FIELD_REF.
  value?: TokenValue;
}
