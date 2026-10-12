import { test, expect } from "@playwright/test";
test("production bundle reads live Neon, filters, rating, random and hidden ID", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20, { timeout: 20000 });
  await expect(page.getByText(/опубликованных анекдотов$/)).toBeVisible();
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
  await page.goto("/jokes/101");
  await expect(
    page.getByRole("heading", { name: "Страница не найдена" }),
  ).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

test("production bundle remains functional under shipped CSP and deep-link HTTP is 200", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") violations.push(m.text());
  });
  await page.route("http://localhost:4174/**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.neon.tech; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
      },
    });
  });
  const response = await page.goto("/jokes/1");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Анекдот №1" })).toBeVisible({
    timeout: 20000,
  });
  expect(
    await page
      .locator("article")
      .evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("Literata");
  await page.goto("/500");
  await expect(
    page.getByRole("heading", { name: "Не удалось загрузить данные" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});
