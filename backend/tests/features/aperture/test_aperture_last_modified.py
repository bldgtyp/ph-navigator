# -*- Python Version: 3.11 -*-
"""Tests for the per-aperture ``last_modified`` timestamp feature.

The aperture catalog endpoint exposes a ``last_modified`` ISO-8601 UTC
timestamp on each aperture. The HB Room Builder Rhino plugin uses this
as a coarse "has this type been touched?" signal to flag stale block
geometry. See ``docs/plans/260501/aperture-last-modified-timestamp.md``
for the full design.

These tests cover three layers:

1. **Route-level** — the JSON payload includes ``last_modified`` in the
   committed wire format (UTC ISO-8601 with trailing ``Z``).
2. **Stability** — across reads with no mutations the value is
   byte-equal; per-aperture mutations on aperture A do not perturb
   aperture B's timestamp.
3. **Cascade** — frame-type / glazing-type catalog edits propagate
   into the aggregate ``last_modified`` of every aperture that
   references them.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone

import pytest
from db_entities.aperture.aperture import Aperture
from db_entities.aperture.aperture_element import ApertureElement
from db_entities.aperture.aperture_frame import ApertureElementFrame
from db_entities.aperture.aperture_glazing import ApertureElementGlazing
from db_entities.aperture.frame_type import ApertureFrameType
from db_entities.aperture.glazing_type import ApertureGlazingType
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# ``Z``-suffixed ISO-8601 UTC, e.g. "2026-04-28T14:32:00Z" or
# "2026-04-28T14:32:00.123456Z". The Rhino plugin will do literal
# string equality on this format, so the regex pins it tight.
_ISO_Z_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$"
)


def _backdate_aperture(db: Session, aperture: Aperture) -> None:
    """Force every row in this aperture's type definition into the past.

    SQLite resolves ``CURRENT_TIMESTAMP`` to the second, so a naive
    "snapshot, mutate, assert after > before" sequence is racy unless
    the baseline is far enough back that the next ``func.now()`` write
    is guaranteed greater. Backdating one minute is plenty.

    This is preferred over ``time.sleep(1.05)`` because it keeps the
    test suite tight without compromising what's exercised: the
    mutation path still goes through ``func.now()`` end-to-end.
    """
    past = datetime.now(timezone.utc) - timedelta(minutes=1)

    db.query(Aperture).filter(Aperture.id == aperture.id).update(
        {Aperture.last_modified: past}
    )
    element_ids = [e.id for e in aperture.elements]
    if element_ids:
        db.query(ApertureElement).filter(
            ApertureElement.id.in_(element_ids)
        ).update({ApertureElement.last_modified: past}, synchronize_session=False)

        glazing_ids = [e.glazing_id for e in aperture.elements if e.glazing_id]
        if glazing_ids:
            db.query(ApertureElementGlazing).filter(
                ApertureElementGlazing.id.in_(glazing_ids)
            ).update(
                {ApertureElementGlazing.last_modified: past},
                synchronize_session=False,
            )

        frame_ids = [
            fid
            for e in aperture.elements
            for fid in e.frame_ids
            if fid is not None
        ]
        if frame_ids:
            db.query(ApertureElementFrame).filter(
                ApertureElementFrame.id.in_(frame_ids)
            ).update(
                {ApertureElementFrame.last_modified: past},
                synchronize_session=False,
            )

    db.query(ApertureFrameType).update(
        {ApertureFrameType.last_modified: past}, synchronize_session=False
    )
    db.query(ApertureGlazingType).update(
        {ApertureGlazingType.last_modified: past}, synchronize_session=False
    )
    db.commit()


def _get_aperture_payload(client: TestClient, bt_number: str, name: str) -> dict:
    """Pull the named aperture out of the get-apertures-as-json route payload."""
    response = client.get(f"/aperture/get-apertures-as-json/{bt_number}")
    assert response.status_code == 200
    apertures = json.loads(response.json()["apertures"])
    assert name in apertures, f"aperture {name!r} missing from payload"
    return apertures[name]


def test_route_payload_includes_last_modified(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """RED-anchor: each aperture record exposes ``last_modified``.

    Acceptance criterion #1 from the request: every record in the
    response includes a ``last_modified`` field.
    """
    aperture_data = _get_aperture_payload(client, "AP001", "Test Aperture")
    assert "last_modified" in aperture_data


def test_route_last_modified_is_iso8601_z_format(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """The wire format is UTC ISO-8601 with trailing ``Z``.

    Acceptance criterion #5: format is consistent and parseable. We
    commit to ``Z`` (not ``+00:00``) because the Rhino plugin will do
    literal string equality between stored and freshly-fetched values.
    """
    aperture_data = _get_aperture_payload(client, "AP001", "Test Aperture")
    last_modified = aperture_data["last_modified"]

    assert isinstance(last_modified, str)
    assert _ISO_Z_RE.match(last_modified), (
        f"last_modified {last_modified!r} is not in the expected "
        f"UTC ISO-8601-with-Z format"
    )
    # And round-trips through datetime parsing as UTC.
    parsed = datetime.fromisoformat(last_modified.replace("Z", "+00:00"))
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == timezone.utc.utcoffset(parsed)


def test_route_last_modified_stable_across_reads(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """Acceptance criterion #3: stable across reads when nothing changes.

    Three back-to-back GETs must produce byte-equal ``last_modified``
    values. If they don't, the Rhino plugin would flag every block as
    stale on every sync.
    """
    payload_1 = _get_aperture_payload(client, "AP001", "Test Aperture")
    payload_2 = _get_aperture_payload(client, "AP001", "Test Aperture")
    payload_3 = _get_aperture_payload(client, "AP001", "Test Aperture")

    assert payload_1["last_modified"] == payload_2["last_modified"]
    assert payload_2["last_modified"] == payload_3["last_modified"]


def test_route_last_modified_unaffected_by_unrelated_aperture_mutation(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """Acceptance criterion #4: per-record granularity.

    Mutating aperture B must not change aperture A's ``last_modified``.
    """
    # Create a second aperture in the same project.
    project = sample_aperture_with_elements.project
    frame_type = test_db.query(ApertureFrameType).first()
    glazing_type = test_db.query(ApertureGlazingType).first()
    assert frame_type is not None and glazing_type is not None

    from tests.features.aperture.conftest import create_aperture_with_element

    create_aperture_with_element(
        test_db,
        project,
        name="Other Aperture",
        frame_type=frame_type,
        glazing_type=glazing_type,
    )

    a_before = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]

    # Mutate the OTHER aperture's name. This is the simplest mutation
    # available via the public API.
    other = (
        test_db.query(Aperture)
        .filter(Aperture.name == "Other Aperture")
        .one()
    )
    response = client.patch(
        f"/aperture/update-aperture-name/{other.id}",
        json={"new_name": "Other Aperture (renamed)"},
    )
    assert response.status_code == 200

    a_after = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]
    assert a_before == a_after, (
        "mutating an unrelated aperture must not change this aperture's "
        "last_modified"
    )


def test_route_last_modified_advances_on_mutation(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """Acceptance criterion #2: any mutation bumps ``last_modified``."""
    aperture = sample_aperture_with_elements
    _backdate_aperture(test_db, aperture)
    before = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]

    response = client.patch(
        f"/aperture/update-aperture-name/{aperture.id}",
        json={"new_name": "Test Aperture (renamed)"},
    )
    assert response.status_code == 200

    after = _get_aperture_payload(client, "AP001", "Test Aperture (renamed)")[
        "last_modified"
    ]
    assert after > before, f"before={before} after={after}"


def test_route_last_modified_advances_on_frame_type_catalog_edit(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """Catalog cascade: editing a referenced ``ApertureFrameType`` row
    must advance the aggregate ``last_modified`` of every aperture
    that references it.
    """
    _backdate_aperture(test_db, sample_aperture_with_elements)
    before = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]

    frame_type = test_db.query(ApertureFrameType).first()
    assert frame_type is not None
    frame_type.u_value_w_m2k = frame_type.u_value_w_m2k + 0.1
    test_db.commit()

    after = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]
    assert after > before, f"before={before} after={after}"


def test_route_last_modified_advances_on_glazing_type_catalog_edit(
    client: TestClient,
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """Catalog cascade — symmetric to the frame-type test."""
    _backdate_aperture(test_db, sample_aperture_with_elements)
    before = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]

    glazing_type = test_db.query(ApertureGlazingType).first()
    assert glazing_type is not None
    glazing_type.u_value_w_m2k = glazing_type.u_value_w_m2k + 0.1
    test_db.commit()

    after = _get_aperture_payload(client, "AP001", "Test Aperture")["last_modified"]
    assert after > before, f"before={before} after={after}"


def test_sibling_element_last_modified_moves_on_start_row_insert(
    test_db: Session,
    sample_aperture_with_elements: Aperture,
) -> None:
    """Sibling-shift correctness (plan §5.3 edge case 3 / §6.3).

    The START-insert path uses a Core-level ``Query.update`` to shift
    sibling ``row_number``\\ s. The plan flagged this as a possible
    blind spot for ``onupdate``; the service patch sets
    ``last_modified: func.now()`` explicitly in the update dict.
    """
    from features.aperture.schemas.aperture import InsertPosition
    from features.aperture.services.aperture import add_row_to_aperture

    aperture = sample_aperture_with_elements
    _backdate_aperture(test_db, aperture)

    pre_existing_element = (
        test_db.query(ApertureElement)
        .filter(ApertureElement.aperture_id == aperture.id)
        .order_by(ApertureElement.id.asc())
        .first()
    )
    assert pre_existing_element is not None
    before = pre_existing_element.last_modified

    add_row_to_aperture(
        test_db, aperture.id, row_height_mm=500.0, position=InsertPosition.START
    )

    test_db.refresh(pre_existing_element)
    after = pre_existing_element.last_modified

    # SQLite drops tzinfo on read from a timezone=True column; normalize.
    if before.tzinfo is None:
        before = before.replace(tzinfo=timezone.utc)
    if after.tzinfo is None:
        after = after.replace(tzinfo=timezone.utc)

    assert after > before, f"before={before} after={after}"


@pytest.mark.parametrize(
    "model_path,column_name",
    [
        ("db_entities.aperture.aperture.Aperture", "last_modified"),
        ("db_entities.aperture.aperture_element.ApertureElement", "last_modified"),
        (
            "db_entities.aperture.aperture_glazing.ApertureElementGlazing",
            "last_modified",
        ),
        ("db_entities.aperture.aperture_frame.ApertureElementFrame", "last_modified"),
        ("db_entities.aperture.glazing_type.ApertureGlazingType", "last_modified"),
        ("db_entities.aperture.frame_type.ApertureFrameType", "last_modified"),
    ],
)
def test_all_six_entities_have_last_modified_column(
    test_db: Session, model_path: str, column_name: str
) -> None:
    """Lowest-layer schema check.

    All six entities involved in the "type definition" (per plan §4)
    must expose a ``last_modified`` column on the ORM model so the
    serializer's aggregation walk has something to read from.
    """
    module_path, _, attr = model_path.rpartition(".")
    module = __import__(module_path, fromlist=[attr])
    model = getattr(module, attr)

    assert column_name in model.__table__.columns, (
        f"{model.__name__} is missing required column {column_name!r}"
    )
    column = model.__table__.columns[column_name]
    assert not column.nullable, (
        f"{model.__name__}.{column_name} must be NOT NULL "
        f"(server_default = func.now() ensures existing rows have a value)"
    )
