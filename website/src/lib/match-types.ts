/** Match fields shared by public views and standings calculations. */
export type MatchLite = {
  id: number
  season_id?: number | null
  category?: string | null
  home_team_id: number
  away_team_id: number
  title?: string | null
  venue?: string | null
  match_date?: string | null
  start_time?: string | null
  revised_target_runs?: number | null
  toss_info?: string | null
  status?: string
  cover_image_url?: string | null
  result?: {
    batting_first_team_id?: number | null
    home_allotted_overs?: string | number | null
    away_allotted_overs?: string | number | null
    winning_team_id?: number | null
    margin_text?: string | null
    score_summary?: string | null
    innings_breakdown?: string | null
    player_of_match_player_id?: number | null
    outcome?: string | null
    result_status?: string | null
    nrr_excluded?: boolean
    home_extras_wides?: number
    home_extras_byes?: number
    home_extras_no_balls?: number
    home_extras_leg_byes?: number
    away_extras_wides?: number
    away_extras_byes?: number
    away_extras_no_balls?: number
    away_extras_leg_byes?: number
  } | null
  season?: {
    id: number
    league_id?: number
    name?: string
    slug?: string
    league?: { id: number; name: string; slug: string } | null
  } | null
  player_stats?: Array<Record<string, unknown>>
}
