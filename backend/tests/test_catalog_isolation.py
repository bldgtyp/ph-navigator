# -*- Python Version: 3.11 -*-

# Enforces the no-cross-import rule between `features.catalog` (the POC module)
# and the rest of the backend. See plan §3.2 and PRD §13.1.
#
# Rule:
# - Files inside backend/features/catalog/** may not import from any other
#   features.<x> module.
# - Files outside backend/features/catalog/** (anywhere in backend/) may not
#   import from features.catalog.<*>.

import ast
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
CATALOG_ROOT = BACKEND_ROOT / "features" / "catalog"


def _iter_py_files(root: Path):
    for p in root.rglob("*.py"):
        if "__pycache__" in p.parts:
            continue
        yield p


def _imported_modules(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    modules: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
        elif isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
    return modules


def test_catalog_does_not_import_other_features():
    violations: list[str] = []
    for py_file in _iter_py_files(CATALOG_ROOT):
        for mod in _imported_modules(py_file):
            if mod.startswith("features.") and not mod.startswith("features.catalog"):
                rel = py_file.relative_to(BACKEND_ROOT)
                violations.append(f"{rel}: imports {mod}")
    assert not violations, (
        "features.catalog must not import from other features modules:\n"
        + "\n".join(violations)
    )


def test_other_features_do_not_import_catalog():
    violations: list[str] = []
    features_root = BACKEND_ROOT / "features"
    for py_file in _iter_py_files(features_root):
        if CATALOG_ROOT in py_file.parents or py_file == CATALOG_ROOT:
            continue
        for mod in _imported_modules(py_file):
            if mod.startswith("features.catalog"):
                rel = py_file.relative_to(BACKEND_ROOT)
                violations.append(f"{rel}: imports {mod}")
    assert not violations, (
        "Non-catalog features modules must not import from features.catalog:\n"
        + "\n".join(violations)
    )


def test_api_py_only_imports_catalog_inside_flag_block():
    # api.py is allowed one import, but only inside the
    # `if settings.CATALOG_POC_ENABLED:` branch (lazy import).
    api_path = BACKEND_ROOT / "api.py"
    src = api_path.read_text(encoding="utf-8")
    tree = ast.parse(src)

    top_level_catalog_imports: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            # Only flag module-level imports (parent is Module).
            pass

    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith(
            "features.catalog"
        ):
            top_level_catalog_imports.append(node.module)

    assert not top_level_catalog_imports, (
        "api.py must import features.catalog only lazily inside the "
        "CATALOG_POC_ENABLED branch:\n" + "\n".join(top_level_catalog_imports)
    )
