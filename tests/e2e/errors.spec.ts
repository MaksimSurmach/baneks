import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi, jokes } from "./fixtures";
const statuses: [[number, string], ...[number, string][]] = [
  [400, "Некорректный запрос"],
  [401, "Нет доступа к каталогу"],
  [403, "Нет доступа к каталогу"],
  [404, "Страница не найдена"],
  [408, "Не удалось дождаться ответа"],
  [429, "Слишком много запросов"],
  [500, "Не удалось загрузить данные"],
  [502, "Сервис временно недоступен"],
  [503, "Сервис временно недоступен"],
  [504, "Сервис временно недоступен"],
];
test.beforeEach(async ({ page }) => mockApi(page));
for (const [status, title] of statuses)
  test(`HTTP ${status} distinct error, retry restores original filters`, async ({
    page,
  }) => {
    let fail = true;
    await page.route("**/rest/v1/jokes?**", (r) =>
      fail
        ? r.fulfill({ status, body: "private SQL stack password" })
        : r.fallback(),
    );
    await page.goto("/jokes?topic=1&sort=rating");
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("private SQL stack password")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Здесь пока тихо" }),
    ).toHaveCount(0);
    fail = false;
    const retry = page.getByRole("button", { name: "Повторить", exact: true });
    if (status === 400 || status === 404) {
      // Repeating the same request cannot help; recovery is navigation.
      await expect(retry).toHaveCount(0);
      await page.getByRole("link", { name: "В каталог" }).click();
      await expect(page.locator("article")).toHaveCount(20);
      return;
    }
    await retry.click();
    await expect(page.locator("article")).toHaveCount(20);
    await expect(page).toHaveURL(/topic=1&sort=rating/);
  });
test("expired token (401) is refreshed once without an error page", async ({
  page,
}) => {
  let tokens = 0,
    rejected = 0;
  await page.route("**/auth/token/anonymous", (r) =>
    r.fulfill({
      json: {
        token: `anonymous.test.token${++tokens}`,
        expires_at: Math.floor(Date.now() / 1000) + 900,
      },
    }),
  );
  await page.route("**/rest/v1/jokes?**", (r) => {
    if (r.request().headers().authorization?.endsWith("token1")) {
      rejected++;
      return r.fulfill({
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    return r.fallback();
  });
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20);
  expect(rejected).toBeGreaterThan(0);
  expect(tokens).toBe(2);
});
test("429 Retry-After pauses retry without automated requests", async ({
  page,
}) => {
  let fail = true,
    calls = 0;
  await page.route("**/rest/v1/jokes?**", (r) => {
    calls++;
    return fail
      ? r.fulfill({
          status: 429,
          headers: {
            "Retry-After": "2",
            "Access-Control-Expose-Headers": "Retry-After",
            "Access-Control-Allow-Origin": "*",
          },
          body: "rate",
        })
      : r.fallback();
  });
  await page.goto("/jokes");
  const button = page.getByRole("button", { name: "Повторить", exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toBeEnabled({ timeout: 4000 });
  const before = calls;
  fail = false;
  await button.click();
  await expect(page.locator("article")).toHaveCount(20);
  expect(calls).toBe(before + 1);
});
test("malformed JSON and unexpected shape use safe data page", async ({
  page,
}) => {
  let kind = 0;
  await page.route("**/rest/v1/jokes?**", (r) =>
    kind === 0
      ? r.fulfill({ body: "{broken", contentType: "application/json" })
      : kind === 1
        ? r.fulfill({ json: { unexpected: "private" } })
        : r.fallback(),
  );
  await page.goto("/jokes");
  await expect(
    page.getByRole("heading", { name: "Не удалось прочитать данные каталога" }),
  ).toBeVisible();
  kind = 1;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Не удалось прочитать данные каталога" }),
  ).toBeVisible();
  kind = 2;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(20);
});
test("unresponsive request times out then recovers", async ({ page }, info) => {
  test.setTimeout(25000);
  let fail = true,
    release!: () => void;
  const stalled = new Promise<void>((r) => (release = r));
  await page.route("**/rest/v1/jokes?**", async (r) => {
    if (!fail) return r.fallback();
    await stalled;
    await r.abort().catch(() => {});
  });
  await page.goto("/jokes");
  await expect(
    page.getByRole("heading", { name: "Не удалось дождаться ответа" }),
  ).toBeVisible({ timeout: 14000 });
  await page.screenshot({ path: info.outputPath("timeout-1440.png") });
  fail = false;
  release();
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(20);
});
test("offline is distinct from unknown transport failure and recovers", async ({
  page,
  context,
}, info) => {
  let failed = false;
  await page.route("**/rest/v1/jokes?**", (r) =>
    failed ? r.abort("internetdisconnected") : r.fallback(),
  );
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20);
  failed = true;
  await context.setOffline(true);
  await page
    .getByRole("combobox", { name: "Сортировка" })
    .selectOption("rating");
  await expect(
    page.getByRole("heading", { name: "Нет подключения к интернету" }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("offline-1440.png") });
  await context.setOffline(false);
  failed = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(20);
  failed = true;
  await page.getByRole("combobox", { name: "Сортировка" }).selectOption("id");
  await expect(
    page.getByRole("heading", { name: "Не удалось подключиться к каталогу" }),
  ).toBeVisible();
});
test("auxiliary taxonomy failure preserves reading and has separate retry", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/rest/v1/terms?**", (r) =>
    fail ? r.fulfill({ status: 503, body: "maintenance" }) : r.fallback(),
  );
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20);
  await expect(
    page
      .locator("aside")
      .getByText("Рубрики пока недоступны. Анекдоты можно читать."),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Повторить загрузку рубрик" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Работа", exact: true }),
  ).toBeVisible();
});
test("cancelled stale filter response cannot overwrite newer selection", async ({
  page,
}) => {
  let release!: () => void,
    stale = 0,
    aborted = 0,
    answered = 0;
  const delay = new Promise<void>((r) => (release = r));
  const isStale = (url: string) =>
    new URL(url).searchParams.get("and")?.includes("{1}");
  page.on("requestfailed", (r) => {
    if (isStale(r.url())) aborted++;
  });
  await page.route("**/rest/v1/jokes?**", async (r) => {
    if (isStale(r.request().url())) {
      stale++;
      await delay;
      await r
        .fulfill({
          json: jokes.slice(0, 20),
          headers: {
            "Content-Range": "0-19/35",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Range",
          },
        })
        .catch(() => {});
      answered++;
    } else await r.fallback();
  });
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20);
  await page.getByRole("checkbox", { name: "Работа", exact: true }).check();
  await page.getByRole("checkbox", { name: "Семья", exact: true }).check();
  await page.getByRole("checkbox", { name: "Работа", exact: true }).uncheck();
  await expect(page.getByText("10 опубликованных анекдотов")).toBeVisible();
  await expect.poll(() => aborted).toBe(stale);
  release();
  // Wait until the stale responses were actually delivered, then let React run.
  await expect.poll(() => answered).toBe(stale);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
  await expect(page.locator("article")).toHaveCount(10);
  await expect(page.getByText("10 опубликованных анекдотов")).toBeVisible();
  await expect(page.locator("article").first()).toHaveAttribute(
    "aria-label",
    "Анекдот №36",
  );
});
test("long dialogue and HTML-like text stay escaped, full text is readable", async ({
  page,
}) => {
  const body =
    "Длинный абзац. «Кавычки» & <script>window.XSS=true</script>\n— Диалог.\n\n".repeat(
      90,
    );
  await page.route("**/rest/v1/jokes?**", (r) =>
    r.fulfill({
      json: [{ ...jokes[0], body }],
      headers: { "Content-Range": "0-0/1" },
    }),
  );
  await page.goto("/jokes");
  await expect(
    page.getByRole("link", { name: "Читать полностью →" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Читать полностью →" }).click();
  await expect(page.locator("article")).toHaveText(body);
  expect(
    await page.evaluate(() =>
      Object.prototype.hasOwnProperty.call(window, "XSS"),
    ),
  ).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("clipboard works; missing browser API offers manual recovery", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/jokes/1");
  await page.getByRole("button", { name: "Копировать текст" }).click();
  await expect(page.getByRole("status")).toHaveText("Скопировано");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    jokes[0].body,
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Копировать текст" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Выделите и скопируйте текст вручную",
  );
});
test("sharing falls back to canonical URL clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/jokes/2");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.getByRole("button", { name: "Поделиться" }).click();
  await expect(page.getByRole("status")).toHaveText("Скопировано");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    page.url(),
  );
});
test("invalid URL values fail before request and reset restores catalogue", async ({
  page,
}) => {
  await page.goto("/jokes?topic=oops&page=-1");
  await expect(
    page.getByRole("heading", { name: "Некорректный запрос" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await expect(page.locator("article")).toHaveCount(20);
  await page.goto("/jokes/nope");
  await expect(
    page.getByRole("heading", { name: "Некорректный запрос" }),
  ).toBeVisible();
});
for (const width of [1440, 390])
  test(`error screenshots and accessibility ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [route, title] of [
      ["400", "Некорректный запрос"],
      ["404", "Страница не найдена"],
      ["429", "Слишком много запросов"],
      ["500", "Не удалось загрузить данные"],
      ["503", "Сервис временно недоступен"],
      ["offline", "Нет подключения к интернету"],
      ["timeout", "Не удалось дождаться ответа"],
      ["data-error", "Не удалось прочитать данные каталога"],
    ]) {
      await page.goto("/" + route);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: info.outputPath(`${route}-${width}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
for (const width of [1440, 768, 390])
  test(`catalogue accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/jokes");
    await expect(page.locator("article")).toHaveCount(20);
    let results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    if (width <= 900) {
      await page.getByRole("button", { name: "Фильтры", exact: true }).click();
      results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    }
  });

test("return to results restores reading position and filters do not jump to hero", async ({
  page,
}) => {
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20);
  await page.mouse.wheel(0, 950);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(800);
  const saved = await page.evaluate(() => window.scrollY);
  await page.locator("article").nth(4).getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Анекдот №5" })).toBeVisible();
  await page.getByRole("link", { name: "← Вернуться к результатам" }).click();
  await expect(page.locator("article")).toHaveCount(20);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(saved - 100);
  await page.mouse.wheel(0, -350);
  await page.getByRole("checkbox", { name: "Работа", exact: true }).check();
  await expect(page.getByText("35 опубликованных анекдотов")).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});
test("next page from the bottom starts at the top of the new list", async ({
  page,
}) => {
  await page.goto("/jokes");
  await expect(page.locator("article")).toHaveCount(20);
  const next = page.getByRole("button", { name: "Следующая →" });
  await next.scrollIntoViewIfNeeded();
  await next.click();
  await expect(page.locator("article").first()).toHaveAttribute(
    "aria-label",
    "Анекдот №21",
  );
  // The results heading is in view: not the bottom, not wherever loading clamped.
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Банк анекдотов категории Б",
  });
  await expect
    .poll(() => heading.evaluate((e) => e.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(0);
  await expect(heading).toBeInViewport();
});
