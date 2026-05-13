"""Compatibility facade for project-document workflows.

Concrete workflow code lives in narrower modules so draft, version, diff,
download, and table-contract behavior can evolve independently.
"""

from features.project_document.diff import get_project_diff
from features.project_document.downloads import table_download_body
from features.project_document.drafts import discard_draft, replace_table_slice, save_draft, save_draft_as
from features.project_document.store import (
    get_current_document_view,
    get_draft_summary,
    get_draft_table_slice,
    get_raw_saved_document,
    get_saved_and_current_document_view,
    get_saved_document,
    get_saved_table_slice,
)
from features.project_document.validation import document_etag, next_draft_etag, validate_document
from features.project_document.versions import patch_version

__all__ = [
    "discard_draft",
    "document_etag",
    "get_current_document_view",
    "get_draft_summary",
    "get_draft_table_slice",
    "get_project_diff",
    "get_raw_saved_document",
    "get_saved_and_current_document_view",
    "get_saved_document",
    "get_saved_table_slice",
    "next_draft_etag",
    "patch_version",
    "replace_table_slice",
    "save_draft",
    "save_draft_as",
    "table_download_body",
    "validate_document",
]
