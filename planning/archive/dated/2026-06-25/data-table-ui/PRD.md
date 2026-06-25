---
DATE: 2026-06-25
TIME: 01:36 EDT
STATUS: Complete - requirements implemented
AUTHOR: Ed (via Codex)
SCOPE: Product and rendering contract for shared DataTable UI polish.
RELATED:
  - planning/archive/dated/2026-06-25/data-table-ui/README.md
  - planning/archive/dated/2026-06-25/data-table-ui/reviews/table-redesign-review.md
  - planning/archive/dated/2026-06-25/data-table-ui/table-redesign/Equipment Table - Handoff.md
  - planning/archive/dated/2026-06-25/data-table-ui/PLAN.md
  - context/technical-requirements/data-table.md
---

# DataTable UI - PRD

## Problem

The shared data-entry tables are functionally broad but still feel less
polished than the rest of the app. Several high-frequency columns waste
horizontal space, numeric values do not scan as a numeric table, unit
labels compete with field names, status chips need stronger semantics,
and the field-description marker is too visually expensive.

This matters because PH-Navigator tables carry dense Passive House
inputs: U-values, psi-values, SHGC, ACH50, iCFA, capacities, airflow,
areas, lengths, material properties, and specification status. These
should read like an engineering schedule, not like a generic form grid.

## Reference Design

Primary reference:

- `planning/archive/dated/2026-06-25/data-table-ui/table-redesign/Equipment Table - Handoff.md`
- `planning/archive/dated/2026-06-25/data-table-ui/table-redesign/Equipment Table.dc.html`
- screenshot PNG in `planning/archive/dated/2026-06-25/data-table-ui/table-redesign/`

The visual direction is accepted: clean engineering schedule, compact
modern toolbar, cooler mono headers, right-aligned numeric rhythm,
subtle row dividers, quiet footer, and softer categorical pills.

Implementation must preserve the existing DataTable behavior contract:
column resize/order/hide, sticky frozen column, row virtualization,
selection ranges, fill handle, inline editing, header field-config
actions, filters/sorts/groups, summary bar, attachments, linked records,
and keyboard workflows.

## Requirements

### R1 - Numeric cells are right-aligned everywhere

All visible DataTable numeric values must be right-justified:

- plain `field_type: "number"`;
- `number` fields carrying `FieldDef.numberUnits`;
- numeric built-ins and user-defined custom fields;
- display cells, inactive cells, active-but-not-editing cells, and
  formula/computed number displays where the column is semantically
  numeric.

Inline editors may keep text-entry ergonomics, but the rendered grid
state must align numbers to the right for scannability.

### R2 - Decimal precision works predictably

The field-config "Decimal precision" setting must be investigated and
fixed. The expected contract is:

- plain Number custom fields honor `config.precision`;
- number-with-units fields honor the active unit-system precision
  (`precision_si` / `precision_ip`);
- display, copy, paste normalization, filtering, and aggregation are
  checked for consistency;
- existing saved values are not mutated just because display precision
  changes.

The first implementation phase should reproduce the bug with a focused
test before applying the fix.

### R3 - Header description marker is smaller

The `"?"` description affordance in DataTable headers should become a
compact note marker that preserves field-name space.

Acceptance criteria:

- no vertical stretching of the header row;
- no large square footprint beside the label;
- still keyboard focusable and tooltip-accessible;
- preserves the existing description text and edit-field semantics.

Candidate directions: smaller circular icon, superscript-style marker,
inline info glyph, or hover/focus underline marker on the label.

### R4 - Unit labels move below field names

For number-with-units headers, the active unit label should render as a
quiet badge under the field name rather than as a chip beside it. This
uses the redesign's faint badge treatment but places it on a second
header line to preserve field-name width.

Acceptance criteria:

- field names keep the primary horizontal space;
- unit labels align consistently under the label text;
- column resize/reorder, frozen columns, filter/sort/group tinting, and
  editable header controls still work;
- the header height change is intentional and stable, not an accidental
  row-height reflow.

### R5 - Status chips get semantic polish

Built-in `status` values should render with better typography and color.
The status options currently include Complete, Needed, Question, and
N/A; the chip design should make those states readable at table density.

Target behavior:

- Complete can use a check icon.
- Needed/Missing can use an X or alert-style icon if it improves scan.
- Question should be visually distinct from Needed.
- N/A should stay neutral and quiet.
- Chip colors should align with the Materials/report-status palette
  where that does not conflict with table density.

### R6 - Evaluate solid chip styling

Evaluate a shared "solid fill + white text" chip style for all chips:

- `single_select` pills;
- linked-record pills;
- status chips;
- toolbar/filter/group chips if they share the visual language.

This is a design decision, not an automatic requirement. The packet
should compare solid chips against the current quieter style in dense
tables before implementation commits to a full conversion.

### R7 - Frontend-design polish pass

Use a restrained frontend-design pass for an operational SaaS table:

- tighter but legible row height;
- better header hierarchy;
- lower visual noise in borders and tints;
- improved padding rhythm;
- modern type scale without losing density;
- colors that support scanning and status recognition.

This should avoid decorative styling. The table should feel like a
professional engineering schedule for repeated daily work.

### R8 - Redesign translation guardrails

- Keep fixed colgroup layout unless a separate prototype proves
  `table-layout: auto` preserves persisted widths, resize, sticky frozen
  columns, and virtualization.
- Keep row height and virtualizer estimates in sync.
- Use an 8px table radius unless the app-wide radius system changes.
- Do not globally strip numeric prefixes from single-select labels.
  Prefix hiding needs an explicit field/list-level display rule.
- Do not add global search as a purely visual control; if added, define
  filtering semantics and whether it persists in `ViewState`.

## Out of scope

- Replacing `<DataTable>` with `report-table`.
- New table behavior such as pagination, column pinning changes, or new
  field types.
- Backend migrations unless the decimal precision investigation proves
  stored field config is not round-tripping.
