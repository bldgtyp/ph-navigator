import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  apiUrl,
  createProject,
  gridCellForRowAndHeader,
  originHeaders,
  readActiveVersionId,
  readVersionedTable,
  signInForAgent,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAGAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDxyiiiv3E8w//Z",
  "base64",
);

const TINY_HEIC = Buffer.from(
  "AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABngABAAAAAAAAADQAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA+mlwcnAAAADaaXBjbwAAAHVodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAACAAAAAEAAAAGAAAAAf///8gAAAAC////xgAAAAIAAAAOcGl4aQAAAAABCAAAABhpcG1hAAAAAAAAAAEAAQWBAgMFhAAAADxtZGF0AAAAMCgBrxMhZmNA+BD3Z//rvBX/lWs/8zex6c7IR0DA0iCAm0BIk11QCxYQgId2pVbc+A==",
  "base64",
);

test("Documentation tab supports contractor directions and editor equipment photo publication", async ({
  page,
  browser,
  baseURL,
}) => {
  await signInForAgent(page);

  const stamp = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Documentation ${stamp}`,
    btNumber: `doc-${stamp}`,
  });
  const versionId = await readActiveVersionId(page.request, baseURL, projectId);
  const row = await seedVentilator(page.request, baseURL, projectId, versionId, stamp);
  await saveDraft(page.request, baseURL, projectId, versionId, row.versionEtag);

  const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`/projects/${projectId}/documentation`);
    await expect(publicPage.getByText("Read-only")).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Documentation" })).toBeVisible();
    await expect(publicPage.getByRole("button", { name: row.displayName })).toBeVisible();
    await expect(publicPage.getByText("Photos 0/1").first()).toBeVisible();

    await publicPage.getByRole("button", { name: "Missing photos" }).click();
    await expect(publicPage.getByRole("button", { name: row.displayName })).toBeVisible();
    await publicPage.getByRole("button", { name: "How to photograph - Equipment" }).click();
    const directions = publicPage.getByRole("dialog", { name: "How to photograph - Equipment" });
    await expect(directions.getByRole("heading", { name: "Ventilators" })).toBeVisible();
    await expect(
      directions.getByText(
        "Readable nameplate with manufacturer, model number, serial number, airflow, and electrical data.",
        { exact: true },
      ),
    ).toBeVisible();
  } finally {
    await publicContext.close();
  }

  await page.goto(`/projects/${projectId}/equipment?tab=ventilators`);
  await expect(page.getByText(row.recordId)).toBeVisible();
  const ownerPhotoCell = await gridCellForRowAndHeader(page, {
    rowCellText: row.recordId,
    headerName: "Site Photos",
  });
  const ownerTableWrite = page.waitForResponse(
    (response) =>
      response.url().includes(`/versions/${versionId}/draft/tables/ventilators`) &&
      response.request().method() === "PUT" &&
      response.status() === 200,
  );
  await ownerPhotoCell.locator('input[type="file"]').setInputFiles({
    name: "installed-ventilator.jpg",
    mimeType: "image/jpeg",
    buffer: TINY_JPEG,
  });
  await ownerTableWrite;

  await page.goto(`/projects/${projectId}/documentation#equipment`);
  const record = page.getByRole("listitem").filter({
    has: page.getByRole("button", { name: row.displayName }),
  });
  await expect(record.getByText("1 attached")).toBeVisible();
  await record.locator('input[type="file"]').setInputFiles({
    name: "installed-ventilator.heic",
    mimeType: "image/heic",
    buffer: TINY_HEIC,
  });
  await expect(record.getByText("2 attached")).toBeVisible();

  const saveVersionButton = page.getByRole("button", {
    name: "Save Version",
    description: /Write the current draft into the active unlocked version/,
    exact: true,
  });
  await saveVersionButton.click();
  await expect(saveVersionButton).toHaveCount(0);

  const publishedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const publishedPage = await publishedContext.newPage();
    await publishedPage.goto(`/projects/${projectId}/documentation`);
    const publishedRecord = publishedPage.getByRole("listitem").filter({
      has: publishedPage.getByRole("button", { name: row.displayName }),
    });
    await expect(publishedRecord.getByText("2 attached")).toBeVisible();
    await expect(publishedRecord.locator('input[type="file"]')).toHaveCount(0);
    await expect(publishedRecord.getByRole("button", { name: "Add file" })).toHaveCount(0);
  } finally {
    await publishedContext.close();
  }
});

async function seedVentilator(
  request: APIRequestContext,
  baseURL: string | undefined,
  projectId: string,
  versionId: string,
  stamp: string,
): Promise<{ id: string; recordId: string; displayName: string; versionEtag: string }> {
  const slice = await readVersionedTable(
    request,
    baseURL,
    projectId,
    "draft/tables/ventilators",
    versionId,
  );
  const id = `vent_e2e_${stamp}`;
  const recordId = `ERV-${stamp}`;
  const displayName = `Penthouse ERV ${stamp}`;
  const row = {
    id,
    inside_outside: null,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    photo_asset_ids: [],
    datasheet_not_required: false,
    photo_not_required: false,
    custom_values: {
      record_id: recordId,
      name: displayName,
      manufacturer: "Zehnder",
      model: "CA350",
      airflow_rate_m3h: null,
      heat_recovery_percent: null,
      moisture_recovery_percent: null,
      electrical_efficiency_wh_m3: null,
      filter_merv_rating: null,
      frost_protection: null,
      status: "opt_status_needed",
    },
  };
  const headers = originHeaders(baseURL);
  if (slice.draft_etag) headers["If-Match"] = slice.draft_etag;
  else headers["If-Match-Version"] = slice.version_etag;
  const response = await request.put(
    apiUrl(baseURL, `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/ventilators`),
    {
      headers,
      data: {
        ventilators: [...slice.ventilators, row],
        field_defs: slice.field_defs,
        single_select_options: slice.single_select_options,
      },
    },
  );
  expect(response.status(), await response.text()).toBe(200);
  return { id, recordId, displayName, versionEtag: slice.version_etag };
}

async function saveDraft(
  request: APIRequestContext,
  baseURL: string | undefined,
  projectId: string,
  versionId: string,
  versionEtag: string,
): Promise<void> {
  const response = await request.post(
    apiUrl(baseURL, `/api/v1/projects/${projectId}/versions/${versionId}/draft/save`),
    { headers: { ...originHeaders(baseURL), "If-Match": versionEtag } },
  );
  expect(response.status(), await response.text()).toBe(200);
}
