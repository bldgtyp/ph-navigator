"""Provider parsers + the registry the *process* step dispatches on.

Each climate source ships its own messy format (Phius ``-mon.txt`` German
mojibake; the PHI/PHPP ~130-column workbook). A provider's parser turns one
raw source tree into a stream of standardized
:class:`~features.climate.record.ClimateRecord` rows; everything downstream
(the bundle, the object store, the seed step) is provider-agnostic.

Adding a provider is a two-step change: implement
``iter_<provider>_records(root) -> Iterator[ClimateRecord]`` in a sibling
module and register a :class:`ClimateProvider` below. The *process* CLI
(:mod:`features.climate.processing`) and the *seed* path
(:mod:`features.climate.seeding`) need no edits.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path

from features.climate.importers.phi import iter_phi_records
from features.climate.importers.phius import iter_phius_records
from features.climate.record import ClimateRecord


@dataclass(frozen=True)
class ClimateProvider:
    """How the *process* step parses and labels one reference-data provider.

    ``parse_tree`` does the format-specific work; ``source`` and
    ``label_prefix`` supply the provenance/label the bundle carries into
    ``seed_dataset``. The registry key is the provider's identity, so this
    record carries no redundant ``name``.
    """

    default_version: str
    source: str
    label_prefix: str
    parse_tree: Callable[[Path], Iterator[ClimateRecord]]

    def label_for(self, version: str) -> str:
        """Human label for one release, e.g. ``"Phius 2022"``."""
        return f"{self.label_prefix} {version}"


_PROVIDERS: dict[str, ClimateProvider] = {
    "phius": ClimateProvider(
        default_version="2022",
        source="Phius monthly climate data (-mon.txt)",
        label_prefix="Phius",
        parse_tree=iter_phius_records,
    ),
    "phi": ClimateProvider(
        default_version="10.6",
        source="PHI/PHPP climate library (Climate worksheet)",
        label_prefix="PHI",
        parse_tree=iter_phi_records,
    ),
}


def get_provider(name: str) -> ClimateProvider:
    """Look up a registered provider, or raise listing the known names."""
    try:
        return _PROVIDERS[name]
    except KeyError:
        known = ", ".join(sorted(_PROVIDERS))
        raise KeyError(f"Unknown climate provider {name!r}; known providers: {known}.") from None


def provider_names() -> tuple[str, ...]:
    """Registered provider names (stable, sorted) — used to build CLI choices."""
    return tuple(sorted(_PROVIDERS))


def resolve_version(provider: str, version: str | None) -> str:
    """The requested ``version``, or the provider's default when unspecified."""
    return version or get_provider(provider).default_version
