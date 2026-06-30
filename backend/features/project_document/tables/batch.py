"""Batch draft-tables read response.

Lives in the `tables` package because it wraps `RegisteredTableResponse` and
belongs with the union it contains; this also keeps the import direction
one-way (`tables` already depends on `models` for `ProjectDocumentSource`, not
the reverse).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from features.project_document.tables import RegisteredTableResponse


class BatchDraftTablesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # table_name -> the *full* per-table response. Each value already embeds
    # project_id / version_id / source / version_etag / draft_etag + payload, so
    # it is byte-identical to `GET …/draft/tables/<name>` and seeds the matching
    # per-table cache 1:1 on the client.
    tables: dict[str, RegisteredTableResponse]
