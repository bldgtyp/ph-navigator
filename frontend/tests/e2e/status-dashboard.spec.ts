import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

test("Overview cold-loads independently for editors and public viewers", async ({
  page,
  browser,
  context,
}) => {
  await signIn(page);
  const suffix = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Status Dashboard ${suffix}`,
    btNumber: `status-${suffix}`,
  });

  await expect(page.getByRole("heading", { name: "Roadmap" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Documentation progress" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Roadmap" })).toBeVisible();
  await page.getByRole("button", { name: "Apply BLDGTYP default template" }).click();
  await expect(page.getByText("CAD files received")).toBeVisible();

  const coldPage = await context.newPage();
  let editorRollupRequests = 0;
  coldPage.on("request", (request) => {
    if (request.url().includes("/documentation-rollup")) editorRollupRequests += 1;
  });
  const rollupResponse = coldPage.waitForResponse(
    (response) =>
      response.url().includes("/documentation-rollup") && response.request().method() === "GET",
  );
  await coldPage.goto(`/projects/${projectId}/overview`);
  const response = await rollupResponse;
  expect(response.status()).toBe(200);
  expect(response.url()).toContain("/draft/documentation-rollup");
  expect(Buffer.byteLength(await response.body())).toBeLessThan(100_000);
  await expect(coldPage.getByRole("heading", { name: "Roadmap" })).toBeVisible();
  await expect(coldPage.getByText("CAD files received")).toBeVisible();
  expect(editorRollupRequests).toBe(1);

  const firstMilestone = coldPage.locator(".status-item").first();
  await firstMilestone.focus();
  await expect(
    firstMilestone.getByRole("button", { name: "More actions for CAD files received" }),
  ).toBeVisible();
  await coldPage.keyboard.press("Alt+ArrowDown");
  await expect(coldPage.locator(".status-title-button").nth(1)).toHaveText("CAD files received");

  await coldPage.setViewportSize({ width: 800, height: 900 });
  const progressBox = await coldPage
    .getByRole("region", { name: "Documentation progress" })
    .boundingBox();
  const roadmapBox = await coldPage.getByRole("region", { name: "Roadmap" }).boundingBox();
  expect(progressBox).not.toBeNull();
  expect(roadmapBox).not.toBeNull();
  expect(progressBox!.y).toBeGreaterThan(roadmapBox!.y + roadmapBox!.height - 1);

  await coldPage.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await coldPage
      .locator(".status-row-menu")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");

  const touchContext = await browser.newContext({
    hasTouch: true,
    storageState: await context.storageState(),
  });
  try {
    const touchPage = await touchContext.newPage();
    await touchPage.goto(`/projects/${projectId}/overview`);
    const touchMenu = touchPage.locator(".status-row-menu").first();
    await expect(touchMenu).toBeVisible();
    expect(await touchMenu.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
    expect(await touchMenu.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe(
      "auto",
    );
  } finally {
    await touchContext.close();
  }

  const publicContext = await browser.newContext();
  try {
    const publicPage = await publicContext.newPage();
    const viewerRollupResponse = publicPage.waitForResponse((viewerResponse) =>
      viewerResponse.url().includes("/documentation-rollup"),
    );
    await publicPage.goto(`/projects/${projectId}/overview`);
    expect((await viewerRollupResponse).url()).toContain("/document/documentation-rollup");
    await expect(publicPage.getByRole("heading", { name: "Roadmap" })).toBeVisible();
    await expect(publicPage.getByText("CAD files received")).toBeVisible();
    await expect(publicPage.getByRole("button", { name: "Add milestone" })).toHaveCount(0);
    await expect(publicPage.getByRole("button", { name: /More actions for/ })).toHaveCount(0);
    await expect(publicPage.getByLabel(/Drag .* to reorder/)).toHaveCount(0);
    await expect(publicPage.getByRole("button", { name: /Set .* to/ })).toHaveCount(0);
  } finally {
    await publicContext.close();
    await coldPage.close();
  }
});
