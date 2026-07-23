/** Shapes returned by `GET /api/v1/admin/…` (see FastAPI schemas). */

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export type TeamDto = {
  id: number
  name: string
  slug: string
  category: string
  short_name: string | null
  logo_url: string | null
  /** Hero / banner image when set (falls back to logo or default badge). */
  cover_image_url?: string | null
  home_ground: string | null
  home_ground_name?: string | null
  home_ground_location?: string | null
  home_ground_image_url?: string | null
  captain?: string | null
  captain_player_id?: number | null
  /** Populated on public GET /teams/{slug} from the captain player’s profile photo. */
  captain_profile_photo_url?: string | null
  coach?: string | null
  coach_image_url?: string | null
  manager?: string | null
  manager_image_url?: string | null
  history?: string | null
  trophies?: string[] | null
  team_photo_urls?: string[] | null
  status: string
  is_featured?: boolean
  featured_sort_order?: number | null
}

export type PlayerDto = {
  id: number
  full_name: string
  slug: string
  profile_photo_url: string | null
  team_id: number
  category: string
  jersey_number: number | null
  role: string | null
  status: string
  date_of_birth?: string | null
  nationality?: string | null
  batting_style?: string | null
  bowling_style?: string | null
  bio?: string | null
  debut_info?: string | null
  /** Career totals synced from completed-match scorecards. */
  matches_played?: number
  runs_scored?: number
  batting_average?: number | null
  strike_rate?: number | null
  highest_score?: number | null
  wickets_taken?: number
  bowling_average?: number | null
  economy_rate?: number | null
  best_bowling?: string | null
  catches?: number
  stumpings?: number
  run_outs?: number
  player_of_match_awards?: number
}

/** One scorecard appearance for a player (GET /admin/players/{id}/match-appearances). */
export type PlayerMatchAppearanceDto = {
  stat_id: number
  match_id: number
  match_date: string | null
  venue: string | null
  status: string
  home_team_id: number
  away_team_id: number
  home_team_name: string
  away_team_name: string
  league_name: string | null
  season_name: string | null
  season_id: number | null
  side_team_id: number
  player_of_match?: boolean
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string | null
  overs: number | null
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string | null
}

/** Long-lived competition (seasons are separate resources). */
export type LeagueDto = {
  id: number
  name: string
  slug: string
  description: string | null
  category: string
  logo_url: string | null
  banner_url: string | null
}

export type SeasonDto = {
  id: number
  league_id: number
  name: string
  slug: string
  start_date: string | null
  end_date: string | null
  status: string
  team_ids: number[]
}

export type LeagueBriefDto = {
  id: number
  name: string
  slug: string
}

export type SeasonBriefDto = {
  id: number
  league_id: number
  name: string
  slug: string
  league: LeagueBriefDto
}

export type MatchResultDto = {
  id: number
  match_id: number
  winning_team_id: number | null
  batting_first_team_id: number | null
  margin_text: string | null
  score_summary: string | null
  innings_breakdown: string | null
  top_performers: string | null
  player_of_match_player_id: number | null
  result_status: string
  match_report: string | null
  home_extras_wides?: number
  home_extras_byes?: number
  home_extras_no_balls?: number
  home_extras_leg_byes?: number
  away_extras_wides?: number
  away_extras_byes?: number
  away_extras_no_balls?: number
  away_extras_leg_byes?: number
  home_allotted_overs?: string | number | null
  away_allotted_overs?: string | number | null
}

export type MatchPlayerStatDto = {
  id: number
  match_id: number
  player_id: number
  team_id: number
  lineup_order: number
  batting_order: number | null
  bowling_order: number | null
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string | null
  overs: string | number | null
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string | null
}

/** Match detail as returned by admin/public match list & detail. */
export type MatchDto = {
  id: number
  season_id: number | null
  category: string
  home_team_id: number
  away_team_id: number
  title: string | null
  venue: string | null
  match_date: string | null
  start_time: string | null
  match_overs: string | number
  revised_target_runs?: number | null
  toss_info: string | null
  umpires: string | null
  status: string
  description: string | null
  cover_image_url: string | null
  season: SeasonBriefDto | null
  result: MatchResultDto | null
  /** Present on API responses after scorecard support; treat as [] if missing. */
  player_stats?: MatchPlayerStatDto[]
}

export type ArticleDto = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  featured_image_url: string | null
  body_image_url?: string | null
  author_name: string | null
  status: string
  category: string | null
  tags: string[] | null
  seo_title: string | null
  seo_description: string | null
  published_at: string | null
  related_entities: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type GalleryItemDto = {
  id: number
  title: string
  slug?: string | null
  description?: string | null
  media_type: string
  file_url: string
  thumbnail_url?: string | null
  status: string
  tags: string[] | null
  team_id?: number | null
  created_at: string
}

export type NotificationHookDto = {
  name: string
  url: string
}

export type AboutTeamMemberDto = {
  position: string
  picture_url: string
}

export type AboutContactsDto = {
  emails: string[]
  phone: string
}

export type AboutSocialLinksDto = {
  facebook: string
  instagram: string
  twitter: string
  youtube: string
}

/** Body for GET/PATCH /admin/about (excludes `updated_at` in PATCH). */
export type AboutContentBodyDto = {
  mission: string
  vision: string
  history: string
  team: AboutTeamMemberDto[]
  contacts: AboutContactsDto
  social_links: AboutSocialLinksDto
  physical_address: string
}

export type AboutContentDto = AboutContentBodyDto & {
  updated_at: string
}

export type SponsorDto = {
  id: number
  name: string
  image_url: string
  link_url: string | null
  team_id: number | null
  team_name: string | null
  created_at: string
}

export type ContactMessageDto = {
  id: number
  full_name: string
  email: string
  phone: string | null
  message: string
  created_at: string
  read_at: string | null
}

export type PlatformSettingsDto = {
  site_name: string
  default_season: string
  media_cdn_base_url: string
  feature_flags: Record<string, unknown>
  notification_hooks: NotificationHookDto[]
  updated_at: string
}

export type UserDto = {
  id: number
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

export type AuditLogDto = {
  id: number
  actor_user_id: number | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string
  summary: string | null
  created_at: string
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
  token_type: string
}

export type UserMe = {
  id: number
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
}

export type UserMePatch = {
  full_name?: string | null
  current_password?: string
  new_password?: string
}

export type MerchandiseProductDto = {
  id: number
  name: string
  description: string | null
  price_text: string
  image_url: string
  image_url_2: string
  sizes_text: string | null
  category: string
  audience: string
  team_id: number | null
  status: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type MerchandiseOrderDto = {
  id: number
  product_id: number | null
  product_name: string
  customer_name: string
  phone: string
  email: string | null
  size: string | null
  quantity: number
  notes: string | null
  status: string
  created_at: string
}


export type ScorerAssignmentDto = {
  id: number
  match_id: number
  user_id: number
  user_email: string
  user_full_name: string | null
  assigned_by_user_id: number | null
  created_at: string
}

export type MatchSquadRole = 'playing_xi' | 'substitute' | 'concussion_substitute'

export type MatchSquadPlayerDto = {
  id: number
  match_id: number
  team_id: number
  player_id: number
  role: MatchSquadRole
  lineup_order: number
  is_captain: boolean
  is_wicketkeeper: boolean
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export type MatchSquadTeamDto = {
  team_id: number
  players: MatchSquadPlayerDto[]
}

export type MatchSquadDto = {
  match_id: number
  teams: MatchSquadTeamDto[]
}

export type MatchSquadSaveInput = {
  teams: Array<{
    team_id: number
    players: Array<{
      player_id: number
      role: MatchSquadRole
      lineup_order?: number
      is_captain?: boolean
      is_wicketkeeper?: boolean
    }>
  }>
}


export type MatchLiveSetupInput = {
  toss_winner_team_id: number
  toss_decision: 'bat' | 'bowl'
  batting_first_team_id: number
  match_overs: string | number
  umpire_1?: string | null
  umpire_2?: string | null
  reserve_umpire?: string | null
}

export type LiveMatchConditionsInput = {
  match_overs?: string | number | null
  innings: number
  clear_dls?: boolean
}

export type LiveScoreCompleteInput = {
  status: 'completed' | 'abandoned' | 'cancelled'
  match_overs?: string | number | null
}

export type LiveBallEventDto = {
  id: number
  match_id: number
  innings: number
  over_number: number
  ball_number: number
  batting_team_id: number
  bowling_team_id: number
  striker_player_id: number
  non_striker_player_id: number | null
  bowler_player_id: number
  runs_batter: number
  runs_extras: number
  extras_type: string | null
  is_legal_delivery: boolean
  completed_runs: number
  boundary_runs: number
  boundary_type: string | null
  penalty_runs_batting: number
  penalty_runs_fielding: number
  short_runs: number
  is_dead_ball: boolean
  wicket_type: string | null
  wicket_player_id: number | null
  fielder_player_id: number | null
  replacement_player_id: number | null
  wicket_end: 'striker' | 'non_striker' | null
  batters_crossed: boolean
  dismissal_text: string | null
  notes: string | null
  sequence_number: number
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export type LiveScoreInningsSummaryDto = {
  innings: number
  batting_team_id: number
  bowling_team_id: number
  runs: number
  wickets: number
  legal_balls: number
  overs_label: string
  last_six: string[]
  last_event: LiveBallEventDto | null
}

export type LiveScoreStateDto = {
  match_id: number
  status: string
  match_overs: string | number | null
  revised_target_runs: number | null
  dls_par_score: number | null
  current_innings: number | null
  summaries: LiveScoreInningsSummaryDto[]
  events: LiveBallEventDto[]
  undone_event: LiveBallEventDto | null
}

export type LiveBallEventInput = {
  innings: number
  over_number: number
  ball_number: number
  batting_team_id: number
  bowling_team_id: number
  striker_player_id: number
  non_striker_player_id?: number | null
  bowler_player_id: number
  runs_batter?: number
  runs_extras?: number
  extras_type?: string | null
  is_legal_delivery?: boolean
  completed_runs?: number
  boundary_runs?: number
  boundary_type?: string | null
  penalty_runs_batting?: number
  penalty_runs_fielding?: number
  short_runs?: number
  is_dead_ball?: boolean
  wicket_type?: string | null
  wicket_player_id?: number | null
  fielder_player_id?: number | null
  replacement_player_id?: number | null
  wicket_end?: 'striker' | 'non_striker' | null
  batters_crossed?: boolean
  dismissal_text?: string | null
  notes?: string | null
}
