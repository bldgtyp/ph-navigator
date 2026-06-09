"""Perf gate for record-linking inverse-view construction."""

from __future__ import annotations

import json
from pathlib import Path
from statistics import median
from time import perf_counter

from features.project_document.inverse_view import build_inverse_links, build_snapshot_row_ids
from tests.builders.record_linking_perf_doc import build_record_linking_perf_document

BASELINE_PATH = Path(__file__).parent / "baselines" / "record_linking_perf.json"


def test_inverse_view_perf_gate() -> None:
    body = build_record_linking_perf_document()
    snapshot_row_ids = build_snapshot_row_ids(body)
    baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    threshold_ms = float(baseline["inverse_view_median_ms"])

    warmup = build_inverse_links(body, snapshot_row_ids=snapshot_row_ids)
    assert len(warmup[("equipment", "pumps")]) == 50
    assert (
        sum(
            len(source_row_ids)
            for by_source in warmup[("equipment", "pumps")].values()
            for source_row_ids in by_source.values()
        )
        == 13000
    )

    samples: list[float] = []
    for _ in range(7):
        start = perf_counter()
        inverse = build_inverse_links(body, snapshot_row_ids=snapshot_row_ids)
        samples.append((perf_counter() - start) * 1000)

    median_ms = median(samples)
    assert len(inverse[("equipment", "pumps")]) == 50
    assert median_ms < threshold_ms, (
        f"inverse-view median {median_ms:.2f}ms exceeded {threshold_ms:.2f}ms "
        f"(samples: {[round(sample, 2) for sample in samples]})"
    )
