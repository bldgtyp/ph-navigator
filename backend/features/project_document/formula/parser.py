"""Recursive-descent parser for the AirTable-style formula grammar.

Grammar (plan-13 §4.4):

    expr     ::= ternary
    ternary  ::= "if" "(" expr "," expr "," expr ")" | or_expr
    or_expr  ::= and_expr ("or" and_expr)*
    and_expr ::= not_expr ("and" not_expr)*
    not_expr ::= "not" not_expr | cmp
    cmp      ::= add ( ("=" | "!=" | "<" | "<=" | ">" | ">=") add )?
    add      ::= mul ( ("+" | "-") mul )*
    mul      ::= unary ( ("*" | "/" | "%") unary )*
    unary    ::= "-" atom | atom
    atom     ::= number | string | bool | "null"
               | field_ref | func_call | "(" expr ")"
    field_ref::= "{" display_name "}"
    func_call::= name "(" [ expr ("," expr)* ] ")"

The parser produces *unresolved* `FieldRef` nodes (`field_id=None`);
`resolver.resolve_refs` walks the tree against a table registry to
fill `field_id` after parse.

Parse-time D23 limits are enforced inline: `source_length` before
tokenize; `ast_node_count`, `ast_depth`, `dep_count` during walk.
Function names outside the v1 allow-list raise
`FormulaUnsupportedFunctionError`.
"""

from __future__ import annotations

from features.project_document.formula.ast_nodes import (
    BinaryOp,
    BinaryOperator,
    FieldRef,
    FormulaAST,
    FuncCall,
    IfExpr,
    Literal_,
    UnaryOp,
)
from features.project_document.formula.errors import (
    FormulaParseError,
    FormulaResourceLimitError,
    FormulaUnsupportedFunctionError,
)
from features.project_document.formula.limits import (
    AST_DEPTH_MAX,
    AST_NODE_COUNT_MAX,
    DEP_COUNT_MAX,
    SOURCE_LENGTH_MAX,
)
from features.project_document.formula.tokens import Token, TokenKind

# v1 function allow-list (plan-13 §4.4 + §4.4 ternary section). `if`
# is grammar-level, not a function — but we include it in the
# tokenizer's keyword set.
ALLOWED_FUNCTIONS: tuple[str, ...] = (
    "concat",
    "len",
    "lower",
    "number",
    "replace",
    "substring",
    "text",
    "trim",
    "upper",
)

KEYWORDS: dict[str, TokenKind] = {
    "and": TokenKind.AND,
    "or": TokenKind.OR,
    "not": TokenKind.NOT,
    "if": TokenKind.IF,
    "true": TokenKind.BOOL,
    "false": TokenKind.BOOL,
    "null": TokenKind.NULL,
}


# --------------------------------------------------------------------------
# Tokenizer
# --------------------------------------------------------------------------


def tokenize(source: str) -> list[Token]:
    if len(source) > SOURCE_LENGTH_MAX:
        raise FormulaResourceLimitError("source_length", len(source), SOURCE_LENGTH_MAX)

    tokens: list[Token] = []
    i = 0
    n = len(source)
    while i < n:
        ch = source[i]
        if ch in " \t\r\n":
            i += 1
            continue
        offset = i

        # Numbers — integer or decimal, optional scientific notation.
        if ch.isdigit() or (ch == "." and i + 1 < n and source[i + 1].isdigit()):
            j = i
            has_dot = False
            has_exp = False
            while j < n:
                c = source[j]
                if c.isdigit():
                    j += 1
                elif c == "." and not has_dot and not has_exp:
                    has_dot = True
                    j += 1
                elif c in "eE" and not has_exp:
                    has_exp = True
                    j += 1
                    if j < n and source[j] in "+-":
                        j += 1
                else:
                    break
            text = source[i:j]
            try:
                value = float(text)
            except ValueError as exc:
                raise FormulaParseError(f"invalid number literal {text!r}", offset, source) from exc
            tokens.append(Token(TokenKind.NUMBER, text, offset, value))
            i = j
            continue

        # Strings — double-quoted with \\ and \" and \n escapes only.
        if ch == '"':
            j = i + 1
            buf: list[str] = []
            while j < n:
                c = source[j]
                if c == "\\":
                    if j + 1 >= n:
                        raise FormulaParseError("unterminated string escape", offset, source)
                    esc = source[j + 1]
                    if esc == "\\":
                        buf.append("\\")
                    elif esc == '"':
                        buf.append('"')
                    elif esc == "n":
                        buf.append("\n")
                    elif esc == "t":
                        buf.append("\t")
                    else:
                        raise FormulaParseError(f"unknown string escape \\{esc}", j, source)
                    j += 2
                elif c == '"':
                    j += 1
                    break
                else:
                    buf.append(c)
                    j += 1
            else:
                raise FormulaParseError("unterminated string literal", offset, source)
            text = source[i:j]
            tokens.append(Token(TokenKind.STRING, text, offset, "".join(buf)))
            i = j
            continue

        # Field reference — {Display Name}, no nested braces.
        if ch == "{":
            j = i + 1
            buf2: list[str] = []
            while j < n:
                c = source[j]
                if c == "}":
                    break
                if c == "{":
                    raise FormulaParseError("nested '{' inside field reference", j, source)
                buf2.append(c)
                j += 1
            else:
                raise FormulaParseError("unterminated field reference", offset, source)
            display_name = "".join(buf2).strip()
            if not display_name:
                raise FormulaParseError("empty field reference {}", offset, source)
            tokens.append(Token(TokenKind.FIELD_REF, source[i : j + 1], offset, display_name))
            i = j + 1
            continue

        # Identifiers / keywords.
        if ch.isalpha() or ch == "_":
            j = i
            while j < n and (source[j].isalnum() or source[j] == "_"):
                j += 1
            text = source[i:j]
            keyword_kind = KEYWORDS.get(text.lower())
            if keyword_kind is TokenKind.BOOL:
                tokens.append(Token(TokenKind.BOOL, text, offset, text.lower() == "true"))
            elif keyword_kind is TokenKind.NULL:
                tokens.append(Token(TokenKind.NULL, text, offset, None))
            elif keyword_kind is not None:
                tokens.append(Token(keyword_kind, text, offset, None))
            else:
                tokens.append(Token(TokenKind.IDENT, text, offset, None))
            i = j
            continue

        # Multi-char operators.
        two = source[i : i + 2]
        if two == "!=":
            tokens.append(Token(TokenKind.NEQ, two, offset))
            i += 2
            continue
        if two == "<=":
            tokens.append(Token(TokenKind.LTE, two, offset))
            i += 2
            continue
        if two == ">=":
            tokens.append(Token(TokenKind.GTE, two, offset))
            i += 2
            continue

        single: dict[str, TokenKind] = {
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
        }
        if ch in single:
            tokens.append(Token(single[ch], ch, offset))
            i += 1
            continue

        raise FormulaParseError(f"unexpected character {ch!r}", offset, source)

    tokens.append(Token(TokenKind.EOF, "", n))
    return tokens


# --------------------------------------------------------------------------
# Parser
# --------------------------------------------------------------------------


class _Parser:
    def __init__(self, source: str, tokens: list[Token]) -> None:
        self.source = source
        self.tokens = tokens
        self.pos = 0
        self.node_count = 0
        self.depth = 0
        self.distinct_refs: set[str] = set()

    # ---- mechanics -------------------------------------------------------

    def _peek(self, offset: int = 0) -> Token:
        return self.tokens[self.pos + offset]

    def _advance(self) -> Token:
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def _expect(self, kind: TokenKind, message: str) -> Token:
        tok = self._peek()
        if tok.kind is not kind:
            raise FormulaParseError(message, tok.offset, self.source)
        return self._advance()

    def _bump_node(self) -> None:
        self.node_count += 1
        if self.node_count > AST_NODE_COUNT_MAX:
            raise FormulaResourceLimitError("ast_node_count", self.node_count, AST_NODE_COUNT_MAX)

    def _enter_depth(self) -> None:
        self.depth += 1
        if self.depth > AST_DEPTH_MAX:
            raise FormulaResourceLimitError("ast_depth", self.depth, AST_DEPTH_MAX)

    def _exit_depth(self) -> None:
        self.depth -= 1

    # ---- productions -----------------------------------------------------

    def parse_root(self) -> FormulaAST:
        node = self._expr()
        if self._peek().kind is not TokenKind.EOF:
            tok = self._peek()
            raise FormulaParseError(f"unexpected token {tok.text!r}", tok.offset, self.source)
        return node

    def _expr(self) -> FormulaAST:
        return self._ternary()

    def _ternary(self) -> FormulaAST:
        if self._peek().kind is TokenKind.IF:
            return self._if_expr()
        return self._or_expr()

    def _if_expr(self) -> FormulaAST:
        self._enter_depth()
        try:
            self._advance()  # 'if'
            self._expect(TokenKind.LPAREN, "expected '(' after 'if'")
            cond = self._expr()
            self._expect(TokenKind.COMMA, "expected ',' after 'if' condition")
            then_branch = self._expr()
            self._expect(TokenKind.COMMA, "expected ',' after 'if' then-branch")
            else_branch = self._expr()
            self._expect(TokenKind.RPAREN, "expected ')' closing 'if'")
            self._bump_node()
            return IfExpr(kind="if", condition=cond, then_branch=then_branch, else_branch=else_branch)
        finally:
            self._exit_depth()

    def _or_expr(self) -> FormulaAST:
        left = self._and_expr()
        while self._peek().kind is TokenKind.OR:
            self._advance()
            right = self._and_expr()
            self._bump_node()
            left = BinaryOp(kind="binary_op", op="or", left=left, right=right)
        return left

    def _and_expr(self) -> FormulaAST:
        left = self._not_expr()
        while self._peek().kind is TokenKind.AND:
            self._advance()
            right = self._not_expr()
            self._bump_node()
            left = BinaryOp(kind="binary_op", op="and", left=left, right=right)
        return left

    def _not_expr(self) -> FormulaAST:
        if self._peek().kind is TokenKind.NOT:
            self._advance()
            self._enter_depth()
            try:
                operand = self._not_expr()
            finally:
                self._exit_depth()
            self._bump_node()
            return UnaryOp(kind="unary_op", op="not", operand=operand)
        return self._cmp()

    def _cmp(self) -> FormulaAST:
        left = self._add()
        kind = self._peek().kind
        cmp_op_by_kind: dict[TokenKind, BinaryOperator] = {
            TokenKind.EQ: "=",
            TokenKind.NEQ: "!=",
            TokenKind.LT: "<",
            TokenKind.LTE: "<=",
            TokenKind.GT: ">",
            TokenKind.GTE: ">=",
        }
        if kind in cmp_op_by_kind:
            op = cmp_op_by_kind[kind]
            self._advance()
            right = self._add()
            # Reject chained comparisons: a < b < c is ambiguous.
            if self._peek().kind in cmp_op_by_kind:
                tok = self._peek()
                raise FormulaParseError(
                    "chained comparison operators are not allowed",
                    tok.offset,
                    self.source,
                )
            self._bump_node()
            return BinaryOp(kind="binary_op", op=op, left=left, right=right)
        return left

    def _add(self) -> FormulaAST:
        left = self._mul()
        while self._peek().kind in (TokenKind.PLUS, TokenKind.MINUS):
            op: BinaryOperator = "+" if self._advance().kind is TokenKind.PLUS else "-"
            right = self._mul()
            self._bump_node()
            left = BinaryOp(kind="binary_op", op=op, left=left, right=right)
        return left

    def _mul(self) -> FormulaAST:
        left = self._unary()
        while self._peek().kind in (TokenKind.STAR, TokenKind.SLASH, TokenKind.PERCENT):
            kind = self._advance().kind
            op_by_kind: dict[TokenKind, BinaryOperator] = {
                TokenKind.STAR: "*",
                TokenKind.SLASH: "/",
                TokenKind.PERCENT: "%",
            }
            op = op_by_kind[kind]
            right = self._unary()
            self._bump_node()
            left = BinaryOp(kind="binary_op", op=op, left=left, right=right)
        return left

    def _unary(self) -> FormulaAST:
        if self._peek().kind is TokenKind.MINUS:
            self._advance()
            self._enter_depth()
            try:
                operand = self._unary()
            finally:
                self._exit_depth()
            self._bump_node()
            return UnaryOp(kind="unary_op", op="-", operand=operand)
        return self._atom()

    def _atom(self) -> FormulaAST:
        tok = self._peek()
        if tok.kind is TokenKind.NUMBER:
            self._advance()
            self._bump_node()
            return Literal_(kind="literal", value=tok.value, inferred_type="number")
        if tok.kind is TokenKind.STRING:
            self._advance()
            self._bump_node()
            return Literal_(kind="literal", value=tok.value, inferred_type="text")
        if tok.kind is TokenKind.BOOL:
            self._advance()
            self._bump_node()
            return Literal_(kind="literal", value=tok.value, inferred_type="bool")
        if tok.kind is TokenKind.NULL:
            self._advance()
            self._bump_node()
            return Literal_(kind="literal", value=None, inferred_type="null")
        if tok.kind is TokenKind.FIELD_REF:
            self._advance()
            self._bump_node()
            display_name = str(tok.value)
            # Distinct-ref count tracks the *display_name* identity at
            # parse time; resolution later folds equivalent references
            # to the same field_id.
            normalized = display_name.strip().casefold()
            self.distinct_refs.add(normalized)
            if len(self.distinct_refs) > DEP_COUNT_MAX:
                raise FormulaResourceLimitError(
                    "dep_count", len(self.distinct_refs), DEP_COUNT_MAX
                )
            return FieldRef(kind="field_ref", display_name=display_name, field_id=None)
        if tok.kind is TokenKind.LPAREN:
            self._advance()
            self._enter_depth()
            try:
                inner = self._expr()
            finally:
                self._exit_depth()
            self._expect(TokenKind.RPAREN, "expected ')'")
            return inner
        if tok.kind is TokenKind.IDENT:
            return self._func_call()
        if tok.kind is TokenKind.IF:
            return self._if_expr()
        raise FormulaParseError(f"unexpected token {tok.text!r}", tok.offset, self.source)

    def _func_call(self) -> FormulaAST:
        name_tok = self._advance()
        name = name_tok.text
        if self._peek().kind is not TokenKind.LPAREN:
            raise FormulaParseError(
                f"expected '(' after function name {name!r}",
                self._peek().offset,
                self.source,
            )
        if name not in ALLOWED_FUNCTIONS:
            raise FormulaUnsupportedFunctionError(name, ALLOWED_FUNCTIONS)
        self._advance()  # consume '('
        args: list[FormulaAST] = []
        self._enter_depth()
        try:
            if self._peek().kind is not TokenKind.RPAREN:
                args.append(self._expr())
                while self._peek().kind is TokenKind.COMMA:
                    self._advance()
                    if self._peek().kind is TokenKind.RPAREN:
                        raise FormulaParseError(
                            "trailing comma in function call",
                            self._peek().offset,
                            self.source,
                        )
                    args.append(self._expr())
        finally:
            self._exit_depth()
        self._expect(TokenKind.RPAREN, f"expected ')' closing call to {name!r}")
        _validate_function_arity(name, args, name_tok.offset, self.source)
        self._bump_node()
        return FuncCall(kind="func_call", name=name, args=tuple(args))


_FUNCTION_ARITY: dict[str, tuple[int, int]] = {
    # (min, max) inclusive; max=-1 means unbounded.
    "concat": (1, -1),
    "len": (1, 1),
    "lower": (1, 1),
    "number": (1, 1),
    "replace": (3, 3),
    "substring": (2, 3),
    "text": (1, 1),
    "trim": (1, 1),
    "upper": (1, 1),
}


def _validate_function_arity(
    name: str, args: list[FormulaAST], offset: int, source: str
) -> None:
    if name not in _FUNCTION_ARITY:
        return
    min_args, max_args = _FUNCTION_ARITY[name]
    count = len(args)
    if count < min_args or (max_args != -1 and count > max_args):
        expected = f"{min_args}" if min_args == max_args else f"{min_args}..{max_args}"
        raise FormulaParseError(
            f"function {name!r} expects {expected} arguments, got {count}",
            offset,
            source,
        )


def parse(source: str) -> FormulaAST:
    """Parse a formula source string into an unresolved AST.

    Raises `FormulaResourceLimitError`, `FormulaParseError`, or
    `FormulaUnsupportedFunctionError`.
    """
    if not isinstance(source, str):
        raise FormulaParseError("source must be a string", 0, "")
    if not source.strip():
        raise FormulaParseError("formula source is empty", 0, source)
    tokens = tokenize(source)
    parser = _Parser(source, tokens)
    return parser.parse_root()
