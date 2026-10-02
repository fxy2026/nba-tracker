/** Search matching only: never rewrite displayed names, IDs or archive identity. */
export function normalizePlayerSearchText(value:string):string{
 return value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/\s+/gu,' ');
}
