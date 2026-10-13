import type { Term } from "./neon-data-api/types";
const formats: Record<string, string> = {
  one_liner: "Одной строкой",
  dialogue: "Диалог",
  story: "История",
  verse: "В стихах",
  other: "Другой формат",
};
export function termLabel(term: Term) {
  return term.kind === "format" ? (formats[term.slug] ?? term.name) : term.name;
}
