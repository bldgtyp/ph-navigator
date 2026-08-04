"""Effective Ψ-install resolution for aperture-element edges.

Applies the aperture-psi-install precedence (D-3/D-4) per glazed-element
side:

1. an **interior** (mulled) side is Ψ = 0 with ``source="mull"`` — any
   stale slot value is ignored;
2. an assigned slot (``apit_*``) resolves to that library row's
   ``psi_w_mk`` with ``source="assigned"``;
3. an empty slot inherits the project Default row (``apit_default``)
   with ``source="default"``.

Void elements carry no install edges and are skipped. Data problems that
validation normally prevents (dangling slot ref, unset ``psi_w_mk``)
degrade to the next rung with a typed warning instead of raising, so the
U-value report and route-3 export can surface them without failing.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from features.project_document.aperture_commands.models import APERTURE_SIDES, ApertureSide
from features.project_document.apertures.edge_classification import classify_element_edges
from features.project_document.document import (
    ApertureInstallTypeRow,
    ApertureTypeEntry,
    ProjectDocumentTables,
)
from features.project_document.tables.aperture_install_types import (
    APERTURE_INSTALL_DEFAULT_TYPE_ID,
    install_type_name,
    install_type_psi_w_mk,
)

InstallPsiSource = Literal["mull", "assigned", "default"]
InstallPsiWarningKind = Literal[
    "missing_install_type_ref",
    "install_type_psi_unset",
    "default_install_type_missing",
]


@dataclass(frozen=True)
class ResolvedInstallPsi:
    """The effective Ψ-install for one glazed-element side."""

    psi_w_mk: float
    source: InstallPsiSource
    #: Library row the value came from; ``None`` on interior (mull) sides.
    install_type_id: str | None
    install_type_name: str | None


@dataclass(frozen=True)
class InstallPsiWarning:
    kind: InstallPsiWarningKind
    aperture_type_id: str
    element_id: str | None
    side: ApertureSide | None
    message: str


@dataclass(frozen=True)
class ApertureInstallPsiResolution:
    """Per-side effective values for one aperture, keyed ``(element_id, side)``."""

    values: dict[tuple[str, ApertureSide], ResolvedInstallPsi]
    warnings: list[InstallPsiWarning]


def resolve_install_psi_for_aperture(
    aperture: ApertureTypeEntry,
    tables: ProjectDocumentTables,
) -> ApertureInstallPsiResolution:
    """Resolve every glazed-element side of one aperture type."""
    types_by_id = {row.id: row for row in tables.aperture_install_types.rows}
    classes = classify_element_edges(aperture)
    values: dict[tuple[str, ApertureSide], ResolvedInstallPsi] = {}
    warnings: list[InstallPsiWarning] = []

    for element in aperture.elements:
        if element.kind != "glazed":
            continue
        for side in APERTURE_SIDES:
            if classes[(element.id, side)] == "interior":
                values[(element.id, side)] = ResolvedInstallPsi(
                    psi_w_mk=0.0, source="mull", install_type_id=None, install_type_name=None
                )
                continue
            slot = getattr(element.installs, side)
            if slot is not None and slot not in types_by_id:
                warnings.append(
                    InstallPsiWarning(
                        kind="missing_install_type_ref",
                        aperture_type_id=aperture.id,
                        element_id=element.id,
                        side=side,
                        message=(
                            f"Element {element.id}'s {side} install assignment {slot} does not exist; "
                            "falling back to the project Default."
                        ),
                    )
                )
                slot = None
            if slot is not None:
                values[(element.id, side)] = _resolved_from_row(
                    types_by_id[slot], "assigned", aperture, element.id, side, warnings
                )
                continue
            default_row = types_by_id.get(APERTURE_INSTALL_DEFAULT_TYPE_ID)
            if default_row is None:
                # Validation self-heals the Default row, so a validated body
                # can't get here; degrade to 0 rather than raise mid-export.
                warnings.append(
                    InstallPsiWarning(
                        kind="default_install_type_missing",
                        aperture_type_id=aperture.id,
                        element_id=element.id,
                        side=side,
                        message="The project Default install type (apit_default) is missing; using 0.0.",
                    )
                )
                values[(element.id, side)] = ResolvedInstallPsi(
                    psi_w_mk=0.0, source="default", install_type_id=None, install_type_name=None
                )
                continue
            values[(element.id, side)] = _resolved_from_row(
                default_row, "default", aperture, element.id, side, warnings
            )

    return ApertureInstallPsiResolution(values=values, warnings=warnings)


def default_install_psi_w_mk(tables: ProjectDocumentTables) -> float:
    """The project Default row's Ψ-install, degrading to 0.0 when unusable.

    Route 3 emits this uniform value into every ``frame_type`` block (D-5)
    because the current GH client dedups frames by name and would silently
    misapply per-edge-varying values.
    """
    for row in tables.aperture_install_types.rows:
        if row.id == APERTURE_INSTALL_DEFAULT_TYPE_ID:
            return install_type_psi_w_mk(row) or 0.0
    return 0.0


def _resolved_from_row(
    row: ApertureInstallTypeRow,
    source: InstallPsiSource,
    aperture: ApertureTypeEntry,
    element_id: str,
    side: ApertureSide,
    warnings: list[InstallPsiWarning],
) -> ResolvedInstallPsi:
    psi = install_type_psi_w_mk(row)
    if psi is None:
        warnings.append(
            InstallPsiWarning(
                kind="install_type_psi_unset",
                aperture_type_id=aperture.id,
                element_id=element_id,
                side=side,
                message=f"Install type {row.id} has no psi_w_mk value; treating it as 0.0.",
            )
        )
        psi = 0.0
    return ResolvedInstallPsi(
        psi_w_mk=psi,
        source=source,
        install_type_id=row.id,
        install_type_name=install_type_name(row),
    )
