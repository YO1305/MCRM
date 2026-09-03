import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { useAiActivityConfig } from '@/hooks/useAiActivityConfig'
import { useClients } from '@/hooks/useClients'
import { runActivityAnalysisNow, runActivityAnalysisUntilDone } from '@/firebase/callable'
import { DEFAULT_KPI_PROMPT } from '@/types/aiActivity.types'
import { getCurrentMonth } from '@/utils/dates'
import { formatMonthNominative } from '@/utils/groqLeadActivity'

export function AiKpiSettings() {
  const { config, loading, saveConfig } = useAiActivityConfig()
  const { clients } = useClients()
  const [minKpiMoments, setMinKpiMoments] = useState(3)
  const [kpiPrompt, setKpiPrompt] = useState(DEFAULT_KPI_PROMPT)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [runMonth, setRunMonth] = useState(getCurrentMonth())
  const [msg, setMsg] = useState('')
  const [testClientId, setTestClientId] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    significantMoments?: number
    qualifies?: boolean
    reason?: string
    minKpiMoments?: number
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!config) return
    setMinKpiMoments(config.minKpiMoments)
    setKpiPrompt(config.kpiPrompt)
  }, [config])

  if (loading || !config) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      await saveConfig({
        minKpiMoments: Math.max(1, Number(minKpiMoments) || 3),
        kpiPrompt,
      })
      setMsg('Сохранено')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!testClientId) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const data = await runActivityAnalysisNow({
        testKpi: true,
        clientId: testClientId,
        kpiPrompt,
        minKpiMoments: Math.max(1, Number(minKpiMoments) || 3),
      })
      if (!data.result) throw new Error('Пустой ответ')
      setTestResult(data.result)
    } catch (err) {
      setTestResult({
        error: err instanceof Error ? err.message : 'Ошибка теста Groq',
      })
    } finally {
      setTestLoading(false)
    }
  }

  async function handleRunNow() {
    setRunning(true)
    setMsg('Запускаю полный прогон…')
    try {
      const result = await runActivityAnalysisUntilDone({
        month: runMonth,
        onProgress: (info) => {
          setMsg(
            info.remaining > 0
              ? `Идёт ${formatMonthNominative(info.month || runMonth)}: сделано ${info.processed}, в очереди ${info.remaining}`
              : `Дописываю… ${info.processed}`,
          )
        },
      })
      setMsg(
        result.remaining
          ? `Остановка: ${result.processed}, не успели ${result.remaining}. Нажмите ещё раз.`
          : `Готово за ${formatMonthNominative(result.month || runMonth)}: все ${result.processed || 0} карточек`,
      )
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Не удалось запустить анализ')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          KPI квалификация
        </h2>
        <p className="mt-1 text-sm text-muted">
          Из активных лидов программа считает шаги менеджера по клиенту (КП, звонок, образцы, этап,
          комментарий). Три шага — KPI-лид. ИИ это не решает.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <Input
        label="Минимум шагов менеджера по клиенту"
        type="number"
        min={1}
        max={10}
        value={String(minKpiMoments)}
        onChange={(e) => setMinKpiMoments(Number(e.target.value))}
      />
      <p className="text-xs text-muted">
        Сколько рабочих записей в Истории нужно, чтобы лид попал в факт KPI. КП, звонок, образцы,
        этап — всё считается. Фразы от клиента не нужны. 4-й месяц — нет. Сделка в 1-м месяце —
        сразу.
      </p>

      <Textarea
        label="Правило отбора (программа считает сама, ИИ не решает)"
        rows={10}
        value={kpiPrompt}
        onChange={(e) => setKpiPrompt(e.target.value)}
      />

      <div className="space-y-2 rounded-lg border border-gray-100 bg-background p-3">
        <h3 className="text-sm font-semibold text-text">Тест отбора</h3>
        <select
          className="w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
          value={testClientId}
          onChange={(e) => setTestClientId(e.target.value)}
        >
          <option value="">Выбери клиента…</option>
          {clients
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <Button type="button" size="sm" disabled={!testClientId || testLoading} onClick={() => void handleTest()}>
          {testLoading ? 'Считаю…' : 'Запустить тест'}
        </Button>
        {testResult?.error && <p className="text-sm text-danger">{testResult.error}</p>}
        {testResult && !testResult.error && typeof testResult.significantMoments === 'number' && (
          <div className="rounded-lg bg-surface px-3 py-2 text-sm">
            <p>
              Квалифицирован:{' '}
              <Badge variant={testResult.qualifies ? 'success' : 'default'}>
                {testResult.qualifies ? 'ДА' : 'НЕТ'}
              </Badge>
            </p>
            <p className="mt-1">
              Весомых моментов: {testResult.significantMoments} из {testResult.minKpiMoments ?? minKpiMoments}
            </p>
            <p className="mt-1 text-muted">{testResult.reason}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '…' : 'Сохранить настройки'}
        </Button>
        <select
          value={runMonth}
          onChange={(e) => setRunMonth(e.target.value)}
          disabled={running}
          className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
        >
          {Array.from({ length: 12 }, (_, i) => {
            const d = new Date()
            d.setDate(1)
            d.setMonth(d.getMonth() - i)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            return (
              <option key={key} value={key}>
                {formatMonthNominative(key)} {key.slice(0, 4)}
              </option>
            )
          })}
        </select>
        <Button type="button" variant="secondary" disabled={running} onClick={() => void handleRunNow()}>
          {running ? 'Анализ…' : 'Прогнать все карточки за месяц'}
        </Button>
      </div>
    </Card>
  )
}
