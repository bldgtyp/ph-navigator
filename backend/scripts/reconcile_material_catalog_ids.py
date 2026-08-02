"""Reconcile legacy material catalog ids with the canonical stable seed ids.

This is a one-time operational bridge for databases populated before material
seed ids became deterministic. The command is read-only by default. ``--apply``
updates catalog ids and every saved/draft project-material provenance reference
in one transaction.
"""

from __future__ import annotations

import argparse
import copy
import json
from dataclasses import asdict, dataclass
from typing import Any, cast

from psycopg import Connection
from psycopg.types.json import Jsonb

from config import settings
from database import transaction
from features.project_document.validation import (
    document_etag,
    next_draft_etag_from_etag,
    validate_document,
)
from scripts._catalog_seed_ids import load_catalog_seed
from scripts._seed_paths import MATERIALS_SEED_PATH


class CatalogIdentityReconciliationError(RuntimeError):
    """The current catalog cannot be reconciled without ambiguity."""


@dataclass(frozen=True)
class ReconciliationReport:
    canonical_rows: int
    already_stable_rows: int
    remapped_rows: int
    version_documents_changed: int
    version_references_changed: int
    draft_documents_changed: int
    draft_references_changed: int
    applied: bool


@dataclass(frozen=True)
class _DocumentUpdate:
    key: tuple[object, ...]
    body: dict[str, Any]
    old_etag: str
    new_etag: str
    references_changed: int


def _rewrite_material_references(
    body: dict[str, Any],
    replacements: dict[str, str],
) -> tuple[dict[str, Any], int]:
    tables = body.get("tables")
    if not isinstance(tables, dict):
        return body, 0
    materials = tables.get("project_materials")
    if not isinstance(materials, list):
        return body, 0

    changes: list[tuple[int, str]] = []
    for index, material in enumerate(materials):
        if not isinstance(material, dict):
            continue
        material_dict = cast(dict[str, Any], material)
        origin = material_dict.get("catalog_origin")
        if not isinstance(origin, dict) or origin.get("catalog_table") != "materials":
            continue
        old_id = origin.get("catalog_record_id")
        if isinstance(old_id, str) and old_id in replacements:
            changes.append((index, replacements[old_id]))
    if not changes:
        return body, 0

    rewritten = copy.deepcopy(body)
    rewritten_materials = rewritten["tables"]["project_materials"]
    for index, new_id in changes:
        rewritten_materials[index]["catalog_origin"]["catalog_record_id"] = new_id
    return rewritten, len(changes)


def _expected_ids() -> dict[str, str]:
    seed = load_catalog_seed(MATERIALS_SEED_PATH)
    rows = seed["rows"]
    return {str(row["name"]): str(row["id"]) for row in rows}


def _catalog_replacements(
    rows: list[dict[str, Any]],
    expected: dict[str, str],
) -> tuple[dict[str, str], int]:
    rows_by_name: dict[str, list[dict[str, Any]]] = {}
    rows_by_id = {str(row["id"]): row for row in rows}
    for row in rows:
        name = str(row["name"])
        if name in expected:
            rows_by_name.setdefault(name, []).append(row)

    missing = sorted(set(expected) - set(rows_by_name))
    duplicates = sorted(name for name, matches in rows_by_name.items() if len(matches) != 1)
    if missing or duplicates:
        raise CatalogIdentityReconciliationError(
            f"Canonical material roster is not one-to-one: missing={len(missing)} duplicate_names={len(duplicates)}."
        )

    replacements: dict[str, str] = {}
    already_stable = 0
    for name, expected_id in expected.items():
        current_id = str(rows_by_name[name][0]["id"])
        target_owner = rows_by_id.get(expected_id)
        if target_owner is not None and str(target_owner["name"]) != name:
            raise CatalogIdentityReconciliationError("A canonical target id is already owned by a different material.")
        if current_id == expected_id:
            already_stable += 1
        else:
            replacements[current_id] = expected_id
    return replacements, already_stable


def _document_updates(
    rows: list[dict[str, Any]],
    replacements: dict[str, str],
    *,
    key_fields: tuple[str, ...],
) -> list[_DocumentUpdate]:
    updates: list[_DocumentUpdate] = []
    for row in rows:
        body = dict(row["body"])
        rewritten, references_changed = _rewrite_material_references(body, replacements)
        if not references_changed:
            continue
        old_etag = document_etag(validate_document(body))
        new_etag = document_etag(validate_document(rewritten))
        updates.append(
            _DocumentUpdate(
                key=tuple(row[field] for field in key_fields),
                body=rewritten,
                old_etag=old_etag,
                new_etag=new_etag,
                references_changed=references_changed,
            )
        )
    return updates


def reconcile_material_catalog_ids(
    conn: Connection[Any],
    *,
    apply: bool,
    expected: dict[str, str] | None = None,
) -> ReconciliationReport:
    """Plan or atomically apply the legacy-id reconciliation."""
    with conn.transaction():
        return _reconcile_material_catalog_ids(conn, apply=apply, expected=expected)


def _reconcile_material_catalog_ids(
    conn: Connection[Any],
    *,
    apply: bool,
    expected: dict[str, str] | None,
) -> ReconciliationReport:
    canonical_ids = expected or _expected_ids()
    if apply:
        conn.execute(
            "LOCK TABLE catalog_materials, project_versions, project_version_drafts IN SHARE ROW EXCLUSIVE MODE"
        )

    catalog_rows = list(conn.execute("SELECT id, name FROM catalog_materials").fetchall())
    replacements, already_stable = _catalog_replacements(catalog_rows, canonical_ids)

    version_rows = list(conn.execute("SELECT id, body FROM project_versions").fetchall())
    version_updates = _document_updates(version_rows, replacements, key_fields=("id",))
    version_etags = {update.key[0]: update for update in version_updates}

    draft_rows = list(
        conn.execute("SELECT version_id, user_id, body, base_version_etag FROM project_version_drafts").fetchall()
    )
    draft_updates = _document_updates(
        draft_rows,
        replacements,
        key_fields=("version_id", "user_id"),
    )

    for draft in draft_rows:
        version_update = version_etags.get(draft["version_id"])
        if version_update is None:
            continue
        if str(draft["base_version_etag"]) != version_update.old_etag:
            raise CatalogIdentityReconciliationError(
                "A draft base ETag does not match its saved version; reconciliation aborted."
            )

    if apply:
        for update in version_updates:
            cursor = conn.execute(
                "UPDATE project_versions SET body = %(body)s WHERE id = %(version_id)s",
                {
                    "body": Jsonb(update.body),
                    "version_id": update.key[0],
                },
            )
            if cursor.rowcount != 1:
                raise CatalogIdentityReconciliationError("A saved version changed during reconciliation.")

        for update in draft_updates:
            version_update = version_etags.get(update.key[0])
            base_etag = version_update.new_etag if version_update is not None else None
            cursor = conn.execute(
                """
                UPDATE project_version_drafts
                SET body = %(body)s,
                    base_version_etag = COALESCE(%(base_version_etag)s, base_version_etag),
                    draft_etag = %(draft_etag)s,
                    last_patched_at = now()
                WHERE version_id = %(version_id)s
                  AND user_id = %(user_id)s
                """,
                {
                    "body": Jsonb(update.body),
                    "base_version_etag": base_etag,
                    "draft_etag": next_draft_etag_from_etag(update.new_etag),
                    "version_id": update.key[0],
                    "user_id": update.key[1],
                },
            )
            if cursor.rowcount != 1:
                raise CatalogIdentityReconciliationError("A draft changed during reconciliation.")

        # A draft can reference no affected material while its saved base does.
        # Keep that draft's base ETag aligned even when its body needs no rewrite.
        rewritten_draft_keys = {update.key for update in draft_updates}
        for draft in draft_rows:
            key = (draft["version_id"], draft["user_id"])
            version_update = version_etags.get(draft["version_id"])
            if version_update is None or key in rewritten_draft_keys:
                continue
            conn.execute(
                """
                UPDATE project_version_drafts
                SET base_version_etag = %(base_version_etag)s
                WHERE version_id = %(version_id)s
                  AND user_id = %(user_id)s
                """,
                {
                    "base_version_etag": version_update.new_etag,
                    "version_id": draft["version_id"],
                    "user_id": draft["user_id"],
                },
            )

        for old_id, new_id in replacements.items():
            cursor = conn.execute(
                "UPDATE catalog_materials SET id = %(new_id)s WHERE id = %(old_id)s",
                {"new_id": new_id, "old_id": old_id},
            )
            if cursor.rowcount != 1:
                raise CatalogIdentityReconciliationError("A catalog row changed during reconciliation.")

    return ReconciliationReport(
        canonical_rows=len(canonical_ids),
        already_stable_rows=already_stable,
        remapped_rows=len(replacements),
        version_documents_changed=len(version_updates),
        version_references_changed=sum(update.references_changed for update in version_updates),
        draft_documents_changed=len(draft_updates),
        draft_references_changed=sum(update.references_changed for update in draft_updates),
        applied=apply,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply the reported reconciliation atomically.")
    parser.add_argument(
        "--confirm-production",
        action="store_true",
        help="Required with --apply when ENVIRONMENT=production.",
    )
    args = parser.parse_args()
    if args.confirm_production and not args.apply:
        parser.error("--confirm-production requires --apply.")
    if args.apply and settings.environment == "production" and not args.confirm_production:
        parser.error("Production reconciliation requires --apply --confirm-production.")

    with transaction() as conn:
        report = reconcile_material_catalog_ids(conn, apply=args.apply)
    print(f"PHN_CATALOG_ID_RECONCILE_RESULT={json.dumps(asdict(report), sort_keys=True)}")


if __name__ == "__main__":
    main()
