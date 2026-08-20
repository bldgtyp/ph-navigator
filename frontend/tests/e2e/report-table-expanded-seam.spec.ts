import { expect, test } from "@playwright/test";

const ROW_COUNT = 3;

test("expanded report rows keep one continuous frame across the regression matrix", async ({
  page,
}) => {
  await page.setViewportSize({ width: 760, height: 700 });
  await page.goto("/tests/e2e/fixtures/report-table.html");

  for (let expandedIndex = 0; expandedIndex < ROW_COUNT; expandedIndex += 1) {
    const row = page.locator(".report-table__row").nth(expandedIndex);
    const collapsedBox = await row.boundingBox();
    await row.getByRole("button", { name: "Expand row" }).click();

    const expansion = page.locator(".report-table__expansion");
    const rowBox = await row.boundingBox();
    const expansionBox = await expansion.boundingBox();
    if (!collapsedBox || !rowBox || !expansionBox) {
      throw new Error("ReportTable geometry fixture did not render.");
    }

    expect(rowBox.width).toBe(collapsedBox.width);
    expect(rowBox.height).toBe(collapsedBox.height);
    expect(expansionBox.x).toBe(rowBox.x);
    expect(expansionBox.width).toBe(rowBox.width);
    expect(expansionBox.y).toBe(rowBox.y + rowBox.height);

    const styles = await row.evaluate((element) => {
      const expansionElement = element.nextElementSibling as HTMLElement;
      const primary = element.querySelector(".report-table__cell--primary") as HTMLElement;
      const gutter = element.querySelector(".report-table__chevron") as HTMLElement;
      return {
        rowShadow: getComputedStyle(element).boxShadow,
        expansionShadow: getComputedStyle(expansionElement).boxShadow,
        topLeftRadius: getComputedStyle(element).borderTopLeftRadius,
        topRightRadius: getComputedStyle(element).borderTopRightRadius,
        primaryBackground: getComputedStyle(primary).backgroundColor,
        gutterBackground: getComputedStyle(gutter).backgroundColor,
      };
    });

    expect(styles.rowShadow).toContain("inset");
    expect(styles.expansionShadow).toContain("inset");
    expect(styles.topLeftRadius).toBe("0px");
    expect(styles.topRightRadius).toBe("0px");
    expect(styles.primaryBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.gutterBackground).not.toBe("rgba(0, 0, 0, 0)");

    await row.getByRole("button", { name: "Collapse row" }).click();
  }
});

test("expanded frame and frozen lane survive horizontal scroll without a row action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 760, height: 700 });
  await page.goto("/tests/e2e/fixtures/report-table.html?rowAction=0");

  const row = page.locator(".report-table__row").nth(1);
  await row.getByRole("button", { name: "Expand row" }).click();
  const table = page.locator("[data-testid='report-table-fixture'] > .report-table");
  const widths = await table.evaluate((element) => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(widths.scroll).toBeGreaterThan(widths.client);

  await table.evaluate((element) => {
    element.scrollLeft = 180;
  });

  const geometry = await table.evaluate((element) => {
    const expandedRow = element.querySelector(".report-table__row--expanded") as HTMLElement;
    const expansion = expandedRow.nextElementSibling as HTMLElement;
    const primary = expandedRow.querySelector(".report-table__cell--primary") as HTMLElement;
    const gutter = expandedRow.querySelector(".report-table__chevron") as HTMLElement;
    const nested = expansion.querySelector(".report-table") as HTMLElement;
    const nestedPrimary = nested.querySelector(".report-table__cell--primary") as HTMLElement;
    const rowRect = expandedRow.getBoundingClientRect();
    const expansionRect = expansion.getBoundingClientRect();
    return {
      scrollLeft: element.scrollLeft,
      seam: expansionRect.top - rowRect.bottom,
      left: expansionRect.left - rowRect.left,
      right: expansionRect.right - rowRect.right,
      rowAction: expandedRow.querySelector(".report-table__row-action"),
      primaryPosition: getComputedStyle(primary).position,
      gutterPosition: getComputedStyle(gutter).position,
      primaryBackground: getComputedStyle(primary).backgroundColor,
      gutterBackground: getComputedStyle(gutter).backgroundColor,
      nestedOverflow: getComputedStyle(nested).overflow,
      nestedPrimaryPosition: getComputedStyle(nestedPrimary).position,
    };
  });

  expect(geometry.scrollLeft).toBe(180);
  expect(geometry.seam).toBe(0);
  expect(geometry.left).toBe(0);
  expect(geometry.right).toBe(0);
  expect(geometry.rowAction).toBeNull();
  expect(geometry.primaryPosition).toBe("sticky");
  expect(geometry.gutterPosition).toBe("sticky");
  expect(geometry.primaryBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.gutterBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(geometry.nestedOverflow).toBe("visible");
  expect(geometry.nestedPrimaryPosition).toBe("static");
});
