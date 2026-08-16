/**
 * The single source of truth for the rendered-typography state manifest.
 * font-audit-sweep.mjs drives these states; font-audit-eval.mjs requires
 * exactly this coverage — a state added here is automatically both swept
 * and enforced (no second list to update in the contract).
 */

// DataTable's row-expand gutter button is opacity-0 until its row is hovered,
// so record-modal states hover the first body row before clicking.
const EXPAND_ROW = {
  hovers: [".data-table tbody tr"],
  clicks: ["[aria-label='Expand row 1']"],
};

// The fixture's dirty draft pops the "Recovered draft found" modal on every
// project-tab load, which both pollutes the base-page data and blocks further
// clicks, so project states dismiss it first. Keep, never discard: discarding
// would delete the draft and change every state after it. Matched by
// accessible name (the app's own tests use the same getByRole name) rather
// than a bare text= — this used to click a header "Close" that vanished when
// ModalDialog's `showHeaderClose` default flipped to false.
const DISMISS_DRAFT = 'role=button[name="Restore draft"]';

/** @type {(projectId: string) => {label: string, route: string, hovers?: string[], clicks?: string[], noSignin?: boolean}[]} */
export function buildStates(projectId) {
  const P = `/projects/${projectId}`;
  return [
    { label: "sign-in", route: "/sign-in", noSignin: true },
    { label: "dashboard", route: "/dashboard" },
    {
      label: "dashboard-new-project-modal",
      route: "/dashboard",
      clicks: ["text=Add New Project +"],
    },
    { label: "admin-users", route: "/admin/users" },
    { label: "admin-invite-modal", route: "/admin/users", clicks: ["text=Invite user"] },
    { label: "catalog-materials", route: "/catalog/materials" },
    { label: "catalog-materials-record-modal", route: "/catalog/materials", ...EXPAND_ROW },
    { label: "catalog-frame-types", route: "/catalog/frame-types" },
    {
      label: "catalog-frame-types-create-modal",
      route: "/catalog/frame-types",
      clicks: ["[aria-label='Add frame type']"],
    },
    { label: "catalog-glazing-types", route: "/catalog/glazing-types" },
    // Every project state below dismisses the draft prompt via DISMISS_DRAFT;
    // its own typography is captured here, before the dismissal.
    { label: "project-recovered-draft-modal", route: `${P}/overview` },
    { label: "project-overview", route: `${P}/overview`, clicks: [DISMISS_DRAFT] },
    {
      // Documentation progress renders group rows only once a section is
      // disclosed, so the collapsed state above never sees them — that is how
      // their 16px fall-through survived. Expand the first section.
      label: "project-overview-documentation-groups",
      route: `${P}/overview`,
      clicks: [DISMISS_DRAFT, ".documentation-progress-toggle"],
    },
    {
      label: "project-overview-add-modal",
      route: `${P}/overview`,
      clicks: [DISMISS_DRAFT, ".status-add-milestone"],
    },
    { label: "project-climate", route: `${P}/climate`, clicks: [DISMISS_DRAFT] },
    { label: "project-apertures", route: `${P}/apertures`, clicks: [DISMISS_DRAFT] },
    // The Apertures sub-tabs are separate routes and none of them were swept —
    // which is how the U-Values section headings kept rendering at the browser
    // default 18.72px. The edge breakdown only exists once a row is expanded,
    // so it needs its own state, same reason as the Overview group rows.
    {
      label: "project-apertures-u-values",
      route: `${P}/apertures/u-values`,
      clicks: [DISMISS_DRAFT],
    },
    {
      label: "project-apertures-u-values-edges",
      route: `${P}/apertures/u-values`,
      clicks: [DISMISS_DRAFT, "[aria-label='Expand row']"],
    },
    { label: "project-envelope", route: `${P}/envelope`, clicks: [DISMISS_DRAFT] },
    { label: "project-spaces-types", route: `${P}/spaces/space-types`, clicks: [DISMISS_DRAFT] },
    // NOTE: no spaces/equipment record-modal states — those fixture tables are
    // empty (no row to expand); the shared RecordDetailModal shell is covered
    // by catalog-materials-record-modal.
    { label: "project-spaces-rooms", route: `${P}/spaces/rooms`, clicks: [DISMISS_DRAFT] },
    { label: "project-equipment", route: `${P}/equipment`, clicks: [DISMISS_DRAFT] },
    {
      label: "project-equipment-heat-pumps",
      route: `${P}/equipment?tab=heat-pumps`,
      clicks: [DISMISS_DRAFT],
    },
    { label: "project-thermal-bridges", route: `${P}/thermal-bridges`, clicks: [DISMISS_DRAFT] },
    { label: "project-model", route: `${P}/model`, clicks: [DISMISS_DRAFT] },
  ];
}

export const STATE_LABELS = buildStates("x").map((state) => state.label);
