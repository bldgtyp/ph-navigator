"""Raw-SQL repository for the catalog single-select option store.

Backs ``catalog_field_options`` (migration ``20260623_0037``) — the
catalog-scoped vocabulary registry the window-frames-catalog-enums refactor
introduces. Shared by all three bookshelf catalogs (D-7): keys are
``(catalog_table, field_key)`` so glazing-types and materials reuse it with no
redesign. Frame-types and glazing-types are wired; materials is the remaining
adopter.

Rows store the option **label string** (D-2). Rename/merge is therefore a
row-rewrite over the owning catalog table — which is exactly the cleanup tool
for a drifted value like ``OP-TO-FIX`` vs ``OP-to-FX``.

Injection note: ``field_key`` is interpolated as a SQL **identifier** (the
owning catalog column) in :func:`count_rows_using_label` / :func:`rename_label`.
It is always quoted via ``sql.Identifier`` and the physical table is resolved
from a fixed allowlist — never f-string a caller value into SQL here.
"""

from __future__ import annotations

from typing import Any

from psycopg import Connection, sql

from features.project_document.options import OPTION_COLOR_PALETTE, mint_option_id
from features.project_document.rows import SingleSelectOption

# catalog_table (logical) -> physical catalog row table. Also the allowlist of
# catalogs that may own options.
_PHYSICAL_TABLE: dict[str, str] = {
    "frame_types": "catalog_frame_types",
    "glazing_types": "catalog_glazing_types",
    "materials": "catalog_materials",
}


def _physical_table(catalog_table: str) -> str:
    try:
        return _PHYSICAL_TABLE[catalog_table]
    except KeyError as exc:
        raise ValueError(f"Unknown catalog_table: {catalog_table!r}") from exc


def list_options(conn: Connection[Any], *, catalog_table: str, field_key: str) -> list[dict[str, Any]]:
    """Return the stored option rows for one ``(catalog_table, field_key)``,
    ordered by ``order`` then label."""
    rows = conn.execute(
        """
        SELECT catalog_table, field_key, option_id, label, color, "order"
        FROM catalog_field_options
        WHERE catalog_table = %(catalog_table)s AND field_key = %(field_key)s
        ORDER BY "order" ASC, label ASC
        """,
        {"catalog_table": catalog_table, "field_key": field_key},
    ).fetchall()
    return list(rows)


def list_all_for_table(conn: Connection[Any], *, catalog_table: str) -> list[dict[str, Any]]:
    """Return every option row for a catalog (all fields at once — one fetch
    for the whole grid)."""
    rows = conn.execute(
        """
        SELECT catalog_table, field_key, option_id, label, color, "order"
        FROM catalog_field_options
        WHERE catalog_table = %(catalog_table)s
        ORDER BY field_key ASC, "order" ASC, label ASC
        """,
        {"catalog_table": catalog_table},
    ).fetchall()
    return list(rows)


def replace_options(
    conn: Connection[Any],
    *,
    catalog_table: str,
    field_key: str,
    options: list[SingleSelectOption],
) -> None:
    """Replace the full option list for one field (DELETE-all + INSERT-all).

    Option lists are tiny (≤ a couple dozen), so a full replace is cheaper to
    reason about than a diffing upsert — and it sidesteps transient
    label-uniqueness collisions during in-place renames/reorders. Runs inside
    the caller's transaction.
    """
    conn.execute(
        "DELETE FROM catalog_field_options WHERE catalog_table = %(catalog_table)s AND field_key = %(field_key)s",
        {"catalog_table": catalog_table, "field_key": field_key},
    )
    for option in options:
        conn.execute(
            """
            INSERT INTO catalog_field_options (catalog_table, field_key, option_id, label, color, "order")
            VALUES (%(catalog_table)s, %(field_key)s, %(option_id)s, %(label)s, %(color)s, %(order)s)
            """,
            {
                "catalog_table": catalog_table,
                "field_key": field_key,
                "option_id": option.id,
                "label": option.label,
                "color": option.color,
                "order": option.order,
            },
        )


def count_rows_using_label(conn: Connection[Any], *, catalog_table: str, field_key: str, label: str) -> int:
    """Count active rows in the owning catalog table whose ``field_key`` cell
    equals ``label`` — the delete/merge cascade guard."""
    query = sql.SQL("SELECT COUNT(*) AS n FROM {table} WHERE {col} = %(label)s AND deleted_at IS NULL").format(
        table=sql.Identifier(_physical_table(catalog_table)),
        col=sql.Identifier(field_key),
    )
    row = conn.execute(query, {"label": label}).fetchone()
    return int(row["n"]) if row else 0


def rename_label(
    conn: Connection[Any],
    *,
    catalog_table: str,
    field_key: str,
    old_label: str,
    new_label: str,
    user_id: Any,
) -> int:
    """Rewrite every active row whose ``field_key`` cell equals ``old_label``
    to ``new_label``. Returns the number of rows rewritten.

    This is both the in-place rename (an option's label changed) and the merge
    (a deleted option's rows fold into a surviving option) primitive.
    """
    query = sql.SQL(
        """
        UPDATE {table}
        SET {col} = %(new_label)s, updated_at = now(), updated_by = %(user_id)s
        WHERE {col} = %(old_label)s AND deleted_at IS NULL
        RETURNING id
        """
    ).format(
        table=sql.Identifier(_physical_table(catalog_table)),
        col=sql.Identifier(field_key),
    )
    rows = conn.execute(
        query,
        {"new_label": new_label, "old_label": old_label, "user_id": user_id},
    ).fetchall()
    return len(rows)


def seed_options(
    conn: Connection[Any],
    *,
    catalog_table: str,
    option_seeds: dict[str, list[str]],
    color_palette: tuple[str, ...] = OPTION_COLOR_PALETTE,
) -> None:
    """Reset each field's option list to the given canonical labels.

    Full-replaces every ``field_key`` in ``option_seeds`` with freshly-minted
    options (cycling ``color_palette``, ``order`` = index). Generic across
    catalogs (D-7) and the single source of truth for option-store seeding —
    both the migration data-seed and the test canonical-reset go through here.
    Runs in the caller's transaction.
    """
    for field_key, labels in option_seeds.items():
        options = [
            SingleSelectOption(
                id=mint_option_id(),
                label=label,
                color=color_palette[index % len(color_palette)],
                order=float(index),
            )
            for index, label in enumerate(labels)
        ]
        replace_options(conn, catalog_table=catalog_table, field_key=field_key, options=options)


def append_options(
    conn: Connection[Any],
    *,
    catalog_table: str,
    field_key: str,
    new_labels: list[str],
) -> list[str]:
    """Append labels to a field's option list, skipping any that already exist.

    De-duplication is **case-insensitive on the trimmed label** — matching the
    ``ux_catalog_field_options_label`` unique index — so neither a stale
    snapshot nor two case-variant labels in one batch can collide on insert.
    Mints a fresh id + cycles the color palette per added label. Returns the
    labels actually added. The auto-add-on-import path (D-4) is the caller.
    """
    current = list_options(conn, catalog_table=catalog_table, field_key=field_key)
    options = [
        SingleSelectOption(id=row["option_id"], label=row["label"], color=row["color"], order=row["order"])
        for row in current
    ]
    seen = {option.label.strip().lower() for option in options}
    next_order = max((option.order for option in options), default=-1.0) + 1.0
    added: list[str] = []
    for label in new_labels:
        key = label.strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        options.append(
            SingleSelectOption(
                id=mint_option_id(),
                label=label,
                color=OPTION_COLOR_PALETTE[len(options) % len(OPTION_COLOR_PALETTE)],
                order=next_order + len(added),
            )
        )
        added.append(label)
    if added:
        replace_options(conn, catalog_table=catalog_table, field_key=field_key, options=options)
    return added
