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

/** @type {(projectId: string) => {label: string, route: string, hovers?: string[], clicks?: string[], noSignin?: boolean}[]} */
export function buildStates(projectId) {
  const P = `/projects/${projectId}`;
  return [
    { label: "sign-in", route: "/sign-in", noSignin: true },
    { label: "dashboard", route: "/dashboard" },
    { label: "dashboard-new-project-modal", route: "/dashboard", clicks: ["text=Add New Project +"] },
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
    // Project states click "Close" first: the fixture's dirty draft pops the
    // "Recovered draft found" modal on every project-tab load, which both
    // pollutes the base-page data and blocks further clicks. (Its own
    // typography is captured separately by project-recovered-draft-modal.)
    { label: "project-recovered-draft-modal", route: `${P}/status` },
    { label: "project-status", route: `${P}/status`, clicks: ["text=Close"] },
    {
      label: "project-status-add-modal",
      route: `${P}/status`,
      clicks: ["text=Close", ".status-add-milestone"],
    },
    { label: "project-climate", route: `${P}/climate`, clicks: ["text=Close"] },
    { label: "project-apertures", route: `${P}/apertures`, clicks: ["text=Close"] },
    { label: "project-envelope", route: `${P}/envelope`, clicks: ["text=Close"] },
    { label: "project-spaces-types", route: `${P}/spaces/space-types`, clicks: ["text=Close"] },
    // NOTE: no spaces/equipment record-modal states — those fixture tables are
    // empty (no row to expand); the shared RecordDetailModal shell is covered
    // by catalog-materials-record-modal.
    { label: "project-spaces-rooms", route: `${P}/spaces/rooms`, clicks: ["text=Close"] },
    { label: "project-equipment", route: `${P}/equipment`, clicks: ["text=Close"] },
    {
      label: "project-equipment-heat-pumps",
      route: `${P}/equipment?tab=heat-pumps`,
      clicks: ["text=Close"],
    },
    { label: "project-thermal-bridges", route: `${P}/thermal-bridges`, clicks: ["text=Close"] },
    { label: "project-model", route: `${P}/model`, clicks: ["text=Close"] },
  ];
}

export const STATE_LABELS = buildStates("x").map((state) => state.label);
