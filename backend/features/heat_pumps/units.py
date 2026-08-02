"""Heat-pump capacity conversion constants shared by migration and export."""

from typing import Final

BTU_PER_H_PER_KW: Final = 3412.141633
KW_TO_KBTU_PER_H: Final = BTU_PER_H_PER_KW / 1000
