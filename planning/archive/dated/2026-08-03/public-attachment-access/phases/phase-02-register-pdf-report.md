---
DATE: 2026-08-03
TIME: 10:03 EDT
STATUS: Complete
AUTHOR: Claude with Ed May
SCOPE: Enroll thermal_bridges.pdf_report_asset_ids in the attachment field
  registry and route its FieldDef through the shared attachment seam.
RELATED:
  - ../PRD.md
  - ./phase-00-production-inventory.md
  - ./phase-01-row-walker.md
---

# Phase 02 — Register `pdf_report_asset_ids`

## Goal

The Thermal Bridges **PDF Report** column becomes a first-class attachment
field: visible to anonymous viewers, protected from the sweeper, validated on
write, included in bulk download, and reachable by attach/detach.

## Depends on

Phase 01. Registering this field while the walker returns zero rows for
`thermal_bridges` changes nothing observable.

## The defect

`pdf_report_asset_ids` exists as a document column
(`backend/features/project_document/rows.py:415`), is seeded as a built-in
FieldDef (`tables/thermal_bridges.py:79-83`), and is rendered as an attachment
column by the frontend — but has no `ATTACHMENT_FIELDS` entry. It was hand-rolled
with the generic `built_in_field_def(...)` instead of going through
`_attachment_fields.py`, the seam that pairs a document column with a registry
entry. PRD §4.

## The change

**1. Add the shared FieldDef helper.**
`backend/features/project_document/tables/_attachment_fields.py`:

```python
PDF_REPORT_FIELD_KEY = "pdf_report_asset_ids"


def pdf_report_field_def() -> TableFieldDef:
    """Return the shared built-in PDF Report attachment FieldDef."""
    return built_in_field_def(
        field_key=PDF_REPORT_FIELD_KEY,
        display_name="PDF Report",
        field_type=CustomFieldType.long_text,
    )
```

**2. Use it in the Thermal Bridges seed.**
`backend/features/project_document/tables/thermal_bridges.py:79-83` — replace the
inline `built_in_field_def(...)` with `pdf_report_field_def()`.

> **This must be a pure refactor.** The built-in seed is fingerprinted
> (`tables/_fingerprint.py`). Assert the returned `TableFieldDef` is identical
> field-for-field before and after — same `field_key`, `display_name`
> (`"PDF Report"`), `field_type` (`long_text`), `config`, `description`,
> `default`, `origin`, `created_at`, `created_by`. If the fingerprint moves, stop
> and reconsider: a seed change is a schema concern, not part of this bug fix.

**3. Register the attachment field.**
`backend/features/assets/registry.py` — add to `ATTACHMENT_FIELDS`:

```python
AttachmentFieldConfig(
    key="thermal_bridges.pdf_report_asset_ids",
    table_key="thermal_bridges",
    field_key=PDF_REPORT_FIELD_KEY,
    asset_kinds=frozenset({"datasheet"}),
    allowed_content_types=frozenset({"application/pdf"}),
    allowed_extensions=frozenset(),
    max_count=5,
    max_file_size_mb=25,
)
```

Values mirror `PDF_REPORT_ATTACHMENT_CONFIG` in
`frontend/src/features/assets/thermal-bridges/constants.ts:25-30` exactly. The
PDF-only allowlist is intentionally narrower than the shared
`DATASHEET_CONTENT_TYPES` because the UI has only ever accepted
`application/pdf` here.

**Confirm against Phase 00 before committing to PDF-only.** If production holds
a non-PDF asset in this column, either widen to `DATASHEET_CONTENT_TYPES` or
remediate the data — the choice is Ed's, and the finding should be recorded in
`decisions.md` if one is created.

Place the entry next to the other hand-listed envelope columns rather than in
the machine-generated loops; it is genuinely a one-off, and burying it in a
comprehension would obscure that.

## Tests

1. `get_attachment_field("thermal_bridges", "pdf_report_asset_ids")` returns the
   config, with the asserted kinds / content types / counts.
2. Anonymous access end-to-end for an asset referenced **only** from
   `pdf_report_asset_ids`: `GET /assets` lists it, `/url` 200s, `/download`
   redirects.
3. `POST /assets/{id}/attach` with
   `table_key="thermal_bridges", field_key="pdf_report_asset_ids"` succeeds —
   it currently 422s `asset_attachment_field_unknown`, which is why the UI
   reaches this column only through the table draft `PUT`.
4. Orphan sweeper does not treat a pdf_report-referenced asset as a candidate.
5. Write validation rejects a non-PDF asset in the column with 422
   `asset_mime_not_allowed` (assuming PDF-only survives Phase 00).
6. The FieldDef refactor is byte-identical — assert the seed fingerprint is
   unchanged.

## Verification

- `make ci` green.
- Probe from [research.md §6](../research.md) now enumerates **31** fields, all
  reachable.
- **This is the phase that closes Ed's original report.** Signed-out browser
  check per `context/USING_A_WEB_BROWSER.md`: on the Thermal Bridges tab the
  PDF Report cells show real PDF thumbnails, the modal renders the PDF in its
  iframe and offers "Open in new tab", and Download delivers the file.

## Risks

- **Seed fingerprint drift** — see the callout above. Highest-consequence risk
  in this phase; it touches the document schema surface.
- **PDF-only may be too narrow for existing data** — resolved by Phase 00.

## Done when

- Tests 1–6 pass.
- A signed-out viewer can open a Thermal Bridges PDF report on a real project.
- `make ci` green.

## Completion evidence

- Registry red proof failed before the entry existed; the completed focused
  backend bundle passes `55` tests across all six required behaviors.
- `thermal_bridges.pdf_report_asset_ids` is registered as a PDF-only datasheet
  field with maximum count `5` and maximum size `25 MB`.
- The shared FieldDef helper preserves every serialized field and the exact
  Thermal Bridges schema fingerprint
  `073fd4d1300f69585b714e731f451530d8cff3d326e0cc7cd057b616d2967475`.
- The research probe reports `31/31 registered fields reachable`.
- Signed out against the isolated local project fixture, the PDF Report cell
  rendered its thumbnail; the modal rendered the signed PDF in an iframe and
  exposed the same URL in an `_blank` “Open in new tab” link; Download returned
  `200 application/pdf` with the expected 646-byte fixture.
- Production was read-only throughout. Phase 00's five production PDF Report
  references remain the compatibility evidence for the PDF-only policy;
  production behavior will not change until Ed deploys the completed packet.
- `make ci` passes: backend `1795 passed, 7 skipped`; frontend tests and build,
  formatting, lint, types, and repository boundary checks are green.
