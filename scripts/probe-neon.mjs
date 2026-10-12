import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const base =
  process.env.VITE_NEON_DATA_API_URL ||
  "https://ep-proud-sound-baou4sxl.apirest.c-8.eu-central-1.aws.neon.tech/banksDB/rest/v1";
const browser = await chromium.launch({
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY, bypass: "localhost,127.0.0.1" }
    : undefined,
});
const page = await browser.newPage();
await page.goto("http://localhost:4173/atlas");
const results = await page.evaluate(async (base) => {
  const queries = [
    ["jokes", "select=id,body,language,catalog_rating,term_ids&limit=3"],
    ["terms", "select=id,kind,name,slug&limit=10"],
    [
      "rating",
      "select=id,catalog_rating&order=catalog_rating.desc.nullslast,id.asc&limit=3",
    ],
    ["array", "select=id,term_ids&term_ids=cs.%7B1%7D&limit=3"],
    [
      "combined",
      "select=id,term_ids&and=(or(term_ids.cs.%7B1%7D,term_ids.cs.%7B2%7D),or(term_ids.cs.%7B46%7D))&limit=3",
    ],
    ["null-rating", "select=id,catalog_rating&catalog_rating=is.null&limit=3"],
  ];
  const out = [];
  for (const [name, q] of queries) {
    try {
      const r = await fetch(
        `${base}/${name === "terms" ? "terms" : "jokes"}?${q}`,
        { headers: { Prefer: "count=exact" }, credentials: "omit" },
      );
      let value;
      try {
        value = await r.json();
      } catch {
        value = null;
      }
      out.push({
        name,
        status: r.status,
        corsReadable: true,
        count: r.headers.get("Content-Range"),
        rows: Array.isArray(value) ? value : null,
        errorCategory: Array.isArray(value)
          ? null
          : value?.message?.includes("authentication")
            ? "authentication-required"
            : "api-error",
      });
    } catch (e) {
      out.push({ name, corsReadable: false, error: e.name });
    }
  }
  return out;
}, base);
await fs.mkdir("../work", { recursive: true });
await fs.writeFile(
  "../work/neon-browser-probe.json",
  JSON.stringify({ origin: new URL(page.url()).origin, results }, null, 2),
);
console.log(
  JSON.stringify(
    results.map(({ rows, ...r }) => ({ ...r, rowCount: rows?.length ?? null })),
    null,
    2,
  ),
);
await browser.close();
if (results.some((r) => r.status !== 200)) process.exitCode = 1;
