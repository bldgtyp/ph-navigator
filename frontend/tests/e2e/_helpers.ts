import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

export const FRAME_TYPES_PATH = "/api/v1/catalogs/frame-types";
export const GLAZING_TYPES_PATH = "/api/v1/catalogs/glazing-types";

export const FRAME_TYPES_TABLE = "frame_types";
export const GLAZING_TYPES_TABLE = "glazing_types";

const DEFAULT_BASE_URL = "http://localhost:5173";
const STAGING_FRONTEND_URL = "https://ph-navigator-v2-staging.onrender.com";
const STAGING_API_URL = "https://ph-navigator-v2.onrender.com";

// TB-01's mutating-route Origin check rejects API requests without an
// allowed Origin header; `page.request` doesn't add one by default.
export function originHeaders(baseURL: string | undefined): Record<string, string> {
  return { Origin: (baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "") };
}

export function apiUrl(baseURL: string | undefined, path: string): string {
  const configured = process.env.E2E_API_BASE_URL;
  if (configured) return new URL(path, configured).toString();
  const frontendBase = (baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  if (frontendBase === STAGING_FRONTEND_URL) return new URL(path, STAGING_API_URL).toString();
  return new URL(path, frontendBase).toString();
}

export async function signIn(
  page: Page,
  credentials?: { email: string; password: string },
): Promise<void> {
  await page.goto("/sign-in");
  await page
    .getByLabel("Email")
    .fill(credentials?.email ?? process.env.E2E_EMAIL ?? "ed@example.com");
  await page
    .getByLabel("Password")
    .fill(credentials?.password ?? process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createProject(
  page: Page,
  options: { name: string; btNumber: string; client?: string },
): Promise<string> {
  // An empty dashboard renders the CTA twice (header + empty state).
  await page
    .getByRole("button", { name: /^(Create new project|Add New Project \+)$/ })
    .first()
    .click();
  await page.getByLabel("Project name").fill(options.name);
  await page.getByLabel("BT number").fill(options.btNumber);
  await page.getByLabel("Client").fill(options.client ?? "BLDGTYP");
  await page.getByRole("checkbox", { name: "PHI", exact: true }).check();
  await expect(page.getByText("BT number available")).toBeVisible();
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/status/);
  const match = page.url().match(/\/projects\/([0-9a-f-]+)\//);
  if (!match?.[1]) throw new Error(`Could not extract project id from URL: ${page.url()}`);
  return match[1];
}

export async function seedCatalog(
  request: APIRequestContext,
  endpoint: string,
  headers: Record<string, string>,
  data: Record<string, unknown>,
): Promise<string> {
  const response = await request.post(endpoint, { headers, data });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).id as string;
}

export async function deactivateCatalogRow(
  request: APIRequestContext,
  endpoint: string,
  id: string,
  headers: Record<string, string>,
): Promise<void> {
  try {
    await request.delete(`${endpoint}/${id}`, { headers });
  } catch {
    // Best-effort teardown.
  }
}

export async function updateCatalogRow(
  request: APIRequestContext,
  endpoint: string,
  id: string,
  headers: Record<string, string>,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await request.patch(`${endpoint}/${id}`, { headers, data });
  expect(response.status(), await response.text()).toBe(200);
}

export async function openHeaderMenu(page: Page, headerName: string): Promise<void> {
  const escaped = headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = page.locator('th[role="columnheader"]').filter({
    has: page.locator(".data-table-header-label", {
      hasText: new RegExp(`^${escaped}$`),
    }),
  });
  await expect(header).toHaveCount(1);
  await header.click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
}

export async function addShortTextField(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add field" }).click();
  const dialog = page.getByRole("dialog", { name: "Add field" });
  await dialog.getByLabel(/^(Field )?Name$/).fill(name);
  await dialog.getByRole("button", { name: /Add field/ }).click();
  await expect(dialog).toBeHidden();
}

export async function gridCellForRowAndHeader(
  page: Page,
  options: { rowCellText: string; headerName: string },
): Promise<Locator> {
  const escapedHeader = options.headerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = page.getByRole("columnheader", {
    name: new RegExp(`^${escapedHeader}\\b`),
  });
  const columnIndex = await header.getAttribute("aria-colindex");
  if (!columnIndex) throw new Error(`${options.headerName} column is missing aria-colindex`);
  const row = page.getByRole("row").filter({
    has: page.getByRole("gridcell", { name: options.rowCellText, exact: true }),
  });
  await expect(row).toBeVisible();
  return row.locator(`td[aria-colindex="${columnIndex}"]`);
}

export async function readWindowTypesSlice(
  request: APIRequestContext,
  baseURL: string | undefined,
  projectId: string,
) {
  const detailResponse = await request.get(apiUrl(baseURL, `/api/v1/projects/${projectId}`));
  expect(detailResponse.status(), await detailResponse.text()).toBe(200);
  const detail = await detailResponse.json();
  const tableResponse = await request.get(
    apiUrl(
      baseURL,
      `/api/v1/projects/${projectId}/versions/${detail.active_version_id}/document/tables/window_types`,
    ),
  );
  expect(tableResponse.status(), await tableResponse.text()).toBe(200);
  return tableResponse.json();
}
