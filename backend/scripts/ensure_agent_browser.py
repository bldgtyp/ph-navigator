"""Provision or verify the stable local stack used for agent browser checks."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import signal
import subprocess
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

REPO_ROOT = Path(__file__).resolve().parents[2]
WORK_DIR = REPO_ROOT / "working" / "agent-browser"
STARTUP_TIMEOUT_SECONDS = 30.0
PROCESS_STOP_TIMEOUT_SECONDS = 5.0
MAX_MANAGED_LOG_BYTES = 5 * 1024 * 1024


@dataclass(frozen=True)
class Endpoint:
    """Application-specific readiness contract for one local service."""

    name: str
    url: str
    expected_status: int
    body_marker: str

    def matches(self, status: int, body: str) -> bool:
        """Return whether an HTTP response belongs to the expected service."""

        return status == self.expected_status and self.body_marker in body


@dataclass(frozen=True)
class FixtureIdentity:
    """Stable, non-overlapping browser fixture identity for one agent task."""

    email: str
    bt_number: str
    project_name: str


@dataclass(frozen=True)
class StartedService:
    """Detached service process started by this readiness run."""

    endpoint: Endpoint
    process: subprocess.Popen[bytes]
    log_path: Path
    pid_path: Path


BACKEND_ENDPOINT = Endpoint(
    name="backend",
    url="http://localhost:8000/api/v1/health",
    expected_status=200,
    body_marker='"service":"ph-navigator"',
)
FRONTEND_ENDPOINT = Endpoint(
    name="frontend",
    url="http://localhost:5173",
    expected_status=200,
    body_marker="<title>PH-Navigator V2</title>",
)
FRONTEND_API_ENDPOINT = Endpoint(
    name="frontend API proxy",
    url="http://localhost:5173/api/v1/health",
    expected_status=200,
    body_marker='"service":"ph-navigator"',
)


def main() -> None:
    """Provision or check the complete local browser stack."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify the endpoints without provisioning or seeding anything.",
    )
    args = parser.parse_args()

    WORK_DIR.mkdir(parents=True, exist_ok=True)
    with _exclusive_lock(WORK_DIR / "ready.lock"):
        if args.check:
            _check_stack()
        else:
            _provision_stack()

    print("Agent browser stack ready: frontend=:5173 backend=:8000")
    print(
        "Browser recovery rule: discard any tab that showed a network error or internal data: URL, "
        "then open the printed sign-in route in a fresh tab."
    )


def _provision_stack() -> None:
    _cap_managed_logs()
    _run_make("db-wait", "object-store-init", "migrate")
    _ensure_services()
    _ensure_fixture()


def _ensure_services() -> None:
    service_targets = ((BACKEND_ENDPOINT, "backend"), (FRONTEND_ENDPOINT, "frontend"))
    started: list[StartedService] = []
    for endpoint, target in service_targets:
        if _is_ready(endpoint):
            print(f"Reusing healthy {endpoint.name} at {endpoint.url}")
        else:
            started.append(_start_service(endpoint, target))

    _wait_for_started_services(started)
    if not _is_ready(FRONTEND_API_ENDPOINT):
        _stop_started_services(started)
        raise RuntimeError(
            f"Vite is running but its /api proxy cannot reach PH-Navigator. Inspect {WORK_DIR / 'frontend.log'}."
        )
    print(f"Verified same-origin API proxy at {FRONTEND_API_ENDPOINT.url}")


def _start_service(endpoint: Endpoint, make_target: str) -> StartedService:
    log_path = WORK_DIR / f"{endpoint.name}.log"
    pid_path = WORK_DIR / f"{endpoint.name}.pid"
    with log_path.open("ab", buffering=0) as log_file:
        process = subprocess.Popen(  # noqa: S603 - fixed repo-owned Make targets only
            ["make", "--no-print-directory", make_target],
            cwd=REPO_ROOT,
            env=_command_env(),
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
    pid_path.write_text(f"{process.pid}\n", encoding="utf-8")
    return StartedService(endpoint=endpoint, process=process, log_path=log_path, pid_path=pid_path)


def _wait_for_started_services(started: list[StartedService]) -> None:
    if not started:
        return

    pending = list(started)
    deadline = time.monotonic() + STARTUP_TIMEOUT_SECONDS
    while pending and time.monotonic() < deadline:
        for service in list(pending):
            if _is_ready(service.endpoint):
                print(f"Started {service.endpoint.name} at {service.endpoint.url} (pid {service.process.pid})")
                pending.remove(service)
            elif service.process.poll() is not None:
                deadline = 0.0
                break
        if pending:
            time.sleep(0.25)

    if not pending:
        return

    _stop_started_services(started)
    failures = "\n\n".join(
        f"{service.endpoint.name} did not become ready at {service.endpoint.url}. "
        f"Inspect {service.log_path}.\n--- log tail ---\n{_tail(service.log_path)}"
        for service in pending
    )
    raise RuntimeError(failures)


def _stop_started_services(started: list[StartedService]) -> None:
    for service in started:
        _stop_process_group(service.process)
        service.pid_path.unlink(missing_ok=True)


def _stop_process_group(process: subprocess.Popen[bytes]) -> None:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=PROCESS_STOP_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=PROCESS_STOP_TIMEOUT_SECONDS)


def _ensure_fixture() -> None:
    from scripts.seed_agent_browser_fixture import ensure_agent_browser_fixture

    identity = _agent_fixture_identity()
    fixture, created = ensure_agent_browser_fixture(
        email=identity.email,
        display_name="Codex Agent",
        password="password",
        bt_number=identity.bt_number,
        project_name=identity.project_name,
        frontend_url="http://localhost:5173",
    )
    action = "Seeded" if created else "Reused"
    print(f"{action} local agent browser fixture:")
    print(f"  login: {fixture.email} / {fixture.password}")
    print(f"  project: {fixture.bt_number} ({fixture.project_id})")
    print(f"  version: {fixture.version_id}")
    print(f"  dirty draft etag: {fixture.draft_etag}")
    print(f"  sign-in route: {fixture.sign_in_route}")
    print(f"  direct route: {fixture.route}")

    # Machine-readable manifest so browser tooling (font-audit sweep, agent
    # scripts) can discover the fixture identity without parsing stdout or
    # relying on a hardcoded project UUID.
    manifest = {
        "email": fixture.email,
        "password": fixture.password,
        "project_id": str(fixture.project_id),
        "version_id": str(fixture.version_id),
        "bt_number": fixture.bt_number,
        "route": fixture.route,
        "sign_in_route": fixture.sign_in_route,
    }
    (WORK_DIR / "fixture.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def _agent_fixture_identity() -> FixtureIdentity:
    raw_identity = os.environ.get("PHN_AGENT_BROWSER_ID") or os.environ.get("CODEX_THREAD_ID")
    if not raw_identity:
        return FixtureIdentity(
            email="codex@example.com",
            bt_number="AGENT-BROWSER",
            project_name="Agent Browser Fixture",
        )

    suffix = hashlib.sha256(raw_identity.encode("utf-8")).hexdigest()[:12]
    return FixtureIdentity(
        email=f"codex+{suffix}@example.com",
        bt_number=f"AGENT-BROWSER-{suffix.upper()}",
        project_name=f"Agent Browser Fixture {suffix.upper()}",
    )


def _run_make(*targets: str) -> None:
    subprocess.run(  # noqa: S603 - fixed repo-owned Make targets only
        ["make", "--no-print-directory", *targets],
        cwd=REPO_ROOT,
        env=_command_env(),
        check=True,
    )


def _command_env() -> dict[str, str]:
    env = os.environ.copy()
    for inherited_make_key in ("MAKEFLAGS", "MFLAGS", "MAKELEVEL"):
        env.pop(inherited_make_key, None)
    return env


def _cap_managed_logs() -> None:
    for service_name in (BACKEND_ENDPOINT.name, FRONTEND_ENDPOINT.name):
        path = WORK_DIR / f"{service_name}.log"
        try:
            if path.stat().st_size <= MAX_MANAGED_LOG_BYTES:
                continue
        except FileNotFoundError:
            continue
        with path.open("wb"):
            pass


def _check_stack() -> None:
    endpoints = (BACKEND_ENDPOINT, FRONTEND_ENDPOINT, FRONTEND_API_ENDPOINT)
    unavailable = [endpoint.name for endpoint in endpoints if not _is_ready(endpoint)]
    if unavailable:
        names = ", ".join(unavailable)
        raise SystemExit(f"Agent browser stack is not ready: {names}. Run `make agent-browser-ready`.")


def _is_ready(endpoint: Endpoint) -> bool:
    try:
        with urlopen(endpoint.url, timeout=1.0) as response:  # noqa: S310 - fixed localhost URLs only
            status = response.status
            body = response.read(16_384).decode("utf-8", errors="replace")
    except HTTPError as exc:
        status = exc.code
        body = exc.read(16_384).decode("utf-8", errors="replace")
    except (TimeoutError, URLError, OSError):
        return False
    return endpoint.matches(status, body)


def _tail(path: Path, line_count: int = 40) -> str:
    if not path.exists():
        return "(no log output)"
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[-line_count:]) or "(no log output)"


@contextmanager
def _exclusive_lock(path: Path) -> Iterator[None]:
    with path.open("a+", encoding="utf-8") as lock_file:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


if __name__ == "__main__":
    main()
