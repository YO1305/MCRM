import { useEffect, useMemo, useState } from 'react'
import {
  subscribeToCollection,
  setDocument,
  removeDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { SmmTeam } from '@/types/smm.types'
import type {
  SmmMetricKey,
  SmmMetricsReport,
  SmmPlatform,
} from '@/types/smmMetrics.types'
import { metricsDocId, SMM_METRIC_KEYS } from '@/types/smmMetrics.types'

export function useSmmMetrics() {
  const { user, isAdmin } = useAuth()
  const canManage =
    isAdmin || user?.position === 'head' || user?.position === 'leads_manager_1'

  const [reports, setReports] = useState<SmmMetricsReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !canManage) {
      setReports([])
      setLoading(false)
      return
    }
    return subscribeToCollection<SmmMetricsReport>(
      'smm_metrics',
      [],
      (data) => {
        setReports(
          [...data].sort(
            (a, b) =>
              (b.monthKey || '').localeCompare(a.monthKey || '') ||
              a.teamName.localeCompare(b.teamName, 'ru'),
          ),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user, canManage])

  async function saveReport(input: {
    team: SmmTeam
    platform: SmmPlatform
    monthKey: string
    values: Record<SmmMetricKey, number>
    note?: string
  }) {
    if (!user || !canManage) throw new Error('Нет доступа')
    const id = metricsDocId(input.team.id, input.platform, input.monthKey)
    const payload: Record<string, unknown> = {
      teamId: input.team.id,
      teamName: input.team.name,
      platform: input.platform,
      monthKey: input.monthKey,
      note: (input.note || '').trim(),
      createdBy: user.id,
      createdByName: user.name,
    }
    for (const key of SMM_METRIC_KEYS) {
      payload[key] = Math.max(0, Number(input.values[key]) || 0)
    }
    await setDocument('smm_metrics', id, payload)
  }

  async function deleteReport(id: string) {
    if (!canManage) throw new Error('Нет доступа')
    await removeDocument('smm_metrics', id)
  }

  function findReport(teamId: string, platform: SmmPlatform, monthKey: string) {
    return reports.find(
      (r) => r.teamId === teamId && r.platform === platform && r.monthKey === monthKey,
    )
  }

  const byTeamMonth = useMemo(() => {
    const map = new Map<string, SmmMetricsReport[]>()
    for (const r of reports) {
      const key = `${r.teamId}|${r.monthKey}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    return map
  }, [reports])

  return {
    reports,
    loading,
    canManage,
    saveReport,
    deleteReport,
    findReport,
    byTeamMonth,
  }
}
