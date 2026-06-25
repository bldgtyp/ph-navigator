"""Static backend feature-shape and import-boundary checks."""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEATURES = ROOT / "features"

THIN_FEATURE_EXEMPTIONS = {
    "aperture_drift": "read-only computed route; persistence is delegated to project document readers",
    "aperture_hbjson_export": "export-only route with no repository",
    "aperture_u_value": "computed route with no persistence",
    "apertures": "document-backed command/computed surface with no relational repository",
    "apertures_mcp": "MCP adapters over aperture services",
    "schemas": "OpenAPI/schema export surface",
    "shared": "shared helpers, not a feature package",
    "system": "health/version route with no repository",
}


@dataclass(frozen=True)
class Finding:
    path: Path
    message: str

    def render(self) -> str:
        return f"{self.path.relative_to(ROOT)}: {self.message}"


def main() -> None:
    findings: list[Finding] = []
    findings.extend(_check_feature_shape())
    findings.extend(_check_import_boundaries())
    if findings:
        print("Backend boundary check failed:")
        for finding in findings:
            print(f"  - {finding.render()}")
        raise SystemExit(1)
    print("Backend boundary check passed.")


def _check_feature_shape() -> list[Finding]:
    findings: list[Finding] = []
    for package in sorted(path for path in FEATURES.iterdir() if path.is_dir() and not path.name.startswith("__")):
        if package.name in THIN_FEATURE_EXEMPTIONS:
            continue
        has_routes = (package / "routes.py").exists()
        has_service = (package / "service.py").exists()
        if not has_routes and not has_service:
            continue
        for filename in ("routes.py", "models.py", "service.py", "repository.py"):
            if not (package / filename).exists():
                findings.append(Finding(package, f"missing required feature layer {filename}"))
        if (package / "schemas.py").exists():
            findings.append(Finding(package / "schemas.py", "feature DTO boundary must be models.py, not schemas.py"))
    return findings


def _check_import_boundaries() -> list[Finding]:
    findings: list[Finding] = []
    for path in sorted(FEATURES.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        tree = ast.parse(path.read_text(), filename=str(path))
        module_name = path.name
        if module_name == "routes.py" and _imports_module(tree, "database"):
            findings.append(Finding(path, "routes.py must not import database"))
        if module_name == "repository.py" and _imports_fastapi(tree):
            findings.append(Finding(path, "repository.py must not import FastAPI request/response types"))
    return findings


def _imports_module(tree: ast.AST, module: str) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.name == module or alias.name.startswith(f"{module}.") for alias in node.names):
                return True
        elif isinstance(node, ast.ImportFrom) and (
            node.module == module or (node.module or "").startswith(f"{module}.")
        ):
            return True
    return False


def _imports_fastapi(tree: ast.AST) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(alias.name == "fastapi" or alias.name.startswith("fastapi.") for alias in node.names):
                return True
        elif isinstance(node, ast.ImportFrom) and (
            node.module == "fastapi" or (node.module or "").startswith("fastapi.")
        ):
            return True
    return False


if __name__ == "__main__":
    main()
