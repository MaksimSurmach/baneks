import { DataApiError } from './errors'
import type { TermKind } from './types'
export type Filters = Partial<Record<TermKind, number[]>>
export type Sort = 'id' | 'rating'
export type CatalogQuery = { page: number; size?: number; sort: Sort; filters: Filters }
export const kinds: TermKind[] = ['topic','character','format']
export function validId(v: number) { return Number.isSafeInteger(v) && v > 0 }
export function applyFilters(params: URLSearchParams, filters: Filters) {
 const groups = kinds.map(k => [...new Set(filters[k] ?? [])].sort((a,b)=>a-b)).filter(ids=>ids.length);
 if (groups.some(ids => ids.length > 100 || ids.some(v => !validId(v)))) throw new DataApiError('bad-request',400);
 if (groups.length) params.set('and', '(' + groups.map(ids => 'or(' + ids.map(v => `term_ids.cs.{${v}}`).join(',') + ')').join(',') + ')');
}
export function buildQuery(q: CatalogQuery) {
 const size = q.size ?? 20; if (!validId(q.page) || q.page > 1000000 || !validId(size) || size > 100 || !['id','rating'].includes(q.sort)) throw new DataApiError('bad-request',400);
 const params = new URLSearchParams({select:'id,body,language,catalog_rating,term_ids',order:q.sort === 'rating' ? 'catalog_rating.desc.nullslast,id.asc' : 'id.asc',limit:String(Math.min(size+1,100)),offset:String((q.page-1)*size)}); applyFilters(params,q.filters); return params;
}
export function readQuery(params: URLSearchParams): CatalogQuery {
 const rawPage=params.get('page') ?? '1', sort=params.get('sort') ?? 'id';
 if (!/^[1-9]\d*$/.test(rawPage) || Number(rawPage)>1000000 || !['id','rating'].includes(sort)) throw new DataApiError('bad-request',400);
 const filters: Filters={}; for (const k of kinds) { const raw=params.get(k); if (raw !== null) { if (!/^[1-9]\d*(,[1-9]\d*)*$/.test(raw)) throw new DataApiError('bad-request',400); const ids=raw.split(',').map(Number); if (ids.length>100 || ids.some(v=>!validId(v))) throw new DataApiError('bad-request',400); filters[k]=[...new Set(ids)].sort((a,b)=>a-b) } }
 return {page:Number(rawPage),sort:sort as Sort,filters};
}
export function writeQuery(q: CatalogQuery): URLSearchParams { const p=new URLSearchParams(); if(q.page!==1)p.set('page',String(q.page)); if(q.sort!=='id')p.set('sort',q.sort); for(const k of kinds)if(q.filters[k]?.length)p.set(k,[...new Set(q.filters[k])].sort((a,b)=>a-b).join(',')); return p }
