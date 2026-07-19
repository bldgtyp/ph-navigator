"""Static production deployment contracts shared by API and web releases."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_web_marker_is_cache_safe_and_polled_before_smoke() -> None:
    render_config = (ROOT / "render.prod.yaml").read_text(encoding="utf-8")
    deploy_workflow = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")

    assert (
        '- path: /version.json\n        name: Cache-Control\n        value: "no-store, max-age=0, must-revalidate"'
        in render_config
    )
    assert "name: Verify API and web deploys (git_sha match)" in deploy_workflow
    assert "https://www.ph-nav.com/version.json?deploy_sha=$DEPLOY_SHA&attempt=$i" in deploy_workflow
    assert deploy_workflow.index("name: Verify API and web deploys") < deploy_workflow.index(
        "name: Smoke-check public surfaces"
    )
