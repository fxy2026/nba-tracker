import { expect, it } from "vitest";
import { directoryFilter, matchesDirectoryPosition } from "./player-directory-filter";
it.each([undefined, 'G', 'F-G'])("valid/missing position %s", raw => {
  expect(directoryFilter(raw, ['G', 'G-F'], true)).toEqual({value: raw === undefined ? null : raw === 'G' ? 'G' : 'G-F', invalid:false});
});
it.each(['', 'PF', 'G-G', '<script>', 'javascript:foo', ['G'], ['G','F']])("invalid/repeated position %j", raw => {expect(directoryFilter(raw, ['G','F'], true)).toEqual({value:null,invalid:true});});
it("hybrid order matches but does not broaden to all guards or forwards",()=>{expect(matchesDirectoryPosition('F-G','G-F')).toBe(true);expect(matchesDirectoryPosition('G','G-F')).toBe(false);expect(matchesDirectoryPosition('F-C','F')).toBe(false);});
it.each(['country','year'])("strict available %s values",type=>{const value=type==='country'?"Côte d'Ivoire":'2003';expect(directoryFilter(value,[value])).toEqual({value,invalid:false});for(const raw of ['missing', '', [value], [value,value]])expect(directoryFilter(raw,[value])).toEqual({value:null,invalid:true});expect(directoryFilter(undefined,[value])).toEqual({value:null,invalid:false});});
it("URL parsing supplies decoded countries exactly once",()=>{const country="Côte d'Ivoire";const raw=new URLSearchParams(`country=${encodeURIComponent(country)}`).get('country')!;expect(directoryFilter(raw,[country]).value).toBe(country);expect(directoryFilter(encodeURIComponent(country),[country]).invalid).toBe(true);});
