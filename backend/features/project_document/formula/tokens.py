"""Token kinds + Token dataclass for the formula tokenizer.

Mirrored by `frontend/.../lib/formula/tokens.ts`. The string enum
values are stable and appear in the shared corpus's `expected_error`
entries.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class TokenKind(StrEnum):
    NUMBER = "NUMBER"
    STRING = "STRING"
    BOOL = "BOOL"
    NULL = "NULL"
    IDENT = "IDENT"
    FIELD_REF = "FIELD_REF"
    LPAREN = "LPAREN"
    RPAREN = "RPAREN"
    COMMA = "COMMA"
    PLUS = "PLUS"
    MINUS = "MINUS"
    STAR = "STAR"
    SLASH = "SLASH"
    PERCENT = "PERCENT"
    EQ = "EQ"
    NEQ = "NEQ"
    LT = "LT"
    LTE = "LTE"
    GT = "GT"
    GTE = "GTE"
    AND = "AND"
    OR = "OR"
    NOT = "NOT"
    IF = "IF"
    EOF = "EOF"


@dataclass(frozen=True, slots=True)
class Token:
    kind: TokenKind
    text: str
    offset: int
    # Populated for NUMBER / STRING / BOOL / NULL / FIELD_REF.
    value: str | float | bool | None = None
