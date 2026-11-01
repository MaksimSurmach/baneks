import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";
for (const width of [1440, 768, 390])
  test(`quiet archive screenshots ${width}`, async ({ page }, info) => {
    await mockApi(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/jokes");
    await expect(page.locator("article")).toHaveCount(20);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: info.outputPath(`catalog-${width}.png`),
      fullPage: false,
    });
    if (width <= 900) {
      await page.getByRole("button", { name: "Фильтры", exact: true }).click();
      await page.screenshot({ path: info.outputPath(`filters-${width}.png`) });
      await page.keyboard.press("Escape");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.goto("/jokes/2");
    await expect(
      page.getByRole("heading", { name: "Анекдот №2" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`joke-${width}.png`),
      fullPage: true,
    });
  });
