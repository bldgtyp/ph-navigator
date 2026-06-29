import { writeFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";
import { signIn } from "../_helpers";
import { commitCellEdit, firstGridCellForField } from "../table-regression/tableHelpers";

const RUN_PERF = process.env.PHN_PERF === "1";
const PERF_PROJECT_ID = process.env.PERF_PROJECT_ID;
const PERF_EMAIL = process.env.E2E_EMAIL ?? "codex@example.com";
const PERF_PASSWORD = process.env.E2E_PASSWORD ?? "password";
const DEFAULT_FRONTEND_BASE_URL = "http://localhost:5173";
const DEFAULT_LOCAL_API_BASE_URL = "http://localhost:8000";
const PRODUCTION_API_BASE_URL = "https://api.ph-nav.com";
const FRONTEND_BASE_URL = normalizeBaseUrl(process.env.E2E_BASE_URL ?? DEFAULT_FRONTEND_BASE_URL);
const API_BASE_URL = normalizeBaseUrl(
  process.env.E2E_API_BASE_URL ??
    (isProductionPhNavigatorUrl(FRONTEND_BASE_URL)
      ? PRODUCTION_API_BASE_URL
      : DEFAULT_LOCAL_API_BASE_URL),
);
const API_ORIGIN = originFor(API_BASE_URL);
const IS_PRODUCTION_TARGET =
  isProductionPhNavigatorUrl(FRONTEND_BASE_URL) || isProductionPhNavigatorUrl(API_BASE_URL);
const PERF_PRODUCTION = process.env.PHN_PERF_PRODUCTION === "1";
const PERF_READONLY = process.env.PHN_PERF_READONLY === "1";
const PERF_ALLOW_PRODUCTION_WRITES = process.env.PHN_PERF_ALLOW_PRODUCTION_WRITES === "1";
const INCLUDE_MODEL_VIEWER = !IS_PRODUCTION_TARGET || process.env.PHN_PERF_INCLUDE_MODEL === "1";
const PERF_TARGET_METADATA = {
  frontendBaseUrl: FRONTEND_BASE_URL,
  apiBaseUrl: API_BASE_URL,
  productionTarget: IS_PRODUCTION_TARGET,
  readOnly: PERF_READONLY,
  productionWritesAllowed: PERF_ALLOW_PRODUCTION_WRITES,
  modelViewerIncluded: INCLUDE_MODEL_VIEWER,
};

type PerfPage = {
  id: string;
  label: string;
  route: string;
  ready: (page: Page) => Promise<void>;
  scenario: (page: Page) => Promise<void>;
};

type NetworkResponseMetric = {
  url: string;
  method: string;
  resourceType: string;
  status: number;
  contentLength: number | null;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function originFor(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function isProductionPhNavigatorUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "ph-nav.com" || hostname.endsWith(".ph-nav.com");
  } catch {
    return false;
  }
}

function assertPerfEnvironment(): void {
  if (!IS_PRODUCTION_TARGET) return;
  if (!PERF_PRODUCTION) {
    throw new Error(
      "Production PH-Navigator perf targets require PHN_PERF_PRODUCTION=1. " +
        `Detected frontend=${FRONTEND_BASE_URL}, api=${API_BASE_URL}.`,
    );
  }
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
    throw new Error(
      "Production PH-Navigator perf runs require explicit E2E_EMAIL and E2E_PASSWORD.",
    );
  }
  if (!PERF_READONLY && !PERF_ALLOW_PRODUCTION_WRITES) {
    throw new Error(
      "Production PH-Navigator perf runs must set PHN_PERF_READONLY=1 or " +
        "PHN_PERF_ALLOW_PRODUCTION_WRITES=1.",
    );
  }
}

function responseMatchesApiOrigin(responseUrl: string): boolean {
  try {
    return new URL(responseUrl).origin === API_ORIGIN;
  } catch {
    return false;
  }
}

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

async function exerciseFirstNameCell(page: Page): Promise<void> {
  if (PERF_READONLY) {
    await hoverFirstGridCell(page);
    return;
  }
  await editFirstNameCell(page);
}

async function discardRecoveredDraft(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Recovered draft found" });
  const appeared = await dialog
    .waitFor({ state: "visible", timeout: 1_000 })
    .then(() => true)
    .catch(() => false);

  if (!appeared) return;

  if (PERF_READONLY) {
    throw new Error(
      "Recovered draft dialog appeared during a read-only perf run; reset the fixture first.",
    );
  }

  await dialog.getByRole("button", { name: "Discard draft" }).click();
  await expect(dialog).toBeHidden();
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

const basePerfPages: PerfPage[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "All projects" })).toBeVisible();
    },
    scenario: async (page) => {
      await page.getByRole("link", { name: "PERF-STRESS - Frontend Perf Stress Fixture" }).hover();
    },
  },
  {
    id: "status",
    label: "Status",
    route: projectRoute("status"),
    ready: async (page) => {
      await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
    },
    scenario: async (page) => {
      await page.getByRole("heading", { name: "Status" }).hover();
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
      await exerciseFirstNameCell(page);
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
      await exerciseFirstNameCell(page);
    },
  },
  {
    id: "apertures",
    label: "Apertures",
    route: projectRoute("apertures"),
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "Apertures" })).toBeVisible();
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
      await expect(page.getByRole("region", { name: "Assembly Builder" })).toBeVisible();
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
      await expect(page.getByRole("region", { name: "Climate" })).toBeVisible();
    },
    scenario: async (page) => {
      await page.getByRole("button").first().hover();
    },
  },
  {
    id: "model-viewer",
    label: "Model Viewer",
    route: projectRoute("model"),
    ready: async (page) => {
      await expect(page.getByRole("region", { name: "Model" })).toBeVisible();
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
      await expect(page.getByRole("region", { name: "Materials catalog" })).toBeVisible();
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
      await expect(
        page.getByRole("region", { name: "Window-Frame Elements catalog" }),
      ).toBeVisible();
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
      await expect(page.getByRole("region", { name: "Window-Glazing catalog" })).toBeVisible();
    },
    scenario: async (page) => {
      await hoverFirstGridCell(page);
    },
  },
];
const perfPages: PerfPage[] = basePerfPages.filter(
  (perfPage) => INCLUDE_MODEL_VIEWER || perfPage.id !== "model-viewer",
);

test.describe("frontend perf matrix", () => {
  test.skip(!RUN_PERF, "Set PHN_PERF=1 and PERF_PROJECT_ID=<seeded project id> to run.");
  test.skip(
    RUN_PERF && !PERF_PROJECT_ID,
    "PERF_PROJECT_ID is required for project-route perf cells.",
  );

  test.beforeAll(() => {
    assertPerfEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__PHN_ENABLE_REACT_PROFILER__ = true;
      window.__PHN_REACT_PROFILER__ = [];
      window.__PHN_PERF_LONG_TASKS__ = [];
      window.__PHN_PERF_LONG_TASKS_RESET_AT__ = 0;
      window.__PHN_PERF_LCP__ = null;
      window.__PHN_PERF_LCP_ENTRY__ = null;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.startTime < window.__PHN_PERF_LONG_TASKS_RESET_AT__) continue;
          window.__PHN_PERF_LONG_TASKS__.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });

      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries.at(-1);
        if (last) {
          const lcpEntry = last as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
            size?: number;
            element?: Element | null;
          };
          window.__PHN_PERF_LCP__ = lcpEntry.startTime;
          const element = lcpEntry.element ?? null;
          window.__PHN_PERF_LCP_ENTRY__ = {
            startTime: lcpEntry.startTime,
            renderTime: lcpEntry.renderTime ?? null,
            loadTime: lcpEntry.loadTime ?? null,
            size: lcpEntry.size ?? null,
            elementTag: element instanceof Element ? element.tagName.toLowerCase() : null,
            elementId: element instanceof Element ? element.id || null : null,
            elementClass:
              element instanceof Element && typeof element.className === "string"
                ? element.className || null
                : null,
            elementText:
              element instanceof Element ? element.textContent?.trim().slice(0, 160) : null,
          };
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    });
    await signIn(page, { email: PERF_EMAIL, password: PERF_PASSWORD });
    await page.evaluate(() => {
      performance.clearResourceTimings();
    });
  });

  for (const perfPage of perfPages) {
    test(`${perfPage.id}: cold load + scripted interaction`, async ({ page }, testInfo) => {
      const networkResponses: NetworkResponseMetric[] = [];
      page.on("response", (response) => {
        if (!responseMatchesApiOrigin(response.url())) return;

        const headers = response.headers();
        const contentLength = Number(headers["content-length"]);
        networkResponses.push({
          url: response.url(),
          method: response.request().method(),
          resourceType: response.request().resourceType(),
          status: response.status(),
          contentLength: Number.isFinite(contentLength) ? contentLength : null,
        });
      });

      await page.goto(perfPage.route);
      await discardRecoveredDraft(page);
      await perfPage.ready(page);
      await page.waitForLoadState("networkidle");
      await discardRecoveredDraft(page);
      await perfPage.ready(page);
      await page.evaluate(() => {
        window.__PHN_REACT_PROFILER__ = [];
        window.__PHN_PERF_LONG_TASKS__ = [];
        window.__PHN_PERF_LONG_TASKS_RESET_AT__ = performance.now();
      });

      const startedAt = Date.now();
      await perfPage.scenario(page);
      await page.waitForTimeout(250);

      const metrics = await page.evaluate(
        ({ interactionMs, networkResponses, target }) => {
          const navigation = performance.getEntriesByType("navigation")[0]?.toJSON();
          return {
            navigation,
            interactionMs,
            lcpMs: window.__PHN_PERF_LCP__,
            lcpEntry: window.__PHN_PERF_LCP_ENTRY__,
            longTasks: window.__PHN_PERF_LONG_TASKS__,
            reactCommits: window.__PHN_REACT_PROFILER__,
            resourceBytes: performance
              .getEntriesByType("resource")
              .map((entry) => entry.toJSON())
              .filter((entry) => entry.transferSize || entry.encodedBodySize),
            networkResponses,
            target,
          };
        },
        { interactionMs: Date.now() - startedAt, networkResponses, target: PERF_TARGET_METADATA },
      );

      const metricsJson = JSON.stringify(metrics, null, 2);
      const metricsPath = testInfo.outputPath(`${perfPage.id}-metrics.json`);
      await writeFile(metricsPath, metricsJson);

      await testInfo.attach(`${perfPage.id}-metrics.json`, {
        path: metricsPath,
        contentType: "application/json",
      });
    });
  }
});

declare global {
  interface Window {
    __PHN_ENABLE_REACT_PROFILER__?: boolean;
    __PHN_REACT_PROFILER__?: Array<{
      id: string;
      phase: "mount" | "update" | "nested-update";
      actualDuration: number;
      baseDuration: number;
      startTime: number;
      commitTime: number;
    }>;
    __PHN_PERF_LONG_TASKS__: Array<{ name: string; startTime: number; duration: number }>;
    __PHN_PERF_LONG_TASKS_RESET_AT__: number;
    __PHN_PERF_LCP__: number | null;
    __PHN_PERF_LCP_ENTRY__: {
      startTime: number;
      renderTime: number | null;
      loadTime: number | null;
      size: number | null;
      elementTag: string | null;
      elementId: string | null;
      elementClass: string | null;
      elementText: string | null;
    } | null;
  }
}
