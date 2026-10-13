import { DataApiError } from "./errors";
import type { TermKind } from "./types";
export type Filters = Partial<Record<TermKind, number[]>>;
export const SORTS = ["id", "rating"] as const;
export type Sort = (typeof SORTS)[number];
export type CatalogQuery = {
  page: number;
  size?: number;
  sort: Sort;
  filters: Filters;
};
export const PAGE_SIZE = 20;
// Data API row cap per request.
export const MAX_ROWS = 100;
const MAX_PAGE = 1000000;
export const kinds: TermKind[] = ["topic", "character", "format"];
export function validId(v: number) {
  return Number.isSafeInteger(v) && v > 0;
}
export function parseId(raw: string): number | undefined {
  const n = Number(raw);
  return /^[1-9]\d*$/.test(raw) && validId(n) ? n : undefined;
}
const isSort = (v: string): v is Sort =>
  (SORTS as readonly string[]).includes(v);
const unique = (ids: number[]) => [...new Set(ids)].sort((a, b) => a - b);
export function applyFilters(params: URLSearchParams, filters: Filters) {
  const groups = kinds
    .map((k) => unique(filters[k] ?? []))
    .filter((ids) => ids.length);
  if (
    groups.some((ids) => ids.length > MAX_ROWS || ids.some((v) => !validId(v)))
  )
    throw new DataApiError("bad-request", 400);
  if (groups.length)
    params.set(
      "and",
      "(" +
        groups
          .map(
            (ids) =>
              "or(" + ids.map((v) => `term_ids.cs.{${v}}`).join(",") + ")",
          )
          .join(",") +
        ")",
    );
}
export function buildQuery(q: CatalogQuery) {
  const size = q.size ?? PAGE_SIZE;
  if (
    !validId(q.page) ||
    q.page > MAX_PAGE ||
    !validId(size) ||
    size > MAX_ROWS ||
    !isSort(q.sort)
  )
    throw new DataApiError("bad-request", 400);
  const params = new URLSearchParams({
    select: "id,body,language,catalog_rating,term_ids",
    order:
      q.sort === "rating" ? "catalog_rating.desc.nullslast,id.asc" : "id.asc",
    limit: String(Math.min(size + 1, MAX_ROWS)),
    offset: String((q.page - 1) * size),
  });
  applyFilters(params, q.filters);
  return params;
}
export function readQuery(params: URLSearchParams): CatalogQuery {
  const page = parseId(params.get("page") ?? "1"),
    sort = params.get("sort") ?? "id";
  if (!page || page > MAX_PAGE || !isSort(sort))
    throw new DataApiError("bad-request", 400);
  const filters: Filters = {};
  for (const k of kinds) {
    const raw = params.get(k);
    if (raw === null) continue;
    const parsed = raw.split(",").map(parseId);
    if (parsed.some((v) => v === undefined))
      throw new DataApiError("bad-request", 400);
    const ids = unique(parsed as number[]);
    if (ids.length > MAX_ROWS) throw new DataApiError("bad-request", 400);
    filters[k] = ids;
  }
  return { page, sort, filters };
}
export function writeQuery(q: CatalogQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.page !== 1) p.set("page", String(q.page));
  if (q.sort !== "id") p.set("sort", q.sort);
  for (const k of kinds)
    if (q.filters[k]?.length) p.set(k, unique(q.filters[k]).join(","));
  return p;
}
