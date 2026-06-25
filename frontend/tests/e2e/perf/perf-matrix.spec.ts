import { expect, test, type Page } from "@playwright/test";
import { signIn } from "../_helpers";
import { commitCellEdit, firstGridCellForField } from "../table-regression/tableHelpers";

const RUN_PERF = process.env.PHN_PERF === "1";
const PERF_PROJECT_ID = process.env.PERF_PROJECT_ID;
const PERF_EMAIL = process.env.E2E_EMAIL ?? "codex@example.com";
const PERF_PASSWORD = process.env.E2E_PASSWORD ?? "password";

type PerfPage = {
  id: string;
  label: string;
  route: string;
  ready: (page: Page) => Promise<void>;
  scenario: (page: Page) => Promise<void>;
};

const projectRoute = (tab: string) => {
  if (!PERF_PROJECT_ID) return `/__missing_perf_project_id__/${tab}`;
  return `/projects/${PERF_PROJECT_ID}/${tab}`;
};

async function editFirstNameCell(page: Page): Promise<void> {
  await commitCellEdit(page, firstGridCellForField(page, "name"), "Perf Edit", {
    clearFirst: true,
  });
}

async function hoverFirstGridCell(page: Page): Promise<void> {
  await page.locator('td[role="gridcell"]').first().hover();
}

async function dragPrimaryCanvas(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

const perfPages: PerfPage[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "My Projects", exact: true })).toBeVisible();
    },
    scenario: async (page) => {
      await page.getByRole("link").filter({ hasText: "PERF-STRESS" }).first().hover();
    },
  },
  {
    id: "spaces",
    label: "Spaces",
    route: projectRoute("spaces/rooms"),
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();
    },
    scenario: async (page) => {
      await editFirstNameCell(page);
    },
  },
  {
    id: "equipment",
    label: "Equipment",
    route: projectRoute("equipment?tab=pumps"),
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "Equipment" })).toBeVisible();
    },
    scenario: async (page) => {
      await editFirstNameCell(page);
    },
  },
  {
    id: "apertures",
    label: "Apertures",
    route: projectRoute("apertures"),
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Apertures" })).toBeVisible();
    },
    scenario: async (page) => {
      await dragPrimaryCanvas(page, { x: 240, y: 240 }, { x: 520, y: 360 });
    },
  },
  {
    id: "envelope",
    label: "Envelope",
    route: projectRoute("envelope"),
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Envelope" })).toBeVisible();
    },
    scenario: async (page) => {
      await dragPrimaryCanvas(page, { x: 260, y: 260 }, { x: 560, y: 380 });
    },
  },
  {
    id: "climate",
    label: "Climate",
    route: projectRoute("climate"),
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Climate" })).toBeVisible();
    },
    scenario: async (page) => {
      await page.getByRole("button").first().hover();
    },
  },
  {
    id: "model-viewer",
    label: "Model Viewer",
    route: projectRoute("model-viewer"),
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Model Viewer" })).toBeVisible();
    },
    scenario: async (page) => {
      await dragPrimaryCanvas(page, { x: 420, y: 320 }, { x: 560, y: 360 });
    },
  },
  {
    id: "materials-catalog",
    label: "Materials Catalog",
    route: "/catalog/materials",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Materials Catalog" })).toBeVisible();
    },
    scenario: async (page) => {
      await hoverFirstGridCell(page);
    },
  },
  {
    id: "frame-types-catalog",
    label: "Frame Types Catalog",
    route: "/catalog/frame-types",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Frame Types" })).toBeVisible();
    },
    scenario: async (page) => {
      await hoverFirstGridCell(page);
    },
  },
  {
    id: "glazing-types-catalog",
    label: "Glazing Types Catalog",
    route: "/catalog/glazing-types",
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Glazing Types" })).toBeVisible();
    },
    scenario: async (page) => {
      await hoverFirstGridCell(page);
    },
  },
];

test.describe("frontend perf matrix", () => {
  test.skip(!RUN_PERF, "Set PHN_PERF=1 and PERF_PROJECT_ID=<seeded project id> to run.");
  test.skip(
    RUN_PERF && !PERF_PROJECT_ID,
    "PERF_PROJECT_ID is required for project-route perf cells.",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__PHN_PERF_LONG_TASKS__ = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__PHN_PERF_LONG_TASKS__.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    });
    await signIn(page, { email: PERF_EMAIL, password: PERF_PASSWORD });
    await page.evaluate(() => {
      performance.clearResourceTimings();
    });
  });

  for (const perfPage of perfPages) {
    test(`${perfPage.id}: cold load + scripted interaction`, async ({ page }, testInfo) => {
      await page.goto(perfPage.route);
      await perfPage.ready(page);
      await page.waitForLoadState("networkidle");

      const startedAt = Date.now();
      await perfPage.scenario(page);
      await page.waitForTimeout(250);

      const metrics = await page.evaluate((interactionMs) => {
        const navigation = performance.getEntriesByType("navigation")[0]?.toJSON();
        return {
          navigation,
          interactionMs,
          longTasks: window.__PHN_PERF_LONG_TASKS__,
          resourceBytes: performance
            .getEntriesByType("resource")
            .map((entry) => entry.toJSON())
            .filter((entry) => entry.transferSize || entry.encodedBodySize),
        };
      }, Date.now() - startedAt);

      await testInfo.attach(`${perfPage.id}-metrics.json`, {
        body: JSON.stringify(metrics, null, 2),
        contentType: "application/json",
      });
    });
  }
});

declare global {
  interface Window {
    __PHN_PERF_LONG_TASKS__: Array<{ name: string; startTime: number; duration: number }>;
  }
}
