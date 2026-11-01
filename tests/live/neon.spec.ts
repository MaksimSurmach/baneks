import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
// Cloudflare serves this header; GitHub Pages embeds its supported directives.
const csp = /Content-Security-Policy: (.+)/.exec(
  readFileSync(new URL("../../public/_headers", import.meta.url), "utf8"),
)![1];
test("production bundle reads live Neon, filters, rating, random and hidden ID", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      response.request().resourceType() !== "document"
    )
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("jokes");
  await expect(page.locator("article")).toHaveCount(20, { timeout: 20000 });
  await expect(page.getByText(/опубликованных анекдотов$/)).toBeVisible();
  await expect(page.locator("header img")).toHaveJSProperty("complete", true);
  expect(
    await page
      .locator("header img")
      .evaluate(
        (img) => img instanceof HTMLImageElement && img.naturalWidth > 0,
      ),
  ).toBe(true);
  await expect(
    page.getByRole("checkbox", { name: "семья", exact: true }),
  ).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: info.outputPath(`live-catalog-${width}.png`),
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("checkbox", { name: "семья", exact: true }).check();
  await expect(page.locator("article")).toHaveCount(20, { timeout: 20000 });
  await page.getByRole("button", { name: "Следующая →" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article")).toHaveCount(20, { timeout: 20000 });
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "семья", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("combobox", { name: "Сортировка" })
    .selectOption("rating");
  await expect(page.locator("article")).toHaveCount(20, { timeout: 20000 });
  await page.getByRole("button", { name: "Случайный анекдот →" }).click();
  await expect(page.getByRole("heading", { name: /Анекдот №/ })).toBeVisible({
    timeout: 20000,
  });
  const first = page.url();
  await page.screenshot({
    path: info.outputPath("live-joke-1440.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ещё случайный →" }).click();
  await expect(page.getByRole("heading", { name: /Анекдот №/ })).toBeVisible({
    timeout: 20000,
  });
  await expect(page).not.toHaveURL(first);
  await page.goto("jokes/101");
  await expect(
    page.getByRole("heading", { name: "Страница не найдена" }),
  ).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

test("production bundle remains functional under shipped CSP and direct links", async ({
  page,
  baseURL,
}) => {
  const hosted = !!process.env.LIVE_URL;
  const pages = new URL(baseURL ?? "http://localhost:4174").hostname.endsWith(
    ".github.io",
  );
  const violations: string[] = [];
  page.on("pageerror", (error) => violations.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      response.request().resourceType() !== "document"
    )
      violations.push(`${response.status()} ${response.url()}`);
  });
  page.on("console", (m) => {
    // Pages serves the SPA fallback with 404; other console errors still fail.
    if (
      m.type() === "error" &&
      !(
        pages &&
        m
          .text()
          .includes(
            "Failed to load resource: the server responded with a status of 404",
          )
      )
    )
      violations.push(m.text());
  });
  if (!hosted)
    await page.route("http://localhost:4174/**", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "Content-Security-Policy": csp,
        },
      });
    });
  const home = await page.goto("./");
  expect(home?.status()).toBe(200);
  await expect(page.locator("article")).toHaveCount(20, { timeout: 20000 });
  const response = await page.goto("jokes/1");
  expect(response?.status()).toBe(pages ? 404 : 200);
  if (pages)
    await expect(
      page.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveAttribute("content", /default-src 'self'/);
  await expect(page.getByRole("heading", { name: "Анекдот №1" })).toBeVisible({
    timeout: 20000,
  });
  expect(
    await page
      .locator("article")
      .evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("Literata");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Анекдот №1" })).toBeVisible({
    timeout: 20000,
  });
  await page.goto("500");
  await expect(
    page.getByRole("heading", { name: "Не удалось загрузить данные" }),
  ).toBeVisible();
  // Lazy chunk under the same CSP.
  await page.goto("atlas");
  await expect(
    page.getByRole("heading", { name: "Атлас в разработке" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});
