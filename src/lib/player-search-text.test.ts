import {expect,it} from 'vitest';
import {normalizePlayerSearchText as normalize} from './player-search-text';
it.each([['Jokić','Jokic'],['Dončić','Doncic'],['Schröder','Schroder'],['Vučević','Vucevic'],['Jokic\u0301','Jokić']])('search equivalence %s/%s', (a,b)=>{expect(normalize(a)).toBe(normalize(b));});
it('case and whitespace fold without changing Chinese aliases or guessing identity',()=>{expect(normalize('  NIKOLA   Jokić ')).toBe('nikola jokic');expect(normalize('约老师')).toBe('约老师');expect(normalize('Jokić')).not.toBe(normalize('Jović'));expect(normalize('Drew Doughty')).not.toBe(normalize('Jrue Holiday'));});
