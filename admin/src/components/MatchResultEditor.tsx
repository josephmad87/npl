import { useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  Plus,
  Save,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MatchDto, MatchPlayerStatDto, PlayerDto } from '@/lib/api-types'
import { adminPost } from '@/lib/admin-client'

type StatRow = {
  key: string
  player_id: number
  team_id: number
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

function newKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function emptyRow(teamId: number): StatRow {
  return {
    key: newKey(),
    player_id: 0,
    team_id: teamId,
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

function fromServer(rows: MatchPlayerStatDto[]): StatRow[] {
  return rows.map((s) => ({
    key: String(s.id),
    player_id: s.player_id,
    team_id: s.team_id,
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [winningTeamId, setWinningTeamId] = useState(
    res?.winning_team_id != null ? String(res.winning_team_id) : '',
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
  const [matchReport, setMatchReport] = useState(res?.match_report ?? '')

  const statsFingerprint = useMemo(
    () =>
      (match.player_stats ?? [])
        .map((s) => `${s.id}:${s.runs}:${s.balls_faced}:${s.wickets}`)
        .join('|'),
    [match.player_stats],
  )
  const [statRows, setStatRows] = useState<StatRow[]>(() =>
    fromServer(match.player_stats ?? []),
  )
  useEffect(() => {
    setStatRows(fromServer(match.player_stats ?? []))
  }, [matchId, statsFingerprint, match.player_stats])

  const rosterPlayers = useMemo(
    () =>
      players.filter(
        (p) =>
          p.team_id === match.home_team_id || p.team_id === match.away_team_id,
      ),
    [players, match.home_team_id, match.away_team_id],
  )

  const pomOptions = useMemo(() => rosterPlayers, [rosterPlayers])

  const addBlankRow = useCallback(() => {
    setStatRows((prev) => [...prev, emptyRow(match.home_team_id)])
  }, [match.home_team_id])

  const fillRoster = useCallback(() => {
    setStatRows((prev) => {
      const used = new Set(
        prev.map((r) => r.player_id).filter((id) => id > 0),
      )
      const additions = rosterPlayers
        .filter((p) => !used.has(p.id))
        .map((p) => ({
          ...emptyRow(p.team_id),
          player_id: p.id,
        }))
      return [...prev, ...additions]
    })
  }, [rosterPlayers])

  const removeRow = useCallback((key: string) => {
    setStatRows((prev) => prev.filter((r) => r.key !== key))
  }, [])

  const updateRow = useCallback((key: string, patch: Partial<StatRow>) => {
    setStatRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    )
  }, [])

  const save = async () => {
    const validRows = statRows.filter((r) => r.player_id > 0)
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
        const ov = r.overs.trim()
        return {
          player_id: r.player_id,
          team_id: r.team_id,
          lineup_order: idx,
          runs: r.runs,
          balls_faced: r.balls_faced,
          fours: r.fours,
          sixes: r.sixes,
          dismissal: r.dismissal.trim() || null,
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
      await adminPost<MatchDto>(`/admin/matches/${matchId}/result`, {
        winning_team_id: winningTeamId ? Number(winningTeamId) : null,
        margin_text: marginText.trim() || null,
        score_summary: scoreSummary.trim() || null,
        innings_breakdown: inningsBreakdown.trim() || null,
        top_performers: topPerformers.trim() || null,
        player_of_match_player_id: pomId ? Number(pomId) : null,
        result_status: res?.result_status ?? 'official',
        match_report: matchReport.trim() || null,
        player_stats,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] })
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
            <span>Winning side</span>
            <select
              className="inline-edit__control"
              value={winningTeamId}
              onChange={(e) => setWinningTeamId(e.target.value)}
            >
              <option value="">— Tied / no result —</option>
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
        <div className="match-result-editor__section-head">
          <h2 className="match-result-editor__h">Player scorecard</h2>
          <div className="match-result-editor__toolbar">
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={addBlankRow}
            >
              <Plus size={18} strokeWidth={2} aria-hidden />
              Add row
            </button>
            <button
              type="button"
              className="btn-ghost btn--with-icon"
              onClick={fillRoster}
            >
              <UserPlus size={18} strokeWidth={2} aria-hidden />
              Add all roster players
            </button>
          </div>
        </div>
        <div className="table-scroll match-stats-scroll">
          <table className="data-table match-stats-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Side</th>
                <th>R</th>
                <th>BF</th>
                <th>4s</th>
                <th>6s</th>
                <th>How out</th>
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
              {statRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <select
                      className="inline-edit__control match-stats-table__select"
                      value={row.player_id || ''}
                      onChange={(e) =>
                        updateRow(row.key, {
                          player_id: Number(e.target.value),
                        })
                      }
                    >
                      <option value="">— Select —</option>
                      {rosterPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="inline-edit__control match-stats-table__select"
                      value={row.team_id}
                      onChange={(e) =>
                        updateRow(row.key, {
                          team_id: Number(e.target.value),
                        })
                      }
                    >
                      <option value={match.home_team_id}>{homeLabel}</option>
                      <option value={match.away_team_id}>{awayLabel}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="inline-edit__control match-stats-table__num"
                      value={row.runs}
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
                      onChange={(e) =>
                        updateRow(row.key, {
                          sixes: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="inline-edit__control match-stats-table__dismissal"
                      value={row.dismissal}
                      onChange={(e) =>
                        updateRow(row.key, { dismissal: e.target.value })
                      }
                      placeholder="not out"
                    />
                  </td>
                  <td>
                    <input
                      className="inline-edit__control match-stats-table__num"
                      value={row.overs}
                      onChange={(e) =>
                        updateRow(row.key, { overs: e.target.value })
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
