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

test("Documentation tab supports contractor directions and editor evidence publication", async ({
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
    await expect(publicPage.getByRole("heading", { name: "Documentation" })).toHaveCount(0);
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
  const photoWaiver = record
    .locator(".documentation-evidence-cell")
    .filter({ hasText: "Photos" })
    .getByLabel("Not required");
  const checkWrite = page.waitForResponse(
    (response) =>
      response.url().endsWith("/draft/tables/ventilators") && response.request().method() === "PUT",
  );
  await photoWaiver.click();
  await expect(photoWaiver).toBeChecked();
  await checkWrite;
  await page.reload();
  await expect(photoWaiver).toBeChecked();
  const uncheckWrite = page.waitForResponse(
    (response) =>
      response.url().endsWith("/draft/tables/ventilators") && response.request().method() === "PUT",
  );
  await photoWaiver.click();
  await expect(photoWaiver).not.toBeChecked();
  await uncheckWrite;
  await page.reload();
  await expect(photoWaiver).not.toBeChecked();
  await record.locator('input[type="file"]').setInputFiles({
    name: "installed-ventilator.heic",
    mimeType: "image/heic",
    buffer: TINY_HEIC,
  });
  await expect(record.getByText("2 attached")).toBeVisible();

  const envelopeMaterialName = await seedEnvelopeMaterial(
    page.request,
    baseURL,
    projectId,
    versionId,
    stamp,
  );
  await page.goto(`/projects/${projectId}/documentation#envelope`);
  await page.reload();
  const envelopeRecord = page.getByRole("listitem").filter({
    has: page.getByRole("button", { name: envelopeMaterialName }),
  });
  const envelopePhotoWaiver = envelopeRecord
    .locator(".documentation-evidence-cell")
    .filter({ hasText: "Photos" })
    .getByLabel("Not required");
  const envelopeCheckWrite = page.waitForResponse(
    (response) =>
      response.url().endsWith("/draft/tables/assembly_segments") &&
      response.request().method() === "PUT",
  );
  await envelopePhotoWaiver.click();
  const envelopeCheckResponse = await envelopeCheckWrite;
  const envelopeCheckPayload = envelopeCheckResponse.request().postDataJSON() as {
    rows: Array<{ photo_not_required: boolean }>;
  };
  expect(envelopeCheckPayload.rows.every((row) => row.photo_not_required)).toBe(true);
  const envelopeCheckRows = (
    (await envelopeCheckResponse.json()) as { rows: Array<{ photo_not_required: boolean }> }
  ).rows;
  expect(envelopeCheckRows.some((row) => row.photo_not_required)).toBe(true);
  await page.reload();
  await expect(envelopePhotoWaiver).toBeChecked();
  const envelopeUncheckRead = page.waitForResponse(
    (response) =>
      response.url().endsWith("/draft/tables/assembly_segments") &&
      response.request().method() === "GET",
  );
  const envelopeUncheckWrite = page.waitForResponse(
    (response) =>
      response.url().endsWith("/draft/tables/assembly_segments") &&
      response.request().method() === "PUT",
  );
  await envelopePhotoWaiver.click();
  const envelopeSegmentsBeforeUncheck = await envelopeUncheckRead;
  const envelopeRows = (
    (await envelopeSegmentsBeforeUncheck.json()) as { rows: Array<{ photo_not_required: boolean }> }
  ).rows;
  expect(envelopeRows.some((row) => row.photo_not_required)).toBe(true);
  const envelopeUncheckResponse = await envelopeUncheckWrite;
  const envelopeUncheckPayload = envelopeUncheckResponse.request().postDataJSON() as {
    rows: Array<{ photo_not_required: boolean }>;
  };
  expect(envelopeUncheckPayload.rows.every((row) => !row.photo_not_required)).toBe(true);
  const envelopeUncheckRows = (
    (await envelopeUncheckResponse.json()) as { rows: Array<{ photo_not_required: boolean }> }
  ).rows;
  expect(envelopeUncheckRows.every((row) => !row.photo_not_required)).toBe(true);
  await page.reload();
  await expect(envelopePhotoWaiver).not.toBeChecked();

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

async function seedEnvelopeMaterial(
  request: APIRequestContext,
  baseURL: string | undefined,
  projectId: string,
  versionId: string,
  stamp: string,
): Promise<string> {
  const commandPath = `/api/v1/projects/${projectId}/versions/${versionId}/draft/envelope/commands`;
  const read = await request.get(
    apiUrl(baseURL, `/api/v1/projects/${projectId}/versions/${versionId}/envelope?source=draft`),
  );
  expect(read.ok(), await read.text()).toBeTruthy();
  const current = (await read.json()) as EnvelopeRead;
  const created = await request.post(apiUrl(baseURL, commandPath), {
    headers: envelopeWriteHeaders(baseURL, current),
    data: {
      command: {
        kind: "create_assembly",
        name: `Envelope waiver ${stamp}`,
        type: "wall",
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const createdEnvelope = (await created.json()) as EnvelopeRead;
  const assembly = createdEnvelope.assemblies.find(
    (candidate) => candidate.name === `Envelope waiver ${stamp}`,
  );
  const layer = assembly?.layers[0];
  const segment = layer?.segments[0];
  if (!assembly || !layer || !segment)
    throw new Error("Envelope fixture assembly was not created.");

  const materialName = `Envelope material ${stamp}`;
  const assigned = await request.post(apiUrl(baseURL, commandPath), {
    headers: envelopeWriteHeaders(baseURL, createdEnvelope),
    data: {
      command: {
        kind: "hand_enter_material",
        assembly_id: assembly.id,
        layer_id: layer.id,
        segment_id: segment.id,
        name: materialName,
      },
    },
  });
  expect(assigned.ok(), await assigned.text()).toBeTruthy();
  const assignedEnvelope = (await assigned.json()) as EnvelopeRead;
  expect(
    assignedEnvelope.project_materials.some((material) => material.name === materialName),
  ).toBe(true);
  const assignedAssembly = assignedEnvelope.assemblies.find(
    (candidate) => candidate.id === assembly.id,
  );
  expect(assignedAssembly?.layers[0]?.segments[0]?.project_material_id).not.toBeNull();
  const summary = await request.get(
    apiUrl(
      baseURL,
      `/api/v1/projects/${projectId}/versions/${versionId}/draft/documentation-summary`,
    ),
  );
  expect(summary.ok(), await summary.text()).toBeTruthy();
  expect(JSON.stringify(await summary.json())).toContain(materialName);
  return materialName;
}

type EnvelopeRead = {
  version_etag: string;
  draft_etag: string | null;
  assemblies: Array<{
    id: string;
    name: string;
    layers: Array<{
      id: string;
      segments: Array<{ id: string; project_material_id: string | null }>;
    }>;
  }>;
  project_materials: Array<{ id: string; name: string }>;
};

function envelopeWriteHeaders(
  baseURL: string | undefined,
  envelope: Pick<EnvelopeRead, "version_etag" | "draft_etag">,
): Record<string, string> {
  return {
    ...originHeaders(baseURL),
    ...(envelope.draft_etag
      ? { "If-Match": envelope.draft_etag }
      : { "If-Match-Version": envelope.version_etag }),
  };
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
