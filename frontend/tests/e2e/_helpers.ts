import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const FRAME_TYPES_PATH = "/api/v1/catalogs/frame-types";
export const GLAZING_TYPES_PATH = "/api/v1/catalogs/glazing-types";

export const FRAME_TYPES_TABLE = "frame_types";
export const GLAZING_TYPES_TABLE = "glazing_types";

const DEFAULT_BASE_URL = "http://localhost:5173";

// TB-01's mutating-route Origin check rejects API requests without an
// allowed Origin header; `page.request` doesn't add one by default.
export function originHeaders(baseURL: string | undefined): Record<string, string> {
  return { Origin: (baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, "") };
}

export async function signIn(page: Page): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "ed@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export async function createProject(
  page: Page,
  options: { name: string; btNumber: string; client?: string },
): Promise<string> {
  await page.getByRole("button", { name: "Create new project" }).click();
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
