"""Obtain and store a PH-Navigator user token through browser approval."""

from __future__ import annotations

import argparse
import json
import os
import platform
import tempfile
import time
import webbrowser
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import cast

import httpx

from features.mcp.models import (
    ALL_MCP_SCOPES,
    McpDeviceAuthorizationApprovedPoll,
    McpDeviceAuthorizationDeniedPoll,
    McpDeviceAuthorizationExpiredPoll,
    McpDeviceAuthorizationPendingPoll,
    McpDeviceAuthorizationSlowDownPoll,
    McpDeviceAuthorizationStart,
)

DEFAULT_API_URL = "https://api.ph-nav.com"


class DeviceLoginError(RuntimeError):
    """A device authorization failed without yielding a credential."""


def request_device_authorization(
    client: httpx.Client,
    *,
    api_url: str,
    label: str,
    scopes: Sequence[str],
) -> McpDeviceAuthorizationStart:
    response = client.post(
        f"{api_url.rstrip('/')}/api/v1/agent-tokens/device",
        json={"label": label, "scopes": list(scopes)},
    )
    response.raise_for_status()
    return McpDeviceAuthorizationStart.model_validate(response.json())


def poll_device_authorization(
    client: httpx.Client,
    *,
    api_url: str,
    device_code: str,
    interval: int,
    expires_in: int,
    sleep: Callable[[float], None] = time.sleep,
) -> McpDeviceAuthorizationApprovedPoll:
    deadline = time.monotonic() + expires_in
    current_interval = interval
    while time.monotonic() < deadline:
        sleep(current_interval)
        response = client.post(
            f"{api_url.rstrip('/')}/api/v1/agent-tokens/device/poll",
            json={"device_code": device_code},
        )
        response.raise_for_status()
        payload = _parse_poll_response(response.json())
        if isinstance(payload, McpDeviceAuthorizationApprovedPoll):
            return payload
        if isinstance(payload, (McpDeviceAuthorizationPendingPoll, McpDeviceAuthorizationSlowDownPoll)):
            current_interval = payload.interval
            continue
        if isinstance(payload, McpDeviceAuthorizationDeniedPoll):
            raise DeviceLoginError("Agent access was denied in PH-Navigator.")
        if isinstance(payload, McpDeviceAuthorizationExpiredPoll):
            raise DeviceLoginError("Agent login expired; start it again.")
    raise DeviceLoginError("Agent login expired before approval.")


def _parse_poll_response(
    payload: object,
) -> (
    McpDeviceAuthorizationApprovedPoll
    | McpDeviceAuthorizationPendingPoll
    | McpDeviceAuthorizationSlowDownPoll
    | McpDeviceAuthorizationDeniedPoll
    | McpDeviceAuthorizationExpiredPoll
):
    if not isinstance(payload, dict):
        raise DeviceLoginError("PH-Navigator returned an invalid device-login response.")
    response_payload = cast(dict[str, object], payload)
    status = response_payload.get("status")
    model_by_status = {
        "approved": McpDeviceAuthorizationApprovedPoll,
        "authorization_pending": McpDeviceAuthorizationPendingPoll,
        "slow_down": McpDeviceAuthorizationSlowDownPoll,
        "denied": McpDeviceAuthorizationDeniedPoll,
        "expired": McpDeviceAuthorizationExpiredPoll,
    }
    if not isinstance(status, str):
        raise DeviceLoginError("PH-Navigator returned an invalid device-login status.")
    model = model_by_status.get(status)
    if model is None:
        raise DeviceLoginError("PH-Navigator returned an unknown device-login status.")
    return model.model_validate(response_payload)


def write_credentials(
    path: Path,
    *,
    api_url: str,
    token: str,
    label: str,
    issued_at: datetime | None = None,
) -> None:
    """Atomically replace the credentials file with owner-only permissions."""
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    payload = {
        "phn_api": api_url.rstrip("/"),
        "token": token,
        "label": label,
        "issued": (issued_at or datetime.now(UTC)).isoformat(),
    }
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent, text=True)
    temporary_path = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)
            handle.write("\n")
        os.replace(temporary_path, path)
        path.chmod(0o600)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Authorize this machine for PH-Navigator without copying a token.",
    )
    parser.add_argument("--api", default=DEFAULT_API_URL, help="PH-Navigator API base URL.")
    parser.add_argument("--label", default=f"{platform.node() or 'Local machine'} agent")
    parser.add_argument(
        "--scope",
        action="append",
        choices=list(ALL_MCP_SCOPES),
        dest="scopes",
        help="Repeat to override the default full agent scopes.",
    )
    parser.add_argument(
        "--credentials",
        type=Path,
        default=Path.home() / ".config" / "phn" / "credentials.json",
    )
    parser.add_argument("--no-browser", action="store_true", help="Print the URL without opening it.")
    args = parser.parse_args()
    scopes = args.scopes or list(ALL_MCP_SCOPES)

    try:
        with httpx.Client(timeout=15, headers={"User-Agent": "phn-login/1"}) as client:
            started = request_device_authorization(
                client,
                api_url=args.api,
                label=args.label,
                scopes=scopes,
            )
            verification_url = started.verification_url
            print(f"Approve PH-Navigator agent access in your browser:\n  {verification_url}")
            print(f"User code: {started.user_code}")
            if not args.no_browser:
                webbrowser.open(verification_url)
            redeemed = poll_device_authorization(
                client,
                api_url=args.api,
                device_code=started.device_code,
                interval=started.interval,
                expires_in=started.expires_in,
            )
        write_credentials(
            args.credentials,
            api_url=args.api,
            token=redeemed.token,
            label=args.label,
        )
    except (httpx.HTTPError, DeviceLoginError, KeyError, ValueError) as exc:
        raise SystemExit(f"PH-Navigator login failed: {exc}") from exc

    print(f"PH-Navigator credentials saved to {args.credentials} (mode 0600).")


if __name__ == "__main__":
    main()
