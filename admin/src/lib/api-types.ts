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
  coach?: string | null
  manager?: string | null
  history?: string | null
  trophies?: string[] | null
  team_photo_urls?: string[] | null
  status: string
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
  /** Career totals from player record (may differ from scorecard row count until synced). */
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
  margin_text: string | null
  score_summary: string | null
  innings_breakdown: string | null
  top_performers: string | null
  player_of_match_player_id: number | null
  result_status: string
  match_report: string | null
}

export type MatchPlayerStatDto = {
  id: number
  match_id: number
  player_id: number
  team_id: number
  lineup_order: number
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

/** Body for GET/PATCH /admin/about (excludes `updated_at` in PATCH). */
export type AboutContentBodyDto = {
  mission: string
  vision: string
  history: string
  team: AboutTeamMemberDto[]
  contacts: AboutContactsDto
  physical_address: string
}

export type AboutContentDto = AboutContentBodyDto & {
  updated_at: string
}

export type SponsorDto = {
  id: number
  name: string
  image_url: string
  team_id: number | null
  team_name: string | null
  created_at: string
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
