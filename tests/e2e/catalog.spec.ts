import { test, expect } from "@playwright/test";
import { mockApi } from "./fixtures";
test.beforeEach(async ({ page }) => mockApi(page));
test("home, catalogue, full joke and return preserve URL", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("45 опубликованных анекдотов")).toBeVisible();
  await page.locator("article").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/jokes\/1$/);
  await expect(page.getByRole("heading", { name: "Анекдот №1" })).toBeVisible();
  await expect(page.getByText("Без оценки", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← Вернуться к результатам" }).click();
  await expect(page).toHaveURL(/\/jokes$/);
});
test("topic, second page, reload and reset", async ({ page }) => {
  await page.goto("/jokes");
  await page.getByRole("checkbox", { name: "Работа", exact: true }).check();
  await expect(page).toHaveURL(/topic=1/);
  await expect(page.getByText("35 опубликованных анекдотов")).toBeVisible();
  await page.getByRole("button", { name: "Следующая →", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("article").first()).toHaveAttribute(
    "aria-label",
    "Анекдот №21",
  );
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Работа", exact: true }),
  ).toBeChecked();
  await expect(page.locator("article")).toHaveCount(15);
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await expect(page).toHaveURL(/\/jokes$/);
  await expect(page.getByText("45 опубликованных анекдотов")).toBeVisible();
});
test("character and format combine with topic, URL back restores", async ({
  page,
}) => {
  await page.goto("/jokes");
  await page.getByRole("checkbox", { name: "Работа", exact: true }).check();
  await page.locator("aside summary").filter({ hasText: "Персонажи" }).click();
  await page.getByRole("checkbox", { name: "Штирлиц", exact: true }).check();
  await page.locator("aside summary").filter({ hasText: "Формат" }).click();
  await page.getByRole("checkbox", { name: "Диалог", exact: true }).check();
  await expect(page).toHaveURL(/character=2/);
  await expect(page).toHaveURL(/format=3/);
  await expect(page.locator("article")).toHaveCount(20);
  await page.goBack();
  await expect(
    page.getByRole("checkbox", { name: "Диалог", exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Штирлиц", exact: true }),
  ).toBeChecked();
});
test("rating desc is stable and null last", async ({ page }) => {
  await page.goto("/jokes");
  await page
    .getByRole("combobox", { name: "Сортировка" })
    .selectOption("rating");
  await expect(page).toHaveURL(/sort=rating/);
  await expect(page.locator("article").first()).toHaveAttribute(
    "aria-label",
    "Анекдот №6",
  );
  await page.getByRole("button", { name: "Страница 3", exact: true }).click();
  await expect(
    page.locator("article").first().getByText("Без оценки"),
  ).toBeVisible();
});
test("random then next is a published choice without immediate repeat", async ({
  page,
}) => {
  await page.goto("/jokes?topic=1");
  await page.getByRole("button", { name: "Случайный анекдот →" }).click();
  await expect(page.getByRole("heading", { name: /Анекдот №/ })).toBeVisible();
  const previous = page.url();
  await page.getByRole("button", { name: "Ещё случайный →" }).click();
  await expect(page.getByRole("heading", { name: /Анекдот №/ })).toBeVisible();
  await expect(page).not.toHaveURL(previous);
  await page.getByRole("link", { name: "← Вернуться к результатам" }).click();
  await expect(page).toHaveURL(/topic=1/);
});
test("direct joke URL and missing published ID", async ({ page }) => {
  await page.goto("/jokes/2");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Анекдот №2" })).toBeVisible();
  await page.goto("/jokes/9999");
  await expect(
    page.getByRole("heading", { name: "Страница не найдена" }),
  ).toBeVisible();
});
test("empty category differs from request failure", async ({ page }) => {
  await page.goto("/topics/topic/empty");
  await expect(page).toHaveURL(/topic=9/);
  await expect(
    page.getByRole("heading", { name: "Здесь пока тихо" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
  await page.getByRole("button", { name: "Сбросить фильтры" }).last().click();
  await expect(page.locator("article")).toHaveCount(20);
});
test("mobile dialog traps focus and Escape restores trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jokes");
  const trigger = page.getByRole("button", { name: /^Фильтры/ });
  await trigger.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("checkbox", { name: "Работа", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByText("35 опубликованных анекдотов")).toBeVisible();
});
test("broken artwork retains brand and navigation", async ({ page }) => {
  await page.route("**/hero-wide.webp", (r) => r.abort());
  await page.goto("/jokes");
  await expect(
    page.getByRole("link", { name: "Банк анекдотов категории Б", exact: true }),
  ).toBeVisible();
  await expect(page.locator("header")).toHaveCSS("height", "180px");
  await page.getByRole("link", { name: "Атлас", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Атлас в разработке" }),
  ).toBeVisible();
});
