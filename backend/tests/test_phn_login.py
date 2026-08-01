"""Reference client tests for the PH-Navigator device login."""

from __future__ import annotations

import json
import stat
from datetime import UTC, datetime
from pathlib import Path

import httpx

from scripts.phn_login import poll_device_authorization, write_credentials


def test_poll_device_authorization_respects_slow_down_without_printing_token(
    capsys,
) -> None:
    responses = iter(
        [
            {"status": "authorization_pending", "interval": 5},
            {"status": "slow_down", "interval": 10},
            {
                "status": "approved",
                "token": "phn_mcp_plaintext",
                "token_record": {
                    "id": "2cfaad1a-8fc0-4535-b66c-7729db8f86e7",
                    "project_id": None,
                    "label": "Ed MacBook",
                    "token_prefix": "phn_mcp_plaintex",
                    "scopes": ["project:read"],
                    "created_at": "2026-08-01T16:30:00Z",
                    "last_used_at": None,
                    "expires_at": "2027-08-01T16:30:00Z",
                    "revoked_at": None,
                },
            },
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/v1/agent-tokens/device/poll"
        return httpx.Response(200, json=next(responses))

    sleeps: list[float] = []
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        result = poll_device_authorization(
            client,
            api_url="https://api.ph-nav.com",
            device_code="phn_device_secret",
            interval=5,
            expires_in=600,
            sleep=sleeps.append,
        )

    assert sleeps == [5, 5, 10]
    assert result.status == "approved"
    assert capsys.readouterr().out == ""


def test_write_credentials_is_atomic_owner_only_and_structured(tmp_path: Path) -> None:
    credentials_path = tmp_path / ".config" / "phn" / "credentials.json"
    issued_at = datetime(2026, 8, 1, 16, 30, tzinfo=UTC)

    write_credentials(
        credentials_path,
        api_url="https://api.ph-nav.com/",
        token="phn_mcp_plaintext",
        label="Ed MacBook",
        issued_at=issued_at,
    )

    assert stat.S_IMODE(credentials_path.stat().st_mode) == 0o600
    assert json.loads(credentials_path.read_text()) == {
        "phn_api": "https://api.ph-nav.com",
        "token": "phn_mcp_plaintext",
        "label": "Ed MacBook",
        "issued": "2026-08-01T16:30:00+00:00",
    }
