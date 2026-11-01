import { createContext, useContext } from "react";
import type { Term } from "../../lib/neon-data-api/types";
import type { RequestState } from "../../lib/useRequest";
export const TaxonomyContext = createContext<
  (RequestState<Term[]> & { retry: () => void }) | null
>(null);
export function useTaxonomy() {
  const context = useContext(TaxonomyContext);
  if (!context) throw new Error("Missing taxonomy");
  return context;
}
