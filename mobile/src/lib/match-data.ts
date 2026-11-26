import type { Fixture } from './feed'
import { usePublic } from './public-resource'

export type MatchStat = {
  id: number; player_id: number; team_id: number; batting_order?: number | null; bowling_order?: number | null
  runs: number; balls_faced: number; fours: number; sixes: number; dismissal: string | null
  overs: string | number | null; maidens: number; runs_conceded: number; wickets: number
}
export type MatchDetail = Fixture & {
  player_stats: MatchStat[]; toss_info?: string | null; description?: string | null; stream_available?: boolean; stream_label?: string | null
  result?: NonNullable<Fixture['result']> & { batting_first_team_id?: number | null; match_report?: string | null; top_performers?: string | null; innings_breakdown?: string | null }
}
export type Innings = { innings: number; batting_team_id: number; bowling_team_id: number; runs: number; wickets: number; overs_label: string; legal_balls?: number; last_six: string[] }
export type MatchBall = {
  id: number; innings: number; sequence_number: number; over_number: number; ball_number: number;
  striker_player_id?: number; bowler_player_id?: number; runs_batter: number; runs_extras: number;
  extras_type?: string | null; wicket_type?: string | null; dismissal_text?: string | null; commentary?: string | null;
}
export type LiveMatch = {
  current_innings?: number | null; status: string; summaries: Innings[]; events: MatchBall[]
  match_overs?: number | string | null; revised_target_runs?: number | null
}

export function useLiveMatch(id: number | null, live: boolean) {
  return usePublic<LiveMatch>(id ? '/matches/' + id + '/live' : null, { maxAge: live ? 8_000 : 60_000, poll: live ? 8_000 : undefined, persist: false })
}
