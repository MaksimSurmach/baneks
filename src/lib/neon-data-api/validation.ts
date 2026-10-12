import type { Joke, Term } from "./types";
import { DataApiError } from "./errors";
function invalid(): never {
  throw new DataApiError("invalid-data");
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  return value as Record<string, unknown>;
}
export function id(value: unknown): number {
  const n =
    typeof value === "string" && /^[1-9]\d*$/.test(value)
      ? Number(value)
      : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 1)
    return invalid();
  return n;
}
export function joke(value: unknown): Joke {
  const v = object(value);
  if (
    typeof v.body !== "string" ||
    !v.body.trim() ||
    typeof v.language !== "string" ||
    !Array.isArray(v.term_ids)
  )
    return invalid();
  if (
    v.catalog_rating !== null &&
    (typeof v.catalog_rating !== "number" || !Number.isFinite(v.catalog_rating))
  )
    return invalid();
  return {
    id: id(v.id),
    body: v.body,
    language: v.language,
    catalog_rating: v.catalog_rating as number | null,
    term_ids: v.term_ids.map(id),
  };
}
export function term(value: unknown): Term {
  const v = object(value);
  if (
    !["topic", "character", "format"].includes(String(v.kind)) ||
    typeof v.name !== "string" ||
    !v.name.trim() ||
    typeof v.slug !== "string" ||
    !v.slug
  )
    return invalid();
  return {
    id: id(v.id),
    kind: v.kind as Term["kind"],
    name: v.name,
    slug: v.slug,
  };
}
export function rows<T>(value: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(value)) return invalid();
  return value.map(parse);
}
export function countFromRange(range: string | null): number | null {
  if (!range) return null;
  const m = /^(?:\d+-\d+|\*)\/(\d+|\*)$/.exec(range);
  if (!m) return invalid();
  if (m[1] === "*") return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n >= 0 ? n : invalid();
}
