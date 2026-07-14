"""Tests for the agent browser readiness utility."""

from scripts.ensure_agent_browser import (
    BACKEND_ENDPOINT,
    FRONTEND_API_ENDPOINT,
    FRONTEND_ENDPOINT,
    Endpoint,
    _agent_fixture_identity,
)
from scripts.seed_agent_browser_fixture import _has_seeded_dirty_room


def test_endpoint_requires_expected_status_and_application_marker() -> None:
    endpoint = Endpoint(name="test", url="http://localhost", expected_status=200, body_marker="PHN")

    assert endpoint.matches(200, "PHN ready")
    assert not endpoint.matches(503, "PHN ready")
    assert not endpoint.matches(200, "unrelated service")


def test_browser_endpoints_identify_ph_navigator_services() -> None:
    assert BACKEND_ENDPOINT.matches(
        200,
        '{"status":"ok","service":"ph-navigator","api_version":"v1"}',
    )
    assert FRONTEND_ENDPOINT.matches(
        200,
        "<!doctype html><title>PH-Navigator V2</title>",
    )
    assert FRONTEND_API_ENDPOINT.matches(
        200,
        '{"status":"ok","service":"ph-navigator"}',
    )


def test_agent_fixture_identity_is_stable_and_isolated(monkeypatch) -> None:
    monkeypatch.setenv("CODEX_THREAD_ID", "thread-a")
    first = _agent_fixture_identity()
    monkeypatch.setenv("CODEX_THREAD_ID", "thread-b")
    second = _agent_fixture_identity()

    assert first.email.startswith("codex+")
    assert first == _identity_for(monkeypatch, "thread-a")
    assert first != second


def test_fixture_health_requires_seeded_dirty_room() -> None:
    assert _has_seeded_dirty_room({"tables": {"rooms": {"rows": [{"id": "rm_agent_browser"}]}}})
    assert not _has_seeded_dirty_room({"tables": {"rooms": {"rows": []}}})


def _identity_for(monkeypatch, thread_id: str):
    monkeypatch.setenv("CODEX_THREAD_ID", thread_id)
    return _agent_fixture_identity()
