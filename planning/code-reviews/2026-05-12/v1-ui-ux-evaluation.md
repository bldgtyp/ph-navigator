---
DATE: 2026-05-12
TIME: 08:56 EDT
STATUS: Working evaluation brief. Use as design-discovery input, not as
        canonical V2 UI spec.
AUTHOR: Ed May (with Codex)
SCOPE: V1 screenshot review for PH-Navigator V2 UI/UX direction.
RELATED: context/PRD.md, context/UI_UX.md,
         research/ph-nav-v1-screenshots/
---

# PH-Navigator V1 Screenshot Evaluation

## 1. Purpose

Use the V1 screenshots as precedent for what PH-Navigator already knows
how to do, while leaving V2 open to broad redesign across layout,
visual system, icons, typography, color, interaction patterns, and
workflow structure.

This brief intentionally separates:

- **V2 invariants** — product/workflow facts that should survive design
  exploration.
- **V1 precedents** — useful patterns already visible in the screenshots.
- **Design hypotheses** — current direction worth testing, not final
  prescription.
- **Open questions** — choices that should stay unresolved until more
  V1 examples, user priorities, or prototype feedback clarify them.

## 2. Screenshot Corpus

Source folder:
`research/ph-nav-v1-screenshots/`

Generated contact sheets for this review:

| Section | Contact sheet |
|---|---|
| Landing / Status | `planning/code-reviews/2026-05-12/assets/v1-landing-contact-sheet.jpg` |
| Aperture builder | `planning/code-reviews/2026-05-12/assets/v1-aperture-builder-contact-sheet.jpg` |
| Assembly builder | `planning/code-reviews/2026-05-12/assets/v1-assembly-builder-contact-sheet.jpg` |
| Equipment table views | `planning/code-reviews/2026-05-12/assets/v1-table-views-contact-sheet.jpg` |
| HBJSON viewer | `planning/code-reviews/2026-05-12/assets/v1-hbjson-viewer-contact-sheet.jpg` |

Screens reviewed:

- Project Landing Page
- Windows: Unit Types, Glazing Types, Frame Types
- Envelope: Assemblies, Materials, Airtightness, Site Photos
- Equipment: ERVs, Pumps, Tanks, Fans, Appliances
- Model: base 3D view, color-by modes, object selection/reporting

## 3. Overall Read

V1 already has the correct **domain spine**:

- Project workspace with persistent top-level tabs.
- Certification/status timeline as a first-class page.
- Builder pages for windows and assemblies.
- Dense tabular equipment/specification views.
- Evidence/documentation prompts for datasheets and site photos.
- An inspectable HBJSON viewer with color-by modes and object reports.

The major V2 opportunity is not to invent a new product shape. It is to
make the existing shape feel like a coherent technical workbench rather
than a generic admin app with domain data inside it.

V2 should preserve the operational density and domain-specific surfaces,
but improve:

- visual hierarchy,
- action discoverability,
- evidence/progress state,
- table ergonomics,
- full-screen viewer composition,
- object/selection inspection,
- color semantics,
- typography and icon consistency.

## 4. Design Direction: Technical Workbench

Current hypothesis:

PH-Navigator V2 should feel like a **technical workbench for Passive
House project data**: quiet, precise, data-rich, and built for repeated
use by expert users.

It should not feel like:

- a marketing SaaS dashboard,
- a playful consumer app,
- a generic Material UI CRUD shell,
- a visualizer with project data bolted on,
- an Airtable clone with PH terminology.

V2 should be visually calmer than V1, but not sterile. The strongest
screens will be the ones where the UI supports a domain object directly:
an assembly section, a window unit diagram, an evidence checklist, or a
3D model inspection state.

## 5. Cross-Cutting Findings

### 5.1 Navigation And App Chrome

**V1 precedent:** The top-level tab model works: Status, Windows,
Envelope, Equipment, Model. The second-level sub-tabs also map well to
the domain.

**Problem:** The chrome is flat and generic. Project identity, units,
source system, user identity, and navigation all sit in a thin header
without enough hierarchy. The AirTable button also anchors the UI to a
V1 dependency that V2 explicitly removes.

**V2 invariant:** Keep top-level project tabs and relevant sub-tabs.

**Design hypothesis:** Use a stronger project header with project name,
version/save state, read-only state, and units as persistent workspace
context. Let the global header be quieter.

**Do not carry forward:** AirTable button, generic MUI tab styling, and
project title as the only major workspace context.

### 5.2 Density And White Space

**V1 precedent:** Dense screens are acceptable and useful. Tables,
builder lists, and inspector panels carry real work.

**Problem:** Some screens combine dense data blocks with large unclaimed
white areas. The result can feel sparse and under-designed without
becoming easier to scan.

**V2 invariant:** Preserve data density for expert workflows.

**Design hypothesis:** Use structured workbench layouts:

- left object list,
- center builder/canvas/table,
- right inspector or evidence panel where useful,
- bottom or header action rail for mode-specific tools.

White space should separate task zones, not simply appear because the
surface has no secondary information model.

### 5.3 Tables

**V1 precedent:** The table views show the right kinds of project data:
manufacturer, model, performance values, notes, specs, datasheets,
photos, and links. They also combine data status with evidence status,
which is crucial for PH certification work.

**Problems:**

- Status icons are compact but not self-explanatory enough.
- Underlined column labels read like links even when they behave as
  sort affordances.
- Pagination creates friction for project-scale tables where scanning
  and filtering may matter more than page chunks.
- Evidence state is split across tiny icon cells instead of acting like
  a coherent documentation/progress layer.

**V2 invariant:** Tables remain central. They must support fast scanning,
editing, copy/paste, sorting, filtering, grouping, and evidence status.

**Design hypothesis:** Treat table rows as compact records with an
evidence/status grammar. Use clear semantic badges or icons for
datasheet/photo/spec status, with hover/detail affordances and filters
that can answer certification questions quickly:

- missing datasheet,
- missing site photo,
- spec complete,
- N/A accepted,
- linked source present,
- custom project value diverges from catalog.

### 5.4 Builder Surfaces

**V1 precedent:** The Window Builder and Assembly Builder are the most
important non-table UI patterns. Both use a left-side object list and a
central visual representation with detailed editable rows below or near
the visual.

**Problems:**

- The builder diagrams are valuable but visually isolated from the data
  model around them.
- Selected state is clear but visually heavy in places.
- Actions such as add, edit, orientation, zoom, and overflow are present
  but not strongly organized by task.

**V2 invariant:** Assemblies and window units need visual builders, not
only tables.

**Design hypothesis:** Use a consistent builder shell:

- object browser on the left,
- visual editor/canvas in the center,
- computed summary strip near the top,
- structured inspector/details panel or table below,
- explicit tool group for edit/view/measure/orientation actions.

The visual should feel like the primary object, not a decorative preview.

### 5.5 Required Photos And Evidence Guidance

**V1 precedent:** Required photo cards are highly valuable. They encode
certification knowledge directly into the app and bridge model data to
field documentation.

**Problems:**

- They are mostly static guidance cards in V1.
- It is not immediately clear which requirements are satisfied for the
  current project, current assembly, or current equipment item.
- The cards consume large vertical space without summarizing completion.

**V2 invariant:** Required photos and datasheets should remain explicit,
domain-specific, and tied to project entities.

**Design hypothesis:** Turn evidence guidance into an actionable
documentation layer:

- requirement cards with example imagery,
- project-specific completion state,
- filters for missing evidence,
- attachment drop zones,
- links back to the relevant material, assembly, equipment, or aperture,
- export/report readiness for certification review.

### 5.6 Status Timeline

**V1 precedent:** The certification/status page is a strong first screen.
It frames the project as a lifecycle, not just a data container.

**Problems:**

- The timeline has useful semantics but limited task affordance.
- Links to Airtightness and Site Photos are helpful, but visually read
  as annotations rather than active workflow gates.
- Completed dates and to-do states could be more scannable.

**V2 invariant:** Project status should remain the default landing
surface.

**Design hypothesis:** Keep the milestone timeline, but make each step a
compact status record with state, date, owner/next action if needed,
and direct links to the work surface that resolves the item.

### 5.7 HBJSON Viewer

**V1 precedent:** The model viewer is the strongest visual surface in
the corpus. It has a clear domain purpose: inspect geometry, color by
building-science categories, select objects, and read object metadata.

**Problems:**

- The bottom toolbar uses small icons with limited hierarchy.
- Magenta selection/action color is highly visible but too dominant as
  a general brand/action color.
- Legends and inspectors are useful but compete with the model in some
  states.
- The project chrome takes vertical space from a surface that benefits
  from full-screen treatment.

**V2 invariant:** The Model tab should be a real viewer, full-bleed or
near full-bleed, with color-by, selection, inspection, and model-file
switching.

**Design hypothesis:** Preserve the V1 viewer behaviors and improve the
composition:

- full-bleed canvas below the project header,
- compact floating model selector,
- left legend/filter rail when color-by is active,
- right inspector panel for selected object,
- bottom tool rail with grouped, labeled-on-hover tools,
- restrained but high-contrast selection color.

The viewer is the one surface where V2 can be more visually distinctive.
It should feel like inspecting a building model, not viewing a chart in a
dashboard.

### 5.8 Visual System

**V1 precedent:** Blue active state and light neutral surfaces are
understandable. The UI does not fight the work.

**Problems:**

- Generic MUI visual language.
- Default blue is doing too much.
- Magenta appears as a warning/missing/action/selection color depending
  on context, which weakens semantic clarity.
- Icons vary in weight and meaning.
- Typography is serviceable but not tuned for technical density.

**V2 invariant:** Visual styling must stay legible, calm, and usable for
long work sessions.

**Design hypothesis:** Use a restrained technical palette with separate
semantic channels:

- neutral surfaces for the workspace,
- one primary action/accent color,
- independent evidence-status colors,
- independent model-selection/color-by palette,
- clear warning/error/success colors that are not reused as general
  decoration.

Typography should prioritize dense labels, numeric values, units, and
long product names. Do not decide the exact typeface yet, but avoid a
default SaaS feel.

## 6. Section Notes

### 6.1 Project Landing / Status

Keep:

- Status as the default landing tab.
- Certification/lifecycle milestones.
- Direct links from status items to relevant work surfaces.

Improve:

- Make milestone state more compact and scannable.
- Clarify "done / current / future / blocked / not applicable" if the
  model supports it.
- Give status rows richer action affordances without turning the page
  into a dashboard.

### 6.2 Aperture Builder

Keep:

- Window/Door Type as the organizing object.
- Left list of unit types.
- Visual aperture diagram with dimensions.
- Per-panel frame/glazing breakdown.
- Computed U-w summary.

Improve:

- Use a stronger selected-object relationship between diagram and data.
- Move from generic data rows to an inspector-like editing model if it
  improves comprehension.
- Make frame/glazing catalog origins and custom overrides explicit.
- Keep diagram measurements precise but visually lighter.

### 6.3 Assembly Builder

Keep:

- Assembly list.
- Layer/segment visual section.
- Total thickness and effective R/U summary.
- Material legend/table.

Improve:

- Treat layer orientation and inside/outside as a core visual state.
- Make material segment editing more direct.
- Give computed values a stable summary strip.
- Avoid treating the assembly visual as a large static image; it should
  support selection and editing.

### 6.4 Materials / Specifications / Evidence

Keep:

- Grouping by assembly.
- Explicit spec/datasheet/site-photo requirements.
- N/A state where a requirement is intentionally not applicable.

Improve:

- Replace large pink button fields with a more nuanced evidence status
  system.
- Separate "missing" from "required", "not applicable", and "attached".
- Add a project-level missing-evidence scan path.
- Make requirements actionable from the place where the user notices the
  gap.

### 6.5 Equipment Tables

Keep:

- Mechanical/equipment tabs as dense tables.
- Required photo guidance below or adjacent to the table.
- Performance values and source links in the same surface.

Improve:

- Use filters and status badges to reduce pagination/scanning burden.
- Consider a split table + details/evidence panel for selected row.
- Make manufacturer/model/spec fields work well with long names.
- Keep commercial-scale mechanical terms explicit where needed.

### 6.6 Model Viewer

Keep:

- Color-by modes.
- Object selection and inspector.
- Legends.
- Bottom tool rail.
- Model date/file selector.

Improve:

- Give the viewer more canvas area and less generic page chrome.
- Group toolbar tools by mode.
- Make legends and inspector collapsible but discoverable.
- Use a restrained selection accent distinct from table/evidence
  statuses.
- Preserve enough V1 behavior that the R3F port feels familiar.

## 7. What Should Not Be Over-Constrained Yet

Keep open for design exploration:

- exact header layout,
- exact tab treatment,
- palette,
- typography,
- icon set details beyond consistency,
- whether specific builder details live below the canvas or in a right
  inspector,
- whether evidence cards sit below tables or in a side panel,
- exact table row height and visual density,
- exact model viewer toolbar placement,
- final empty-state illustration/photo style.

## 8. Candidate Updates To Canonical UI/UX Doc

Do not patch `context/UI_UX.md` from this brief until accepted. Likely
safe updates after review:

1. Add a short "V1 precedent, not prescription" subsection.
2. Add the "technical workbench" design intent as a hypothesis, not a
   final visual spec.
3. Add an explicit taxonomy for UI notes:
   invariant / requirement / hypothesis / open question.
4. Strengthen guidance that evidence status is a cross-cutting UX
   system, not a per-table icon detail.
5. Strengthen Model tab guidance around full-bleed viewer composition.
6. Mark exact visual choices from V1 as redesignable.

## 9. Open Questions For Ed

1. Which V1 screens are used most often in real project work?
2. Which V1 screens feel closest to "good enough, just modernize it"?
3. Which screens feel fundamentally wrong or annoying?
4. For V2, should missing evidence feel like a certification checklist,
   a table filter/status system, or both?
5. In builders, do you prefer details below the visual, beside it in a
   right inspector, or adaptive depending on the object?
6. For the Model tab, should V2 preserve V1's bottom tool rail, or is a
   left/right professional modeling-app toolbar acceptable?
7. Should the visual identity stay mostly neutral/technical, or should
   the Model and builder surfaces carry more distinctive BLDGTYP
   character?

## 10. Recommended Next Step

Review this brief against the screenshots, then decide which findings
should graduate into `context/UI_UX.md`.

After that, create a second artifact:
`planning/archive/dated/2026-05-12/v2-ui-ux-working-brief.md`

That next doc should define V2 screen goals and design hypotheses for:

- Dashboard / project list,
- Project shell,
- Status,
- Windows,
- Envelope,
- Equipment,
- Model viewer,
- shared evidence/status language,
- shared table behavior.

