  import { useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import type { MatchDto, MatchPlayerStatDto, PlayerDto } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'
import { invalidateCompetitionDataQueries } from '@/lib/invalidate-competition-data'
import {
  getInningsSides,
  isDidNotBat,
  normalizeCricketOversInput,
  type InningsNumber,
} from '@/lib/cricket'
import { DismissalField } from '@/components/DismissalField'

type MatchResultOutcome = 'win' | 'tie' | 'no_result'

function outcomeFromResult(result: MatchDto['result']): MatchResultOutcome {
  const typedResult = result as
    | (NonNullable<MatchDto['result']> & { outcome?: string | null })
    | null
    | undefined

  const outcome = String(typedResult?.outcome ?? '').trim().toLowerCase()

  if (outcome === 'win' || outcome === 'tie' || outcome === 'no_result') {
    return outcome
  }

  if (typedResult?.winning_team_id != null) {
    return 'win'
  }

  return 'win'
}

type ExtrasFields = {
  wides: number
  byes: number
  no_balls: number
  leg_byes: number
}

type StatRow = {
  key: string
  player_id: number
  team_id: number
  batting_order: number | null
  bowling_order: number | null
  runs: number
  balls_faced: number
  fours: number
  sixes: number
  dismissal: string
  overs: string
  maidens: number
  runs_conceded: number
  wickets: number
  catches: number
  stumpings: number
  run_outs: number
  notes: string
}

function emptyExtras(): ExtrasFields {
  return { wides: 0, byes: 0, no_balls: 0, leg_byes: 0 }
}

function extrasFromResult(
  res: MatchDto['result'],
  side: 'home' | 'away',
): ExtrasFields {
  if (!res) return emptyExtras()
  const p = side === 'home' ? 'home_extras_' : 'away_extras_'
  const num = (key: string) => {
    const v = res[key as keyof typeof res]
    return typeof v === 'number' && !Number.isNaN(v) ? v : 0
  }
  return {
    wides: num(`${p}wides`),
    byes: num(`${p}byes`),
    no_balls: num(`${p}no_balls`),
    leg_byes: num(`${p}leg_byes`),
  }
}

function extrasTotal(e: ExtrasFields): number {
  return e.wides + e.byes + e.no_balls + e.leg_byes
}

function defaultAllottedOversForMatch(match: MatchDto): string {
  const text = [
    match.season?.league?.slug,
    match.season?.league?.name,
    match.season?.slug,
    match.season?.name,
    match.title,
    match.category,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('t20') || text.includes('twenty20')) {
    return '20.0'
  }

  return '40.0'
}

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function emptyRow(teamId: number): StatRow {
  return {
    key: newKey(),
    player_id: 0,
    team_id: teamId,
    batting_order: null,
    bowling_order: null,
    runs: 0,
    balls_faced: 0,
    fours: 0,
    sixes: 0,
    dismissal: '',
    overs: '',
    maidens: 0,
    runs_conceded: 0,
    wickets: 0,
    catches: 0,
    stumpings: 0,
    run_outs: 0,
    notes: '',
  }
}
function nextOrder(
  rows: StatRow[],
  teamId: number,
  kind: 'batting' | 'bowling',
): number {
  const field = kind === 'batting' ? 'batting_order' : 'bowling_order'

  const existingOrders = rows
    .filter((r) => r.team_id === teamId && r[field] != null)
    .map((r) => r[field] ?? 0)

  if (existingOrders.length === 0) {
    return 1
  }

  return Math.max(...existingOrders) + 1
}
function hasServerBattingData(s: MatchPlayerStatDto): boolean {
  return (
    s.runs > 0 ||
    s.balls_faced > 0 ||
    s.fours > 0 ||
    s.sixes > 0 ||
    (s.dismissal?.trim() ?? '') !== ''
  )
}

function hasServerBowlingData(s: MatchPlayerStatDto): boolean {
  const overs = s.overs == null || s.overs === '' ? 0 : Number(s.overs)

  return !Number.isNaN(overs) && overs > 0
}

function fromServer(rows: MatchPlayerStatDto[]): StatRow[] {
  return rows.map((s) => ({
    key: String(s.id),
    player_id: s.player_id,
     team_id: s.team_id,
   batting_order:
      s.batting_order ?? (hasServerBattingData(s) ? s.lineup_order : null),
  bowling_order:
      s.bowling_order ?? (hasServerBowlingData(s) ? s.lineup_order : null),
    runs: s.runs,
    balls_faced: s.balls_faced,
    fours: s.fours,
    sixes: s.sixes,
    dismissal: s.dismissal ?? '',
    overs: s.overs != null && s.overs !== '' ? String(s.overs) : '',
    maidens: s.maidens,
    runs_conceded: s.runs_conceded,
    wickets: s.wickets,
    catches: s.catches,
    stumpings: s.stumpings,
    run_outs: s.run_outs,
    notes: s.notes ?? '',
  }))
}

type MatchResultEditorProps = Readonly<{
  match: MatchDto
  matchId: number
  homeLabel: string
  awayLabel: string
  players: PlayerDto[]
  onCancel: () => void
  onSaved: () => void
}>
function hasBattingData(row: StatRow): boolean {
  return (
    row.runs > 0 ||
    row.balls_faced > 0 ||
    row.fours > 0 ||
    row.sixes > 0 ||
    row.dismissal.trim() !== ''
  )
}

function hasBowlingData(row: StatRow): boolean {
  return (
    row.overs.trim() !== '' ||
    row.maidens > 0 ||
    row.runs_conceded > 0 ||
    row.wickets > 0 ||
    row.catches > 0 ||
    row.stumpings > 0 ||
    row.run_outs > 0 ||
    row.notes.trim() !== ''
  )
}
export function MatchResultEditor({
  match,
  matchId,
  homeLabel,
  awayLabel,
  players,
  onCancel,
  onSaved,
}: MatchResultEditorProps) {
  const queryClient = useQueryClient()
  const res = match.result
  const defaultAllottedOvers = defaultAllottedOversForMatch(match)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resultOutcome, setResultOutcome] = useState<MatchResultOutcome>(() =>
  outcomeFromResult(res),
)

  const [winningTeamId, setWinningTeamId] = useState(
  outcomeFromResult(res) === 'win' && res?.winning_team_id != null
    ? String(res.winning_team_id)
    : '',
)
  
  const [marginText, setMarginText] = useState(res?.margin_text ?? '')
  const [scoreSummary, setScoreSummary] = useState(res?.score_summary ?? '')
  const [inningsBreakdown, setInningsBreakdown] = useState(
    res?.innings_breakdown ?? '',
  )
  const [topPerformers, setTopPerformers] = useState(res?.top_performers ?? '')
  const [pomId, setPomId] = useState(
    res?.player_of_match_player_id != null
      ? String(res.player_of_match_player_id)
      : '',
  )
  const [battingFirstTeamId, setBattingFirstTeamId] = useState(
    res?.batting_first_team_id != null
      ? String(res.batting_first_team_id)
      : String(match.home_team_id),
  )
  const [matchReport, setMatchReport] = useState(res?.match_report ?? '')

  const [inningsTab, setInningsTab] = useState<InningsNumber>(1)

  const battingFirstId = battingFirstTeamId
    ? Number(battingFirstTeamId)
    : null
  const inningsSides = getInningsSides(
    inningsTab,
    battingFirstId,
    match.home_team_id,
    match.away_team_id,
  )

  const [homeExtras, setHomeExtras] = useState<ExtrasFields>(() =>
    extrasFromResult(res, 'home'),
  )
  const [awayExtras, setAwayExtras] = useState<ExtrasFields>(() =>
    extrasFromResult(res, 'away'),
  )

const [homeAllottedOvers, setHomeAllottedOvers] = useState(
  res?.home_allotted_overs != null
    ? String(res.home_allotted_overs)
    : defaultAllottedOvers,
)

const [awayAllottedOvers, setAwayAllottedOvers] = useState(
  res?.away_allotted_overs != null
    ? String(res.away_allotted_overs)
    : defaultAllottedOvers,
)
  
  const [statRows, setStatRows] = useState<StatRow[]>(() =>
    fromServer(match.player_stats ?? []),
  )

  const rosterPlayers = useMemo(
    () =>
      players.filter(
        (p) =>
          p.team_id === match.home_team_id || p.team_id === match.away_team_id,
      ),
    [players, match.home_team_id, match.away_team_id],
  )

  const pomOptions = useMemo(() => rosterPlayers, [rosterPlayers])

  const rosterForTeam = useCallback(
    (teamId: number) => rosterPlayers.filter((p) => p.team_id === teamId),
    [rosterPlayers],
  )


const addBattingRow = useCallback(
  (teamId: number) => {
    setStatRows((prev) => [
      ...prev,
      {
        ...emptyRow(teamId),
        batting_order: nextOrder(prev, teamId, 'batting'),
      },
    ])
  },
  [],
)

const addBowlingRow = useCallback(
  (teamId: number) => {
    setStatRows((prev) => [
      ...prev,
      {
        ...emptyRow(teamId),
        bowling_order: nextOrder(prev, teamId, 'bowling'),
      },
    ])
  },
  [],
)

const fillRosterForTeam = useCallback(
  (teamId: number, kind: 'batting' | 'bowling') => {
    setStatRows((prev) => {
      const field = kind === 'batting' ? 'batting_order' : 'bowling_order'
      let order = nextOrder(prev, teamId, kind)
      const next = [...prev]

      for (const player of rosterForTeam(teamId)) {
        const existingIndex = next.findIndex((r) => r.player_id === player.id)

        if (existingIndex >= 0) {
          const existing = next[existingIndex]

          if (existing.team_id === teamId && existing[field] == null) {
            next[existingIndex] = {
              ...existing,
              [field]: order,
            }
            order += 1
          }

          continue
        }

        next.push({
          ...emptyRow(teamId),
          player_id: player.id,
          [field]: order,
        })

        order += 1
      }

      return next
    })
  },
  [rosterForTeam],
)

  const removeRow = useCallback((key: string) => {
    setStatRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  const updateRow = useCallback((key: string, patch: Partial<StatRow>) => {
    setStatRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    )
  }, [])

  const assignPlayerToRow = useCallback(
  (key: string, playerId: number, kind: 'batting' | 'bowling') => {
    setStatRows((prev) => {
      const current = prev.find((r) => r.key === key)

      if (!current) {
        return prev
      }

      if (playerId <= 0) {
        return prev.map((r) =>
          r.key === key
            ? {
                ...r,
                player_id: 0,
              }
            : r,
        )
      }

      const existing = prev.find(
        (r) => r.player_id === playerId && r.key !== key,
      )

      if (!existing) {
        return prev.map((r) =>
          r.key === key
            ? {
                ...r,
                player_id: playerId,
              }
            : r,
        )
      }

      if (kind === 'batting') {
        return prev
          .map((r) =>
            r.key === existing.key
              ? {
                  ...r,
                  batting_order:
                    r.batting_order ??
                    current.batting_order ??
                    nextOrder(prev, current.team_id, 'batting'),
                  runs: current.runs,
                  balls_faced: current.balls_faced,
                  fours: current.fours,
                  sixes: current.sixes,
                  dismissal: current.dismissal,
                }
              : r,
          )
          .filter((r) => r.key !== key)
      }

      return prev
        .map((r) =>
          r.key === existing.key
            ? {
                ...r,
                bowling_order:
                  r.bowling_order ??
                  current.bowling_order ??
                  nextOrder(prev, current.team_id, 'bowling'),
                overs: current.overs,
                maidens: current.maidens,
                runs_conceded: current.runs_conceded,
                wickets: current.wickets,
                catches: current.catches,
                stumpings: current.stumpings,
                run_outs: current.run_outs,
                notes: current.notes,
              }
            : r,
        )
        .filter((r) => r.key !== key)
    })

    setSaveError(null)
  },
  [],
)

  const save = async () => {
   const validRows = statRows
  .filter((r) => r.player_id > 0)
  .map((r) => ({
    ...r,
    batting_order:
      r.batting_order ?? (hasBattingData(r) ? nextOrder(statRows, r.team_id, 'batting') : null),
    bowling_order:
      r.bowling_order ?? (hasBowlingData(r) ? nextOrder(statRows, r.team_id, 'bowling') : null),
  }))

    if (resultOutcome === 'win' && !winningTeamId) {
  setSaveError('Select the winning team, or change Result type to Tie / No result.')
  return
}
  
    
    const pids = validRows.map((r) => r.player_id)
    if (new Set(pids).size !== pids.length) {
      setSaveError('Each player can appear only once in the scorecard.')
      return
    }
    for (const r of validRows) {
      if (
        r.team_id !== match.home_team_id &&
        r.team_id !== match.away_team_id
      ) {
        setSaveError('Each row must use home or away as the side.')
        return
      }
    }
    setSaveError(null)
    setSaving(true)
    try {
      const player_stats = validRows.map((r, idx) => {
        const ov = normalizeCricketOversInput(r.overs)
        const dismissal = r.dismissal.trim()
        return {
          player_id: r.player_id,
          team_id: r.team_id,
          lineup_order: idx,
          batting_order: r.batting_order,
          bowling_order: r.bowling_order,
          runs: isDidNotBat(dismissal) ? 0 : r.runs,
          balls_faced: isDidNotBat(dismissal) ? 0 : r.balls_faced,
          fours: isDidNotBat(dismissal) ? 0 : r.fours,
          sixes: isDidNotBat(dismissal) ? 0 : r.sixes,
          dismissal: dismissal || null,
          overs: ov === '' ? null : Number(ov),
          maidens: r.maidens,
          runs_conceded: r.runs_conceded,
          wickets: r.wickets,
          catches: r.catches,
          stumpings: r.stumpings,
          run_outs: r.run_outs,
          notes: r.notes.trim() || null,
        }
      })
      for (const row of player_stats) {
        if (row.overs != null && Number.isNaN(row.overs)) {
          setSaveError(`Invalid overs value for a player row.`)
          setSaving(false)
          return
        }
      }

      const normalizedHomeAllottedOvers =
  normalizeCricketOversInput(homeAllottedOvers) || defaultAllottedOvers

const normalizedAwayAllottedOvers =
  normalizeCricketOversInput(awayAllottedOvers) || defaultAllottedOvers

if (
  Number.isNaN(Number(normalizedHomeAllottedOvers)) ||
  Number.isNaN(Number(normalizedAwayAllottedOvers))
) {
  setSaveError('Invalid allotted overs value.')
  setSaving(false)
  return
}
   
      await adminPost<MatchDto>(`/admin/matches/${matchId}/result`, {
        outcome: resultOutcome,
        winning_team_id:
  resultOutcome === 'win' && winningTeamId ? Number(winningTeamId) : null,
        batting_first_team_id: battingFirstId,
        margin_text: marginText.trim() || null,
        score_summary: scoreSummary.trim() || null,
        innings_breakdown: inningsBreakdown.trim() || null,
        top_performers: topPerformers.trim() || null,
        player_of_match_player_id: pomId ? Number(pomId) : null,
        result_status: res?.result_status ?? 'official',
        match_report: matchReport.trim() || null,
        home_allotted_overs: Number(normalizedHomeAllottedOvers),
        away_allotted_overs: Number(normalizedAwayAllottedOvers),
        home_extras_wides: homeExtras.wides,
        home_extras_byes: homeExtras.byes,
        home_extras_no_balls: homeExtras.no_balls,
        home_extras_leg_byes: homeExtras.leg_byes,
        away_extras_wides: awayExtras.wides,
        away_extras_byes: awayExtras.byes,
        away_extras_no_balls: awayExtras.no_balls,
        away_extras_leg_byes: awayExtras.leg_byes,
        player_stats,
      })
      await invalidateCompetitionDataQueries(
        queryClient,
        player_stats.map((row) => row.player_id),
      )
      onSaved()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="match-result-editor">
      <p className="muted match-result-editor__lead">
        Sets the official result (match status → completed) and replaces the
        full player scorecard for this fixture. Use <strong>Add row</strong>{' '}
        for manual lines, or <strong>Add all roster players</strong> to
        insert every player from home and away squads (existing rows are kept;
        new players are appended).
      </p>
      {saveError ? <p className="login-error">{saveError}</p> : null}

      <section className="match-result-editor__section">
        <h2 className="match-result-editor__h">Match summary</h2>
        <div className="match-result-editor__grid">

<label className="match-result-editor__field">
  <span>{homeLabel} allotted overs for NRR</span>
  <input
    className="inline-edit__control"
    value={homeAllottedOvers}
    onChange={(e) => setHomeAllottedOvers(e.target.value)}
    onBlur={(e) =>
      setHomeAllottedOvers(
        normalizeCricketOversInput(e.target.value) || defaultAllottedOvers,
      )
    }
    placeholder={defaultAllottedOvers}
  />
</label>

<label className="match-result-editor__field">
  <span>{awayLabel} allotted overs for NRR</span>
  <input
    className="inline-edit__control"
    value={awayAllottedOvers}
    onChange={(e) => setAwayAllottedOvers(e.target.value)}
    onBlur={(e) =>
      setAwayAllottedOvers(
        normalizeCricketOversInput(e.target.value) || defaultAllottedOvers,
      )
    }
    placeholder={defaultAllottedOvers}
  />
</label>
          
          <label className="match-result-editor__field">
            <span>Team batting first</span>
            <select
              className="inline-edit__control"
              value={battingFirstTeamId}
              onChange={(e) => setBattingFirstTeamId(e.target.value)}
            >
              <option value={String(match.home_team_id)}>{homeLabel}</option>
              <option value={String(match.away_team_id)}>{awayLabel}</option>
            </select>
          </label>
         <label className="match-result-editor__field">
  <span>Result type</span>
  <select
    className="inline-edit__control"
    value={resultOutcome}
    onChange={(e) => {
      const next = e.target.value as MatchResultOutcome
      setResultOutcome(next)

      if (next !== 'win') {
        setWinningTeamId('')
      }

      if (next === 'tie' && !marginText.trim()) {
        setMarginText('Match tied')
      }

      if (next === 'no_result' && !marginText.trim()) {
        setMarginText('No result')
      }
    }}
  >
    <option value="win">Winning team</option>
    <option value="tie">Tie</option>
    <option value="no_result">No result</option>
  </select>
</label>

<label className="match-result-editor__field">
  <span>Winning side</span>
  <select
    className="inline-edit__control"
    value={winningTeamId}
    disabled={resultOutcome !== 'win'}
    onChange={(e) => setWinningTeamId(e.target.value)}
  >
    <option value="">— Select winner —</option>
    <option value={String(match.home_team_id)}>{homeLabel}</option>
    <option value={String(match.away_team_id)}>{awayLabel}</option>
  </select>
</label>
          <label className="match-result-editor__field">
            <span>Margin (e.g. “6 wickets”, “15 runs”)</span>
            <input
              className="inline-edit__control"
              value={marginText}
              onChange={(e) => setMarginText(e.target.value)}
            />
          </label>
          <label className="match-result-editor__field match-result-editor__field--wide">
            <span>Score summary (one line headline)</span>
            <input
              className="inline-edit__control"
              value={scoreSummary}
              onChange={(e) => setScoreSummary(e.target.value)}
            />
          </label>
          <label className="match-result-editor__field match-result-editor__field--wide">
            <span>Innings breakdown</span>
            <textarea
              className="inline-edit__control"
              rows={3}
              value={inningsBreakdown}
              onChange={(e) => setInningsBreakdown(e.target.value)}
            />
          </label>
          <label className="match-result-editor__field match-result-editor__field--wide">
            <span>Top performers (notes)</span>
            <textarea
              className="inline-edit__control"
              rows={2}
              value={topPerformers}
              onChange={(e) => setTopPerformers(e.target.value)}
            />
          </label>
          <label className="match-result-editor__field">
            <span>Player of the match</span>
            <select
              className="inline-edit__control"
              value={pomId}
              onChange={(e) => setPomId(e.target.value)}
            >
              <option value="">— None —</option>
              {pomOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="match-result-editor__field match-result-editor__field--wide">
            <span>Match report</span>
            <textarea
              className="inline-edit__control"
              rows={4}
              value={matchReport}
              onChange={(e) => setMatchReport(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="match-result-editor__section">
        <h2 className="match-result-editor__h">Innings extras</h2>
        <p className="muted match-result-editor__lead">
          Team extras count toward the official innings total and NPL net run rate.
        </p>
        <div className="match-result-editor__extras-grid">
          {(
            [
              { label: homeLabel, state: homeExtras, set: setHomeExtras },
              { label: awayLabel, state: awayExtras, set: setAwayExtras },
            ] as const
          ).map(({ label, state, set }) => (
            <div key={label} className="match-result-editor__extras-side">
              <h3 className="match-result-editor__extras-title">{label}</h3>
              <div className="match-result-editor__grid">
                {(
                  [
                    ['wides', 'Wides'],
                    ['byes', 'Byes'],
                    ['no_balls', 'No-balls'],
                    ['leg_byes', 'Leg-byes'],
                  ] as const
                ).map(([key, fieldLabel]) => (
                  <label key={key} className="match-result-editor__field">
                    <span>{fieldLabel}</span>
                    <input
                      type="number"
                      min={0}
                      className="inline-edit__control"
                      value={state[key]}
                      onChange={(e) =>
                        set((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value) || 0,
                        }))
                      }
                    />
                  </label>
                ))}
                <p className="match-result-editor__field muted">
                  Total extras: <strong>{extrasTotal(state)}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="match-result-editor__section">
        <div className="match-result-editor__section-head">
          <h2 className="match-result-editor__h">Player scorecard</h2>
        </div>
        <div className="dashboard-match-panel__tabs" role="tablist" aria-label="Innings">
          <button
            type="button"
            className={`dashboard-match-panel__tab${inningsTab === 1 ? ' is-active' : ''}`}
            onClick={() => setInningsTab(1)}
            role="tab"
            aria-selected={inningsTab === 1}
          >
            1st innings
          </button>
          <button
            type="button"
            className={`dashboard-match-panel__tab${inningsTab === 2 ? ' is-active' : ''}`}
            onClick={() => setInningsTab(2)}
            role="tab"
            aria-selected={inningsTab === 2}
          >
            2nd innings
          </button>
        </div>
        {!inningsSides ? (
          <p className="muted">Select which team batted first above.</p>
        ) : (
          <div className="innings-scorecard-panels">
            <section className="innings-scorecard-panels__section">
              <div className="match-result-editor__section-head">
                <h3 className="innings-scorecard-panels__h">
                  Batting —{' '}
                  {inningsSides.battingTeamId === match.home_team_id
                    ? homeLabel
                    : awayLabel}
                </h3>
                <div className="match-result-editor__toolbar">
                  <button
                    type="button"
                    className="btn-ghost btn--with-icon"
                    onClick={() => addBattingRow(inningsSides.battingTeamId)}
                  >
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Add row
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn--with-icon"
                    onClick={() => fillRosterForTeam(inningsSides.battingTeamId, 'batting')}
                  >
                    <UserPlus size={18} strokeWidth={2} aria-hidden />
                    Add all roster
                  </button>
                </div>
              </div>
              <div className="table-scroll match-stats-scroll">
                <table className="data-table match-stats-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>R</th>
                      <th>BF</th>
                      <th>4s</th>
                      <th>6s</th>
                      <th>How out</th>
                      <th className="match-stats-table__remove-col" aria-label="Remove row" />
                    </tr>
                  </thead>
                  <tbody>
                    {statRows
                      .filter(
  (r) =>
    r.team_id === inningsSides.battingTeamId &&
    r.batting_order != null,
)
                    .sort((a, b) => (a.batting_order ?? 0) - (b.batting_order ?? 0))
                      .map((row) => (
                        <tr key={row.key}>
                          <td>
                            <select
                              className="inline-edit__control match-stats-table__select"
                              value={row.player_id || ''}
                             onChange={(e) => {
                              assignPlayerToRow(row.key, Number(e.target.value), 'batting')
                              }}                            >
                              <option value="">— Select —</option>
                              {rosterForTeam(inningsSides.battingTeamId).map(
                                (p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.full_name}
                                  </option>
                                ),
                              )}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.runs}
                              disabled={isDidNotBat(row.dismissal)}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  runs: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.balls_faced}
                              disabled={isDidNotBat(row.dismissal)}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  balls_faced: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.fours}
                              disabled={isDidNotBat(row.dismissal)}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  fours: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.sixes}
                              disabled={isDidNotBat(row.dismissal)}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  sixes: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <DismissalField
                              value={row.dismissal}
                              onChange={(dismissal) =>
                                updateRow(row.key, {
                                  dismissal,
                                  ...(isDidNotBat(dismissal)
                                    ? {
                                        runs: 0,
                                        balls_faced: 0,
                                        fours: 0,
                                        sixes: 0,
                                      }
                                    : {}),
                                })
                              }
                            />
                          </td>
                          <td className="match-stats-table__remove-col">
                            <button
                              type="button"
                              className="btn-ghost btn--with-icon match-stats-table__remove-btn"
                              onClick={() => removeRow(row.key)}
                            >
                              <Trash2 size={16} strokeWidth={2} aria-hidden />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="innings-scorecard-panels__section">
              <div className="match-result-editor__section-head">
                <h3 className="innings-scorecard-panels__h">
                  Bowling —{' '}
                  {inningsSides.bowlingTeamId === match.home_team_id
                    ? homeLabel
                    : awayLabel}
                </h3>
                <div className="match-result-editor__toolbar">
                  <button
                    type="button"
                    className="btn-ghost btn--with-icon"
                    onClick={() => addBowlingRow(inningsSides.bowlingTeamId)}
                  >
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Add row
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn--with-icon"
                    onClick={() => fillRosterForTeam(inningsSides.bowlingTeamId, 'bowling')}
                  >
                    <UserPlus size={18} strokeWidth={2} aria-hidden />
                    Add all roster
                  </button>
                </div>
              </div>
              <div className="table-scroll match-stats-scroll">
                <table className="data-table match-stats-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Ov</th>
                      <th>M</th>
                      <th>Conc</th>
                      <th>W</th>
                      <th>Ct</th>
                      <th>St</th>
                      <th>RO</th>
                      <th>Notes</th>
                      <th className="match-stats-table__remove-col" aria-label="Remove row" />
                    </tr>
                  </thead>
                  <tbody>
                    {statRows
                      .filter(
                  (r) =>
                    r.team_id === inningsSides.bowlingTeamId &&
                    r.bowling_order != null,
)
                      .sort((a, b) => (a.bowling_order ?? 0) - (b.bowling_order ?? 0))
                      .map((row) => (
                        <tr key={row.key}>
                          <td>
                            <select
                              className="inline-edit__control match-stats-table__select"
                              value={row.player_id || ''}
                              onChange={(e) => {
                              assignPlayerToRow(row.key, Number(e.target.value), 'bowling')
                            }}
                            >
                              <option value="">— Select —</option>
                              {rosterForTeam(inningsSides.bowlingTeamId).map(
                                (p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.full_name}
                                  </option>
                                ),
                              )}
                            </select>
                          </td>
                          <td>
                            <input
                              className="inline-edit__control match-stats-table__num"
                              value={row.overs}
                              onChange={(e) =>
                                updateRow(row.key, { overs: e.target.value })
                              }
                              onBlur={(e) =>
                                updateRow(row.key, {
                                  overs: normalizeCricketOversInput(
                                    e.target.value,
                                  ),
                                })
                              }
                              placeholder="4.0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.maidens}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  maidens: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.runs_conceded}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  runs_conceded: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.wickets}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  wickets: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.catches}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  catches: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.stumpings}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  stumpings: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              className="inline-edit__control match-stats-table__num"
                              value={row.run_outs}
                              onChange={(e) =>
                                updateRow(row.key, {
                                  run_outs: Number(e.target.value) || 0,
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="inline-edit__control match-stats-table__notes"
                              value={row.notes}
                              onChange={(e) =>
                                updateRow(row.key, { notes: e.target.value })
                              }
                            />
                          </td>
                          <td className="match-stats-table__remove-col">
                            <button
                              type="button"
                              className="btn-ghost btn--with-icon match-stats-table__remove-btn"
                              onClick={() => removeRow(row.key)}
                            >
                              <Trash2 size={16} strokeWidth={2} aria-hidden />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </section>

      <div className="match-result-editor__actions">
        <button
          type="button"
          className="btn-primary btn--with-icon"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2
              size={18}
              strokeWidth={2}
              className="npl-icon-spin"
              aria-hidden
            />
          ) : (
            <Save size={18} strokeWidth={2} aria-hidden />
          )}
          {saving ? 'Saving…' : 'Save result & scorecard'}
        </button>
        <button
          type="button"
          className="btn-ghost btn--with-icon"
          disabled={saving}
          onClick={onCancel}
        >
          <X size={18} strokeWidth={2} aria-hidden />
          Cancel
        </button>
      </div>
    </div>
  )
}
