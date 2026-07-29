"""Small process-local cache for pure assembly-condensation results."""

from __future__ import annotations

from collections import OrderedDict

from features.envelope.condensation import CondensationResult

CACHE_MAX_ENTRIES = 128

_RESULTS: OrderedDict[str, CondensationResult] = OrderedDict()


def condensation_cache_get(input_hash: str) -> CondensationResult | None:
    """Return the result for an exact pure-input hash, if present."""

    return _RESULTS.get(input_hash)


def condensation_cache_put(result: CondensationResult) -> None:
    """Store one result and evict the oldest distinct hash at the bound."""

    is_new = result.input_hash not in _RESULTS
    _RESULTS[result.input_hash] = result
    if is_new:
        while len(_RESULTS) > CACHE_MAX_ENTRIES:
            _RESULTS.popitem(last=False)


def reset_condensation_cache() -> None:
    """Clear process-local results (tests and explicit operational resets)."""

    _RESULTS.clear()
