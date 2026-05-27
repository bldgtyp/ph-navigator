"""Admin/dev project deletion utility.

Dry-run reports the database child counts and project asset manifest.
Hard-delete removes the project storage prefix, then deletes database
rows. This script intentionally does not expose routine dashboard
behavior; browser delete remains soft-delete only.
"""

from __future__ import annotations

import argparse
import json
from uuid import UUID

from database import connection
from features.projects import repository
from features.projects.models import ProjectHardDeleteRequest
from features.projects.service import hard_delete_project, project_delete_counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Dry-run or hard-delete a PH-Navigator V2 project.")
    parser.add_argument("project_id", type=UUID)
    parser.add_argument("--dry-run", action="store_true", help="Report what would be deleted.")
    parser.add_argument("--hard", action="store_true", help="Physically delete project DB rows and object storage.")
    parser.add_argument("--confirm-name", help="Exact project name confirmation for --hard.")
    parser.add_argument("--confirm-bt-number", help="Exact BT number confirmation for --hard.")
    args = parser.parse_args()

    if args.dry_run == args.hard:
        parser.error("Choose exactly one of --dry-run or --hard.")

    if args.dry_run:
        print(json.dumps(_dry_run(args.project_id), indent=2, sort_keys=True))
        return

    if not args.confirm_name or not args.confirm_bt_number:
        parser.error("--hard requires --confirm-name and --confirm-bt-number.")

    result = hard_delete_project(
        args.project_id,
        ProjectHardDeleteRequest(
            confirm_project_name=args.confirm_name,
            confirm_bt_number=args.confirm_bt_number,
        ),
    )
    print(json.dumps(result.model_dump(mode="json"), indent=2, sort_keys=True))


def _dry_run(project_id: UUID) -> dict[str, object]:
    with connection() as conn:
        project = repository.get_project_by_id_including_deleted(conn, project_id)
        if project is None:
            return {"project_id": str(project_id), "ok": False, "error_code": "project_not_found"}
        counts = project_delete_counts(repository.count_project_children(conn, project_id))
        manifest = repository.list_project_storage_manifest(conn, project_id)
    return {
        "project_id": str(project_id),
        "ok": True,
        "project": {
            "name": project["name"],
            "bt_number": project["bt_number"],
            "deleted_at": project["deleted_at"].isoformat() if project["deleted_at"] else None,
            "hard_delete_after": (project["hard_delete_after"].isoformat() if project["hard_delete_after"] else None),
        },
        "counts": counts.model_dump(),
        "manifest": manifest,
    }


if __name__ == "__main__":
    main()
