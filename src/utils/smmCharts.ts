import type { SmmMetricKey, SmmMetricsReport } from '@/types/smmMetrics.types'
import { SMM_METRIC_KEYS, SMM_METRIC_LABELS } from '@/types/smmMetrics.types'

export function formatMetric(n: number): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}K`
  return new Intl.NumberFormat('ru-RU').format(n)
}

export function monthKeysBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  const out: string[] = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    if (out.length > 36) break
  }
  return out
}

export function seriesForMetric(
  reports: SmmMetricsReport[],
  metric: SmmMetricKey,
  months: string[],
): number[] {
  const byMonth = new Map(reports.map((r) => [r.monthKey, Number(r[metric]) || 0]))
  return months.map((m) => byMonth.get(m) || 0)
}

export function buildSparkPath(values: number[], width: number, height: number): string {
  if (!values.length) return ''
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const range = Math.max(1, max - min)
  const step = values.length > 1 ? width / (values.length - 1) : width
  return values
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export { SMM_METRIC_KEYS, SMM_METRIC_LABELS }
