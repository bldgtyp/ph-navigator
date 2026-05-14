import { test, expect } from "@playwright/test";
import { createProject, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

test("editor creates a project and public viewer can open the shell", async ({ page, browser }) => {
  // Asserts the `/` -> `/sign-in?next=%2F` redirect; the rest of the
  // sign-in flow is shared with `signIn` but the redirect probe is unique
  // to this test, so it stays inline.
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2F/);
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "ed@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "My Projects", exact: true })).toBeVisible();

  const btNumber = `e2e-${Date.now().toString().slice(-8)}`;
  await createProject(page, { name: `E2E Project ${btNumber}`, btNumber });
  await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
  await expect(page.getByText(`${btNumber} · BLDGTYP`)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Track this project's lifecycle milestones." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply BLDGTYP default template" }).click();
  await expect(page.getByText("CAD files received")).toBeVisible();
  await expect(page.getByText("Design Model complete")).toBeVisible();

  await page.getByRole("button", { name: "Set CAD files received to Done" }).click();
  await expect(page.getByText("Done")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Completion date").fill("2026-05-01");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("button", { name: "May 1, 2026" })).toBeVisible();

  await page.getByRole("button", { name: "Move Design Model complete up" }).click();
  await expect(page.locator(".status-title-button").first()).toHaveText("Design Model complete");

  await page.getByRole("button", { name: "Delete" }).last().click();
  await page.getByRole("button", { name: "Delete item" }).click();
  await expect(page.getByText("Certification Complete")).toHaveCount(0);
  const publicStatusUrl = page.url();

  await page.getByRole("link", { name: "Equipment" }).click();
  await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
  await page.getByRole("button", { name: "Add room" }).click();
  await page.getByLabel("Number").fill("101");
  await page.getByLabel("Name").fill("Living Room");
  await page.getByLabel("Floor level").fill("Ground");
  await page.getByLabel("Building zone").fill("Residential");
  await page.getByLabel("People").fill("2");
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByText("Unsaved Rooms draft restored")).toBeVisible();
  await expect(page.getByText("Living Room")).toBeVisible();
  await expect(page.getByText("Ground")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Unsaved Rooms draft restored")).toBeVisible();
  await expect(page.getByText("Living Room")).toBeVisible();

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Unsaved Rooms draft restored")).toHaveCount(0);
  await expect(page.getByText("Clean")).toBeVisible();

  await page.getByRole("button", { name: "Save As" }).click();
  await page.getByLabel("Version name").fill("Round 1 Submit");
  await page.getByLabel("Version kind").selectOption("submitted");
  await page.getByRole("button", { name: "Create version" }).click();
  await expect(page.getByRole("button", { name: /Round 1 Submit · Locked/ })).toBeVisible();
  await expect(page).toHaveURL(/\?version=/);

  await page.getByRole("button", { name: /Round 1 Submit · Locked/ }).click();
  await page
    .locator(".version-row")
    .filter({ hasText: "Working" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.getByRole("button", { name: "Working" })).toBeVisible();
  await page.getByRole("button", { name: "Lock" }).click();
  await expect(page.getByRole("button", { name: /Working · Locked/ })).toBeVisible();
  await expect(
    page.getByText("This version is locked. Save As to copy it into a new version."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add room" })).toHaveCount(0);

  const projectDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Project JSON" }).click();
  expect((await projectDownload).suggestedFilename()).toMatch(/^project-.+\.json$/);

  const roomsDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Rooms JSON" }).click();
  expect((await roomsDownload).suggestedFilename()).toMatch(/^rooms-.+\.json$/);

  await page.getByRole("button", { name: "Diff" }).click();
  await page.getByLabel("Compare current version to").selectOption({ label: "Round 1 Submit" });
  const diffDialog = page.getByRole("dialog", { name: "Diff" });
  // Diff renders one <section class="diff-table"> per registered table
  // (rooms, window_types, …). Scope the "0 changed paths" count to the
  // rooms section so an unrelated table with zero changes can't mask a
  // Rooms regression.
  const roomsDiffSection = diffDialog.locator("section.diff-table").filter({
    has: page.getByRole("heading", { name: "rooms" }),
  });
  await expect(roomsDiffSection.getByText("0 changed paths")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  const publicContext = await browser.newContext();
  try {
    const publicPage = await publicContext.newPage();
    await publicPage.goto(publicStatusUrl);
    await expect(publicPage.getByText("Read-only")).toBeVisible();
    await expect(publicPage.getByText("Edit controls hidden")).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Status" })).toBeVisible();
    await expect(publicPage.getByText("CAD files received")).toBeVisible();
    await expect(publicPage.getByRole("button", { name: "Add item" })).toHaveCount(0);
    await expect(publicPage.getByRole("button", { name: "Delete" })).toHaveCount(0);
  } finally {
    await publicContext.close();
  }
});

test("same-editor Rooms tabs freeze stale active edits", async ({ page, context }) => {
  await signIn(page);

  const btNumber = `tabs-${Date.now().toString().slice(-8)}`;
  await createProject(page, { name: `Tab Conflict ${btNumber}`, btNumber });

  await page.getByRole("link", { name: "Equipment" }).click();
  await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
  await page.getByRole("button", { name: "Add room" }).click();
  await page.getByLabel("Number").fill("101");
  await page.getByLabel("Name").fill("Living Room");
  await page.getByLabel("Floor level").fill("Ground");
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByText("Living Room")).toBeVisible();

  const projectUrl = page.url();
  const secondPage = await context.newPage();
  await secondPage.goto(projectUrl);
  await expect(secondPage.getByText("Living Room")).toBeVisible();

  await page.getByText("Living Room").click();
  await page.getByRole("grid").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: /Room: 101/ })).toBeVisible();

  await secondPage.getByRole("button", { name: "Add room" }).click();
  const secondPageNewRoom = secondPage.getByRole("dialog", { name: "New room" });
  await secondPageNewRoom.getByLabel("Number").fill("102");
  await secondPageNewRoom.getByLabel("Name").fill("Kitchen");
  await secondPageNewRoom.getByLabel("Floor level").fill("Ground");
  await secondPageNewRoom.getByRole("button", { name: "Save room" }).click();
  await expect(secondPage.getByText("Kitchen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save room" })).toBeEnabled();

  await secondPage.getByText("Living Room").click();
  await secondPage.getByRole("grid").focus();
  await secondPage.keyboard.press("Enter");
  await expect(secondPage.getByRole("dialog", { name: /Room: 101/ })).toBeVisible();
  await secondPage.getByLabel("Name").fill("Living Room Remote");
  await secondPage.getByRole("button", { name: "Save room" }).click();
  await expect(secondPage.getByText("Living Room Remote")).toBeVisible();

  const conflictMessage =
    "Rooms draft changed in another tab. Reload draft before saving this room.";
  await expect(page.locator(".tab-panel > .draft-conflict-banner")).toContainText(conflictMessage);
  await expect(page.getByRole("dialog", { name: /Room: 101/ })).toContainText(conflictMessage);
  await expect(page.getByRole("button", { name: "Save room" })).toBeDisabled();
  await page
    .getByRole("dialog", { name: /Room: 101/ })
    .getByRole("button", { name: "Reload draft" })
    .click();
  await expect(page.getByRole("dialog", { name: /Room: 101/ })).toHaveCount(0);
  await expect(page.getByText("Kitchen")).toBeVisible();
  await expect(page.getByText("Living Room Remote")).toBeVisible();

  await secondPage.close();
});
