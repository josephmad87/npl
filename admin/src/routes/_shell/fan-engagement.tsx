import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { FanEngagementReportDto } from '@/lib/api-types'
import { adminGet, adminPost } from '@/lib/admin-client'
import { PageHeader } from '@/components/PageHeader'

export const Route = createFileRoute('/_shell/fan-engagement')({
  component: FanEngagementPage,
})

const toDateInput = (date: Date) => date.toISOString().slice(0, 10)

function Metric({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return <div className="fan-report__metric"><span>{label}</span><strong>{value}</strong></div>
}

function Ranking({
  title,
  rows,
  valueKey,
}: Readonly<{
  title: string
  rows: Array<Record<string, string | number>>
  valueKey: string
}>) {
  return (
    <section className="fan-report__ranking">
      <h2>{title}</h2>
      {rows.length ? <ol>{rows.map((row) => <li key={String(row.name)}><span>{row.name}</span><strong>{row[valueKey]}</strong></li>)}</ol> : <p className="muted">No activity in this period.</p>}
    </section>
  )
}

function FanEngagementPage() {
  const queryClient = useQueryClient()
  const initialFrom = new Date()
  initialFrom.setDate(initialFrom.getDate() - 30)
  const [fromDate, setFromDate] = useState(toDateInput(initialFrom))
  const [toDate, setToDate] = useState(toDateInput(new Date()))
  const reportQ = useQuery({
    queryKey: ['admin', 'fan-engagement', fromDate, toDate],
    queryFn: () => adminGet<FanEngagementReportDto>(`/admin/fan-engagement/report?from_date=${fromDate}T00:00:00Z&to_date=${toDate}T23:59:59Z`),
  })
  const processNotifications = useMutation({
    mutationFn: () => adminPost<{ queued: number; sent: number; failed: number }>('/admin/fan-engagement/notifications/process', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'fan-engagement'] }),
  })
  const report = reportQ.data

  return (
    <>
      <PageHeader
        title="Fan engagement"
        description="Consent-aware supporter, notification, voting and merchandise performance."
        actions={<button type="button" className="btn-primary" onClick={() => processNotifications.mutate()} disabled={processNotifications.isPending}>{processNotifications.isPending ? 'Processing…' : 'Process notifications'}</button>}
      />
      <div className="table-toolbar fan-report__filters">
        <label>From<input className="admin-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To<input className="admin-input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      </div>
      {processNotifications.data ? <p className="success-message" role="status">Queued {processNotifications.data.queued}, sent {processNotifications.data.sent}, failed {processNotifications.data.failed}.</p> : null}
      {reportQ.isLoading ? <p className="muted">Loading report…</p> : reportQ.isError ? <p className="form-error">{reportQ.error.message}</p> : report ? (
        <div className="fan-report">
          <section className="fan-report__metrics" aria-label="Fan engagement metrics">
            <Metric label="New supporters" value={report.supporter_accounts} />
            <Metric label="Push opt-ins" value={report.push_opt_ins} />
            <Metric label="Marketing opt-ins" value={report.marketing_opt_ins} />
            <Metric label="Team follows" value={report.team_follows} />
            <Metric label="Player follows" value={report.player_follows} />
            <Metric label="Fan votes" value={report.votes} />
            <Metric label="Notifications sent" value={report.notifications_sent} />
            <Metric label="Notification opens" value={report.notification_opens} />
            <Metric label="Product views" value={report.product_views} />
            <Metric label="Orders" value={report.orders_submitted} />
            <Metric label="Fulfilled" value={report.orders_fulfilled} />
            <Metric label="Order conversion" value={`${report.order_conversion_rate}%`} />
          </section>
          <div className="fan-report__rankings">
            <Ranking title="Most-followed teams" rows={report.top_followed_teams} valueKey="follows" />
            <Ranking title="Most-followed players" rows={report.top_followed_players} valueKey="follows" />
            <Ranking title="Top products" rows={report.top_products} valueKey="orders" />
          </div>
        </div>
      ) : null}
    </>
  )
}
