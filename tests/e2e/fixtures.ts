import type { Page } from "@playwright/test";
export const terms = [
  { id: 1, kind: "topic", name: "Работа", slug: "work" },
  { id: 4, kind: "topic", name: "Семья", slug: "family" },
  { id: 5, kind: "topic", name: "Армия и война", slug: "army" },
  { id: 6, kind: "topic", name: "Алкоголь", slug: "alcohol" },
  { id: 7, kind: "topic", name: "Отношения", slug: "relations" },
  { id: 8, kind: "topic", name: "Медицина", slug: "medicine" },
  { id: 9, kind: "topic", name: "Пустая тема", slug: "empty" },
  { id: 2, kind: "character", name: "Штирлиц", slug: "shtirlitz" },
  { id: 3, kind: "format", name: "Диалог", slug: "dialog" },
];
export const jokes = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1,
  body:
    i === 0
      ? "— Доктор, у меня провалы в памяти.\n— И давно?\n— Что именно «давно»?"
      : i === 1
        ? "Штирлиц вошёл в комнату и увидел записку: «Я всё знаю».\nОн аккуратно сложил бумагу и подумал:\n— Теперь нас двое."
        : i === 2
          ? "— Почему вы всегда опаздываете?\n— Потому что на работе меня никто не ждёт.\n— А дома?\n— Дома тем более."
          : `История ${i + 1}.\n— Сначала история. Всё остальное — потом.`,
  language: "ru",
  catalog_rating: i % 3 === 0 ? null : 5 - (i % 5) * 0.3,
  term_ids: i < 35 ? [1, 2, 3] : [4, 3],
}));
export async function mockApi(page: Page) {
  await page.route("**/auth/token/anonymous", (r) =>
    r.fulfill({
      json: {
        token: "anonymous.test.token",
        expires_at: Math.floor(Date.now() / 1000) + 900,
      },
    }),
  );
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    let data = url.pathname.endsWith("/terms") ? [...terms] : [...jokes];
    if (url.pathname.endsWith("/jokes")) {
      let list = [...jokes];
      const id = url.searchParams.get("id");
      if (id?.startsWith("eq."))
        list = list.filter((j) => j.id === Number(id.slice(3)));
      if (id?.startsWith("not.in.")) {
        const excluded = id.slice(8, -1).split(",").map(Number);
        list = list.filter((j) => !excluded.includes(j.id));
      }
      const and = url.searchParams.get("and");
      if (and) {
        const groups = [...and.matchAll(/or\(([^)]*)\)/g)].map((m) =>
          [...m[1].matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])),
        );
        list = list.filter((j) =>
          groups.every((ids) => ids.some((id) => j.term_ids.includes(id))),
        );
      }
      if (url.searchParams.get("order")?.startsWith("catalog_rating"))
        list.sort((a, b) =>
          a.catalog_rating === null
            ? b.catalog_rating === null
              ? a.id - b.id
              : 1
            : b.catalog_rating === null
              ? -1
              : b.catalog_rating - a.catalog_rating || a.id - b.id,
        );
      data = list;
    }
    const total = data.length,
      offset = Number(url.searchParams.get("offset") ?? 0),
      limit = Number(url.searchParams.get("limit") ?? 100);
    const slice = data.slice(offset, offset + limit);
    await route.fulfill({
      json: slice,
      headers: {
        "Content-Range": slice.length
          ? `${offset}-${offset + slice.length - 1}/${total}`
          : `*/${total}`,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Range",
      },
    });
  });
}
