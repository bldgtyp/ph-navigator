/**
 * Phius export filename builder. Matches the convention from
 * `planning/archive/heat-pumps/phases/phase-05-phius-export-and-mcp.md`
 * (AC #3): `phius-hp-estimator-{project-bt-number}-{date}.csv`.
 */
export function buildPhiusExportFilename(btNumber: string, today: Date = new Date()): string {
  const safeBt = btNumber.trim() || "project";
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `phius-hp-estimator-${safeBt}-${year}-${month}-${day}.csv`;
}
