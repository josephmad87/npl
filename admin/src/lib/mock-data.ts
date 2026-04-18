export type Division = 'men' | 'women' | 'youth'

export type TeamRow = {
  id: string
  name: string
  slug: string
  division: Division
  shortName: string
  status: 'active' | 'inactive'
  homeGround: string
}

export type PlayerRow = {
  id: string
  fullName: string
  slug: string
  team: string
  division: Division
  role: string
  jersey: number
  status: 'active' | 'inactive' | 'injured'
}

export type LeagueRow = {
  id: string
  name: string
  slug: string
  division: Division
  season: string
  status: 'upcoming' | 'active' | 'completed' | 'archived'
  start: string
  end: string
}

export type MatchRow = {
  id: string
  league: string
  division: Division
  home: string
  away: string
  venue: string
  when: string
  status:
    | 'scheduled'
    | 'live'
    | 'completed'
    | 'postponed'
    | 'abandoned'
    | 'cancelled'
}

export type ArticleRow = {
  id: string
  title: string
  slug: string
  author: string
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  category: string
  updated: string
}

export type GalleryRow = {
  id: string
  title: string
  type: 'image' | 'video'
  status: 'draft' | 'published'
  tags: string
  updated: string
}

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  lastLogin: string
}

export type AuditRow = {
  id: string
  actor: string
  action: string
  entity: string
  entityId: string
  at: string
  summary: string
}

export const MOCK_TEAMS: TeamRow[] = [
  {
    id: 't1',
    name: 'Harare Hurricanes',
    slug: 'harare-hurricanes',
    division: 'men',
    shortName: 'HH',
    status: 'active',
    homeGround: 'Harare Sports Club',
  },
  {
    id: 't2',
    name: 'Bulawayo Blaze',
    slug: 'bulawayo-blaze',
    division: 'men',
    shortName: 'BB',
    status: 'active',
    homeGround: 'Queens Sports Club',
  },
  {
    id: 't3',
    name: 'Mutare Maidens',
    slug: 'mutare-maidens',
    division: 'women',
    shortName: 'MM',
    status: 'active',
    homeGround: 'Mutare Sports Club',
  },
  {
    id: 't4',
    name: 'Kwekwe Colts',
    slug: 'kwekwe-colts',
    division: 'youth',
    shortName: 'KC',
    status: 'inactive',
    homeGround: 'Kwekwe Sports Club',
  },
]

export const MOCK_PLAYERS: PlayerRow[] = [
  {
    id: 'p1',
    fullName: 'Tinashe Kamunhukamwe',
    slug: 'tinashe-kamunhukamwe',
    team: 'Harare Hurricanes',
    division: 'men',
    role: 'Batsman',
    jersey: 7,
    status: 'active',
  },
  {
    id: 'p2',
    fullName: 'Wessly Madhevere',
    slug: 'wessly-madhevere',
    team: 'Harare Hurricanes',
    division: 'men',
    role: 'All-rounder',
    jersey: 3,
    status: 'active',
  },
  {
    id: 'p3',
    fullName: 'Chipo Mugeri-Tiripano',
    slug: 'chipo-mugeri-tiripano',
    team: 'Mutare Maidens',
    division: 'women',
    role: 'All-rounder',
    jersey: 11,
    status: 'active',
  },
  {
    id: 'p4',
    fullName: 'Milton Shumba',
    slug: 'milton-shumba',
    team: 'Bulawayo Blaze',
    division: 'men',
    role: 'Batsman',
    jersey: 18,
    status: 'injured',
  },
]

export const MOCK_LEAGUES: LeagueRow[] = [
  {
    id: 'l1',
    name: 'NPL Premier',
    slug: 'npl-premier-2026',
    division: 'men',
    season: '2026',
    status: 'active',
    start: '2026-03-01',
    end: '2026-09-30',
  },
  {
    id: 'l2',
    name: 'NPL Women',
    slug: 'npl-women-2026',
    division: 'women',
    season: '2026',
    status: 'active',
    start: '2026-03-15',
    end: '2026-08-20',
  },
  {
    id: 'l3',
    name: 'Youth Shield',
    slug: 'youth-shield-2025',
    division: 'youth',
    season: '2025',
    status: 'completed',
    start: '2025-01-10',
    end: '2025-12-05',
  },
]

export const MOCK_MATCHES: MatchRow[] = [
  {
    id: 'm1',
    league: 'NPL Premier',
    division: 'men',
    home: 'Harare Hurricanes',
    away: 'Bulawayo Blaze',
    venue: 'Harare Sports Club',
    when: '2026-04-20T09:30:00',
    status: 'scheduled',
  },
  {
    id: 'm2',
    league: 'NPL Women',
    division: 'women',
    home: 'Mutare Maidens',
    away: 'Harare Hurricanes',
    venue: 'Mutare Sports Club',
    when: '2026-04-18T13:00:00',
    status: 'live',
  },
  {
    id: 'm3',
    league: 'NPL Premier',
    division: 'men',
    home: 'Bulawayo Blaze',
    away: 'Harare Hurricanes',
    venue: 'Queens Sports Club',
    when: '2026-04-12T09:30:00',
    status: 'completed',
  },
]

export const MOCK_ARTICLES: ArticleRow[] = [
  {
    id: 'a1',
    title: 'NPL 2026 fixtures released',
    slug: 'npl-2026-fixtures-released',
    author: 'League Media',
    status: 'published',
    category: 'Competition',
    updated: '2026-04-10',
  },
  {
    id: 'a2',
    title: 'Youth pathway clinic — Bulawayo',
    slug: 'youth-pathway-clinic-bulawayo',
    author: 'Development',
    status: 'draft',
    category: 'Development',
    updated: '2026-04-16',
  },
  {
    id: 'a3',
    title: 'Match report: Blaze vs Hurricanes',
    slug: 'match-report-blaze-hurricanes',
    author: 'Match Reporter',
    status: 'scheduled',
    category: 'Match reports',
    updated: '2026-04-17',
  },
]

export const MOCK_GALLERY: GalleryRow[] = [
  {
    id: 'g1',
    title: 'Opening ceremony — aerial',
    type: 'image',
    status: 'published',
    tags: 'ceremony, harare',
    updated: '2026-04-01',
  },
  {
    id: 'g2',
    title: 'Highlights reel — Round 3',
    type: 'video',
    status: 'published',
    tags: 'highlights, video',
    updated: '2026-04-14',
  },
  {
    id: 'g3',
    title: 'Training session stills',
    type: 'image',
    status: 'draft',
    tags: 'training',
    updated: '2026-04-17',
  },
]

export const MOCK_USERS: UserRow[] = [
  {
    id: 'u1',
    name: 'Rudo Moyo',
    email: 'rudo.moyo@zimcricket.org',
    role: 'Super Admin',
    status: 'active',
    lastLogin: '2026-04-18T08:12:00',
  },
  {
    id: 'u2',
    name: 'Brian Chikwava',
    email: 'brian.chikwava@zimcricket.org',
    role: 'Competition Manager',
    status: 'active',
    lastLogin: '2026-04-17T16:40:00',
  },
  {
    id: 'u3',
    name: 'Tariro Nkomo',
    email: 'tariro.nkomo@zimcricket.org',
    role: 'Content Editor',
    status: 'active',
    lastLogin: '2026-04-16T11:05:00',
  },
]

export const MOCK_AUDIT: AuditRow[] = [
  {
    id: 'e1',
    actor: 'brian.chikwava@zimcricket.org',
    action: 'update',
    entity: 'Match',
    entityId: 'm3',
    at: '2026-04-12T14:22:00',
    summary: 'Recorded official result and margin',
  },
  {
    id: 'e2',
    actor: 'tariro.nkomo@zimcricket.org',
    action: 'publish',
    entity: 'Article',
    entityId: 'a1',
    at: '2026-04-10T09:01:00',
    summary: 'Published article to public site',
  },
  {
    id: 'e3',
    actor: 'rudo.moyo@zimcricket.org',
    action: 'create',
    entity: 'User',
    entityId: 'u3',
    at: '2026-04-02T10:18:00',
    summary: 'Created editor account with role Content Editor',
  },
]
