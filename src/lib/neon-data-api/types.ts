export type TermKind = 'topic' | 'character' | 'format'
export type Joke = { id: number; body: string; language: string; catalog_rating: number | null; term_ids: number[] }
export type Term = { id: number; kind: TermKind; name: string; slug: string }
