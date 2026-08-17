import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { adminGet, adminPost, adminPut } from '@/lib/admin-client'
import type { MatchDto } from '@/lib/api-types'
import { getSession } from '@/lib/session'

export const Route = createFileRoute('/_shell/discipline/')({
  beforeLoad: () => {
    if (getSession()?.role !== 'super_admin') throw redirect({ to: '/profile' })
  },
  component: DisciplineAdminPage,
})

type Sanction = {
  id: number
  sanction_type: string
  team_id: number | null
  player_id: number | null
  points_delta: number
  fine_amount: string | number | null
  currency: string | null
  match_count: number | null
  notes: string | null
}

type DisciplineCase = {
  id: number
  match_id: number | null
  category: string
  status: string
  confidentiality: string
  summary: string
  evidence_notes: string | null
  reported_at: string
  decision_text: string | null
  public_summary: string | null
  sanctions: Sanction[]
}

function matchLabel(match: MatchDto | undefined) {
  if (!match) return 'No match linked'
  return `${match.title || `Match #${match.id}`} · ${match.match_date ?? 'date TBC'}`
}

function DisciplineAdminPage() {
  const queryClient = useQueryClient()
  const casesQ = useQuery({
    queryKey: ['admin', 'discipline-cases'],
    queryFn: () => adminGet<DisciplineCase[]>('/admin/discipline/cases'),
  })
  const matchesQ = useQuery({
    queryKey: ['admin', 'discipline-matches'],
    queryFn: () => adminGet<{ items: MatchDto[] }>('/admin/matches?page=1&page_size=200'),
  })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newMatchId, setNewMatchId] = useState('')
  const [newCategory, setNewCategory] = useState('match_incident')
  const [newSummary, setNewSummary] = useState('')
  const selected = useMemo(
    () => (casesQ.data ?? []).find((row) => row.id === selectedId) ?? casesQ.data?.[0] ?? null,
    [casesQ.data, selectedId],
  )
  const [status, setStatus] = useState('decided')
  const [decisionText, setDecisionText] = useState('')
  const [publicSummary, setPublicSummary] = useState('')
  const [outcome, setOutcome] = useState('')
  const [winnerId, setWinnerId] = useState('')
  const [marginText, setMarginText] = useState('')
  const [sanctionType, setSanctionType] = useState('warning')
  const [sanctionTeamId, setSanctionTeamId] = useState('')
  const [pointsDelta, setPointsDelta] = useState('0')
  const [fineAmount, setFineAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [sanctionNotes, setSanctionNotes] = useState('')

  useEffect(() => {
    if (!selected) return
    setStatus(selected.status === 'open' ? 'decided' : selected.status)
    setDecisionText(selected.decision_text ?? '')
    setPublicSummary(selected.public_summary ?? '')
    setOutcome('')
    setWinnerId('')
    setMarginText('')
    setSanctionType('warning')
    setSanctionTeamId('')
    setPointsDelta('0')
    setFineAmount('')
    setCurrency('USD')
    setSanctionNotes('')
  }, [selected])

  const saveMutation = useMutation({
    mutationFn: (body: unknown) => adminPut<DisciplineCase>(`/admin/discipline/cases/${selected?.id}/decision`, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'discipline-cases'] }),
  })
  const createMutation = useMutation({
    mutationFn: (body: unknown) => adminPost<DisciplineCase>('/admin/discipline/cases', body),
    onSuccess: async (created) => {
      setSelectedId(created.id)
      setNewSummary('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'discipline-cases'] })
    },
  })

  const match = (matchesQ.data?.items ?? []).find((item) => item.id === selected?.match_id)
  const involvedTeams = match ? [match.home_team_id, match.away_team_id] : []

  function save() {
    if (!selected) return
    const fine = Number(fineAmount)
    const points = Number(pointsDelta)
    const hasSanction = sanctionType !== 'none' && (
      sanctionType !== 'warning' || sanctionNotes.trim() || sanctionTeamId || points !== 0 || Number.isFinite(fine) && fine > 0
    )
    void saveMutation.mutate({
      status,
      decision_text: decisionText || null,
      public_summary: publicSummary || null,
      override_outcome: outcome || null,
      winning_team_id: outcome === 'win' && winnerId ? Number(winnerId) : null,
      margin_text: marginText || null,
      // Confirmed NPL policy: every administrative award is NRR-exempt.
      nrr_excluded: true,
      sanctions: hasSanction ? [{
        sanction_type: sanctionType,
        team_id: sanctionTeamId ? Number(sanctionTeamId) : null,
        points_delta: Number.isFinite(points) ? points : 0,
        fine_amount: Number.isFinite(fine) && fine > 0 ? fine : null,
        currency: Number.isFinite(fine) && fine > 0 ? currency : null,
        notes: sanctionNotes || null,
      }] : [],
    })
  }

  return (
    <section className="admin-page discipline-admin">
      <PageHeader
        title="Discipline & safeguarding"
        description="Incident reports, official determinations, sanctions and NRR-safe awarded results. Only super admins can decide a case."
      />
      <p className="muted small">Safeguarding evidence is restricted to this area and is never published. Administrative awards are excluded from NRR.</p>
      <form className="discipline-admin__new" onSubmit={(event) => {
        event.preventDefault()
        if (!newSummary.trim()) return
        void createMutation.mutate({
          match_id: newMatchId ? Number(newMatchId) : null,
          category: newCategory,
          summary: newSummary.trim(),
          confidentiality: newCategory === 'safeguarding' ? 'safeguarding' : 'restricted',
        })
      }}>
        <strong>Open a case</strong>
        <select value={newMatchId} onChange={(event) => setNewMatchId(event.target.value)}><option value="">No linked match</option>{(matchesQ.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{matchLabel(item)}</option>)}</select>
        <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}><option value="match_incident">Match incident</option><option value="protest">Protest</option><option value="eligibility">Eligibility</option><option value="misconduct">Misconduct</option><option value="safeguarding">Safeguarding</option><option value="venue">Venue / ground</option></select>
        <input value={newSummary} onChange={(event) => setNewSummary(event.target.value)} placeholder="Factual case summary" required />
        <button className="btn btn-primary" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Opening…' : 'Open case'}</button>
      </form>
      {createMutation.error ? <p className="form-error">{createMutation.error.message}</p> : null}
      <div className="discipline-admin__layout">
        <div className="discipline-admin__cases" aria-label="Discipline cases">
          {casesQ.isLoading ? <p>Loading cases…</p> : null}
          {(casesQ.data ?? []).map((item) => (
            <button key={item.id} type="button" className={`discipline-admin__case ${selected?.id === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}>
              <strong>#{item.id} · {item.category.replaceAll('_', ' ')}</strong>
              <span>{item.summary}</span>
              <small>{item.status} · {item.confidentiality}</small>
            </button>
          ))}
          {!casesQ.isLoading && (casesQ.data ?? []).length === 0 ? <p className="muted">No reported cases yet.</p> : null}
        </div>
        {selected ? (
          <form className="discipline-admin__decision" onSubmit={(event) => { event.preventDefault(); save() }}>
            <h2>Case #{selected.id}</h2>
            <p><strong>Fixture:</strong> {matchLabel(match)}</p>
            <p><strong>Report:</strong> {selected.summary}</p>
            {selected.evidence_notes ? <p className="discipline-admin__evidence">{selected.evidence_notes}</p> : null}
            <label>Case status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="under_review">Under review</option><option value="decided">Decided (appeal open)</option><option value="appealed">Appealed</option><option value="final">Final</option><option value="dismissed">Dismissed</option></select></label>
            <label>Private decision<textarea value={decisionText} onChange={(event) => setDecisionText(event.target.value)} rows={4} /></label>
            <label>Public result note<textarea value={publicSummary} onChange={(event) => setPublicSummary(event.target.value)} rows={2} placeholder="Safe public wording only" /></label>
            <fieldset><legend>Official match outcome</legend>
              <label>Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">No result change</option><option value="win">Awarded win</option><option value="tie">Tie</option><option value="no_result">No result</option></select></label>
              {outcome === 'win' ? <label>Awarded to<select value={winnerId} onChange={(event) => setWinnerId(event.target.value)}><option value="">Choose team</option>{involvedTeams.map((id) => <option key={id} value={id}>Team #{id}</option>)}</select></label> : null}
              {outcome ? <label>Result wording<input value={marginText} onChange={(event) => setMarginText(event.target.value)} placeholder="Match awarded following official determination" /></label> : null}
              <p className="muted small">Administrative outcomes are excluded from NRR.</p>
            </fieldset>
            <fieldset><legend>Add sanction or adjustment</legend>
              <label>Action<select value={sanctionType} onChange={(event) => setSanctionType(event.target.value)}><option value="none">No sanction</option><option value="warning">Warning</option><option value="reprimand">Reprimand</option><option value="fine">Fine</option><option value="points_deduction">Points adjustment</option><option value="player_suspension">Player suspension</option><option value="venue_hosting_suspension">Venue hosting suspension</option><option value="eligibility_ruling">Eligibility ruling</option></select></label>
              <label>Team<select value={sanctionTeamId} onChange={(event) => setSanctionTeamId(event.target.value)}><option value="">None</option>{involvedTeams.map((id) => <option key={id} value={id}>Team #{id}</option>)}</select></label>
              <label>Points +/−<input type="number" value={pointsDelta} onChange={(event) => setPointsDelta(event.target.value)} /></label>
              <label>Fine<input type="number" min="0" value={fineAmount} onChange={(event) => setFineAmount(event.target.value)} /></label>
              <label>Currency<input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} maxLength={8} /></label>
              <label>Sanction note<input value={sanctionNotes} onChange={(event) => setSanctionNotes(event.target.value)} /></label>
            </fieldset>
            {selected.sanctions.length ? <p className="muted small">Current actions: {selected.sanctions.map((item) => item.sanction_type.replaceAll('_', ' ')).join(', ')}</p> : null}
            {saveMutation.error ? <p className="form-error">{saveMutation.error.message}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save determination'}</button>
          </form>
        ) : null}
      </div>
    </section>
  )
}
