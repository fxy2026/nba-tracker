// Server-only archive boundary. Visitors never call the provider API.
import { isPlayerBoxQuarantined } from "./player-box-quarantine";
import archive from '@/data/provider-player-boxes.json';
import verified from '@/data/recovered-player-boxes.json';
import type { ScheduleGame } from './api';
import { validateProviderPlayerSnapshot } from './provider-player-snapshot';
export function getProviderPlayerBox(game:ScheduleGame){
 if(isPlayerBoxQuarantined(game.gameId)||game.gameStatus!==3||Object.hasOwn(verified,game.gameId)||!Object.hasOwn(archive,game.gameId))return null;
 const data=validateProviderPlayerSnapshot((archive as Record<string,unknown>)[game.gameId]);
 if(!data||data.game.nbaGameId!==game.gameId||data.game.home.tricode!==game.homeTeam.teamTricode||data.game.away.tricode!==game.awayTeam.teamTricode||data.game.home.score!==game.homeTeam.score||data.game.away.score!==game.awayTeam.score||data.game.gameDate.replaceAll('-','')!==game.gameCode.split('/')[0])return null;
 return data;
}
