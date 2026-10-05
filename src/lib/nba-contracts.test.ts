import { expectTypeOf, it } from "vitest";
import type * as Api from "./api";
import type * as Contracts from "./nba-contracts";

// The project typecheck checks these assertions; Vitest executes the test.
it("preserves all 18 api.ts public type exports", () => {
  expectTypeOf<Api.NbaTeam>().toEqualTypeOf<Contracts.NbaTeam>();
  expectTypeOf<Api.GameLeader>().toEqualTypeOf<Contracts.GameLeader>();
  expectTypeOf<Api.PointsLeader>().toEqualTypeOf<Contracts.PointsLeader>();
  expectTypeOf<Api.NbaGame>().toEqualTypeOf<Contracts.NbaGame>();
  expectTypeOf<Api.PlayerStats>().toEqualTypeOf<Contracts.PlayerStats>();
  expectTypeOf<Api.PeriodScore>().toEqualTypeOf<Contracts.PeriodScore>();
  expectTypeOf<Api.BoxScoreTeam>().toEqualTypeOf<Contracts.BoxScoreTeam>();
  expectTypeOf<Api.BoxScore>().toEqualTypeOf<Contracts.BoxScore>();
  expectTypeOf<Api.ShotAction>().toEqualTypeOf<Contracts.ShotAction>();
  expectTypeOf<Api.ScoringShot>().toEqualTypeOf<Contracts.ScoringShot>();
  expectTypeOf<Api.PlayByPlaySnapshot>().toEqualTypeOf<Contracts.PlayByPlaySnapshot>();
  expectTypeOf<Api.ScheduleGame>().toEqualTypeOf<Contracts.ScheduleGame>();
  expectTypeOf<Api.ScheduleDate>().toEqualTypeOf<Contracts.ScheduleDate>();
  expectTypeOf<Api.RawScheduleTeam>().toEqualTypeOf<Contracts.RawScheduleTeam>();
  expectTypeOf<Api.RawScheduleGame>().toEqualTypeOf<Contracts.RawScheduleGame>();
  expectTypeOf<Api.RawScheduleDate>().toEqualTypeOf<Contracts.RawScheduleDate>();
  expectTypeOf<Api.PlayerInfo>().toEqualTypeOf<Contracts.PlayerInfo>();
  expectTypeOf<Api.PlayerIndexSnapshot>().toEqualTypeOf<Contracts.PlayerIndexSnapshot>();
});
