"""Semantic command seam for aperture-type edits.

The Aperture Builder issues one command per user gesture instead of a
whole-table-replace. ``apply_aperture_command`` is the single dispatch
entry point; route and (later phase) MCP write surfaces share it so the
audit envelope, validation, and structured error contract stay aligned.
"""

from features.project_document.aperture_commands.dispatcher import (
    apply_aperture_command,
)
from features.project_document.aperture_commands.models import (
    ApertureCommand,
)

__all__ = ["ApertureCommand", "apply_aperture_command"]
