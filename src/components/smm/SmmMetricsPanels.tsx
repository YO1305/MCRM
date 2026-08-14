import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Expand, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useSmmMetrics } from '@/hooks/useSmmMetrics'
import type { SmmTeam } from '@/types/smm.types'
import {
  emptyMetricsValues,
  SMM_METRIC_KEYS,
  SMM_METRIC_LABELS,
  SMM_PLATFORM_LABELS,
  type SmmMetricKey,
  type SmmMetricsReport,
  type SmmPlatform,
} from '@/types/smmMetrics.types'
import {
  buildSparkPath,
  formatMetric,
  monthKeysBetween,
  seriesForMetric,
} from '@/utils/smmCharts'
import { getCurrentMonth } from '@/utils/dates'

function monthLabel(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'short',
    year: 'numeric',
  })
}

function monthOptions(count = 18) {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

function Fullscreen({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 bg-surface px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted">СММ · аналитика</p>
          <h2 className="truncate text-xl font-bold text-text">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          Закрыть
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</div>
    </div>
  )
}

function MiniChart({ values, color = '#0d9488' }: { values: number[]; color?: string }) {
  const w = 160
  const h = 48
  const path = buildSparkPath(values, w, h)
  const max = Math.max(1, ...values)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-full" preserveAspectRatio="none">
      {values.map((v, i) => {
        const barW = w / Math.max(values.length, 1) - 2
        const x = (i * w) / Math.max(values.length, 1) + 1
        const barH = (v / max) * (h - 4)
        return (
          <rect
            key={i}
            x={x}
            y={h - barH - 1}
            width={Math.max(2, barW)}
            height={barH}
            rx={1}
            fill={color}
            opacity={0.35}
          />
        )
      })}
      {path && (
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      )}
    </svg>
  )
}

function BigChart({
  values,
  months,
  color = '#0d9488',
}: {
  values: number[]
  months: string[]
  color?: string
}) {
  const w = 640
  const h = 180
  const path = buildSparkPath(values, w, h - 24)
  const max = Math.max(1, ...values)
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full">
        {[0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={0}
            x2={w}
            y1={h - 24 - p * (h - 28)}
            y2={h - 24 - p * (h - 28)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        ))}
        {values.map((v, i) => {
          const barW = w / Math.max(values.length, 1) - 6
          const x = (i * w) / Math.max(values.length, 1) + 3
          const barH = (v / max) * (h - 32)
          return (
            <g key={i}>
              <rect
                x={x}
                y={h - 24 - barH}
                width={Math.max(4, barW)}
                height={barH}
                rx={3}
                fill={color}
                opacity={0.25}
              />
              <text
                x={x + barW / 2}
                y={h - 8}
                textAnchor="middle"
                className="fill-gray-400"
                fontSize={10}
              >
                {months[i]?.slice(5) || ''}
              </text>
            </g>
          )
        })}
        {path && (
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            transform="translate(0,0)"
          />
        )}
      </svg>
      <p className="text-center text-xs text-muted">
        Макс: {formatMetric(max)} · точек: {values.length}
      </p>
    </div>
  )
}

export function SmmMetricsTab({ teams }: { teams: SmmTeam[] }) {
  const metrics = useSmmMetrics()
  const [teamId, setTeamId] = useState(teams[0]?.id || '')
  const [month, setMonth] = useState(getCurrentMonth())
  const [platform, setPlatform] = useState<SmmPlatform>('instagram')
  const [values, setValues] = useState(emptyMetricsValues())
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const team = teams.find((t) => t.id === teamId) || null
  const existing = teamId
    ? metrics.findReport(teamId, platform, month)
    : undefined

  useEffect(() => {
    if (existing) {
      setValues({
        views: existing.views || 0,
        reach: existing.reach || 0,
        subscribers: existing.subscribers || 0,
        newSubscribers: existing.newSubscribers || 0,
        interactions: existing.interactions || 0,
      })
      setNote(existing.note || '')
    } else {
      setValues(emptyMetricsValues())
      setNote('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when selection changes
  }, [existing?.id, teamId, platform, month])

  useEffect(() => {
    if (!teamId && teams[0]) setTeamId(teams[0].id)
  }, [teams, teamId])

  async function save() {
    if (!team) return
    setBusy(true)
    try {
      await metrics.saveReport({ team, platform, monthKey: month, values, note })
    } finally {
      setBusy(false)
    }
  }

  const teamReports = useMemo(
    () =>
      metrics.reports.filter(
        (r) => (!teamId || r.teamId === teamId) && r.platform === platform,
      ),
    [metrics.reports, teamId, platform],
  )

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-text">Показатели за месяц</h2>
          <p className="text-xs text-muted">
            Введите отчёт по аккаунту команды. Instagram: просмотры, охват, подписчики,
            новые подписчики, взаимодействия.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Команда</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Платформа</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SmmPlatform)}
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
            >
              {(Object.keys(SMM_PLATFORM_LABELS) as SmmPlatform[]).map((p) => (
                <option key={p} value={p}>
                  {SMM_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="month"
            label="Месяц"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SMM_METRIC_KEYS.map((key) => (
            <Input
              key={key}
              type="number"
              min={0}
              label={SMM_METRIC_LABELS[key]}
              value={String(values[key] || '')}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: Number(e.target.value) || 0 }))
              }
            />
          ))}
        </div>

        <Input
          label="Комментарий"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="необязательно"
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !team} onClick={() => void save()}>
            {existing ? 'Обновить отчёт' : 'Сохранить отчёт'}
          </Button>
          {existing && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm('Удалить отчёт за этот месяц?')) {
                  void metrics.deleteReport(existing.id)
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          )}
          {existing && <Badge variant="success">Есть данные за месяц</Badge>}
        </div>
      </Card>

      <Card className="overflow-hidden !p-0">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-text">Сохранённые отчёты</h3>
        </div>
        {teamReports.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Пока нет отчётов</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-background text-xs uppercase text-muted">
                  <th className="px-3 py-2">Месяц</th>
                  <th className="px-3 py-2">Команда</th>
                  <th className="px-3 py-2">Платформа</th>
                  {SMM_METRIC_KEYS.map((k) => (
                    <th key={k} className="px-3 py-2">
                      {SMM_METRIC_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamReports.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-gray-50 hover:bg-background"
                    onClick={() => {
                      setTeamId(r.teamId)
                      setPlatform(r.platform)
                      setMonth(r.monthKey)
                    }}
                  >
                    <td className="px-3 py-2 font-medium text-text">{monthLabel(r.monthKey)}</td>
                    <td className="px-3 py-2 text-muted">{r.teamName}</td>
                    <td className="px-3 py-2 text-muted">
                      {SMM_PLATFORM_LABELS[r.platform]}
                    </td>
                    {SMM_METRIC_KEYS.map((k) => (
                      <td key={k} className="px-3 py-2 text-muted">
                        {formatMetric(Number(r[k]) || 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

const CHART_COLORS = ['#0d9488', '#2563eb', '#d97706', '#db2777', '#7c3aed']

export function SmmAnalyticsTab({ teams }: { teams: SmmTeam[] }) {
  const { reports, loading } = useSmmMetrics()
  const months = monthOptions(12)
  const [from, setFrom] = useState(months[Math.min(5, months.length - 1)] || getCurrentMonth())
  const [to, setTo] = useState(months[0] || getCurrentMonth())
  const [teamId, setTeamId] = useState<string>('all')
  const [platform, setPlatform] = useState<SmmPlatform>('instagram')
  const [selectedMetrics, setSelectedMetrics] = useState<SmmMetricKey[]>([...SMM_METRIC_KEYS])
  const [fullTeamId, setFullTeamId] = useState<string | null>(null)

  const periodMonths = useMemo(() => {
    const a = from <= to ? from : to
    const b = from <= to ? to : from
    return monthKeysBetween(a, b)
  }, [from, to])

  const filteredTeams = useMemo(() => {
    if (teamId === 'all') return teams.filter((t) => t.isActive !== false)
    return teams.filter((t) => t.id === teamId)
  }, [teams, teamId])

  function reportsForTeam(tid: string): SmmMetricsReport[] {
    return reports.filter(
      (r) =>
        r.teamId === tid &&
        r.platform === platform &&
        periodMonths.includes(r.monthKey),
    )
  }

  function toggleMetric(key: SmmMetricKey) {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    )
  }

  const fullTeam = teams.find((t) => t.id === fullTeamId) || null
  const fullReports = fullTeamId ? reportsForTeam(fullTeamId) : []

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-text">Аналитика аккаунтов</h2>
          <p className="text-xs text-muted">
            Сводные графики по командам. Выберите период и показатели — откройте карточку во
            весь экран для детализации.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input type="month" label="С" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="month" label="По" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Команда</label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
            >
              <option value="all">Все команды</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Платформа</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SmmPlatform)}
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
            >
              {(Object.keys(SMM_PLATFORM_LABELS) as SmmPlatform[]).map((p) => (
                <option key={p} value={p}>
                  {SMM_PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={selectedMetrics.length === SMM_METRIC_KEYS.length ? 'secondary' : 'ghost'}
            onClick={() => setSelectedMetrics([...SMM_METRIC_KEYS])}
          >
            Все показатели
          </Button>
          {SMM_METRIC_KEYS.map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={selectedMetrics.includes(k) ? 'secondary' : 'ghost'}
              onClick={() => toggleMetric(k)}
            >
              {SMM_METRIC_LABELS[k]}
            </Button>
          ))}
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : filteredTeams.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Нет команд</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team) => {
            const teamReports = reportsForTeam(team.id)
            const metricsToShow =
              selectedMetrics.length > 0 ? selectedMetrics : SMM_METRIC_KEYS
            return (
              <Card key={team.id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-text">{team.name}</h3>
                    <p className="text-xs text-muted">
                      {SMM_PLATFORM_LABELS[platform]} · {periodMonths.length} мес.
                      {teamReports.length
                        ? ` · отчётов: ${teamReports.length}`
                        : ' · нет данных'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFullTeamId(team.id)}
                  >
                    <Expand className="h-3.5 w-3.5" />
                    Экран
                  </Button>
                </div>

                <div className="space-y-3">
                  {metricsToShow.slice(0, 3).map((metric, idx) => {
                    const series = seriesForMetric(teamReports, metric, periodMonths)
                    const last = series[series.length - 1] || 0
                    return (
                      <div key={metric} className="rounded-lg bg-background px-3 py-2">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-muted">{SMM_METRIC_LABELS[metric]}</span>
                          <span className="font-semibold text-text">{formatMetric(last)}</span>
                        </div>
                        <MiniChart values={series} color={CHART_COLORS[idx % CHART_COLORS.length]} />
                      </div>
                    )
                  })}
                  {metricsToShow.length > 3 && (
                    <p className="text-xs text-muted">
                      + ещё {metricsToShow.length - 3} показателя — откройте во весь экран
                    </p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {fullTeam && (
        <Fullscreen
          title={fullTeam.name}
          subtitle={`${SMM_PLATFORM_LABELS[platform]} · ${monthLabel(periodMonths[0] || '')} — ${monthLabel(periodMonths[periodMonths.length - 1] || '')}`}
          onClose={() => setFullTeamId(null)}
        >
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
            {(selectedMetrics.length ? selectedMetrics : SMM_METRIC_KEYS).map((metric, idx) => {
              const series = seriesForMetric(fullReports, metric, periodMonths)
              const last = series[series.length - 1] || 0
              const prev = series.length > 1 ? series[series.length - 2] : 0
              const delta = last - prev
              return (
                <Card key={metric} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-text">
                        {SMM_METRIC_LABELS[metric]}
                      </h3>
                      <p className="text-2xl font-bold text-text">{formatMetric(last)}</p>
                      {series.length > 1 && (
                        <p
                          className={`text-xs ${
                            delta >= 0 ? 'text-emerald-600' : 'text-danger'
                          }`}
                        >
                          {delta >= 0 ? '+' : ''}
                          {formatMetric(delta)} к пред. месяцу
                        </p>
                      )}
                    </div>
                    <Badge variant="info">{SMM_PLATFORM_LABELS[platform]}</Badge>
                  </div>
                  <BigChart
                    values={series}
                    months={periodMonths}
                    color={CHART_COLORS[idx % CHART_COLORS.length]}
                  />
                </Card>
              )
            })}
          </div>
        </Fullscreen>
      )}
    </div>
  )
}
