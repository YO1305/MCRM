import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { useAiActivityConfig } from '@/hooks/useAiActivityConfig'
import { useClients } from '@/hooks/useClients'
import { runActivityAnalysisNow } from '@/firebase/callable'
import { DEFAULT_ACTIVITY_PROMPT, GROQ_ACTIVITY_LABELS } from '@/types/aiActivity.types'
import type { GroqActivityLabel } from '@/types/aiActivity.types'

export function AiActivitySettings() {
  const { config, loading, saveConfig } = useAiActivityConfig()
  const { clients } = useClients()
  const [minActiveDays, setMinActiveDays] = useState(10)
  const [activityPrompt, setActivityPrompt] = useState(DEFAULT_ACTIVITY_PROMPT)
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState('')
  const [testClientId, setTestClientId] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    label?: GroqActivityLabel
    score?: number
    reason?: string
    activeDaysCount?: number
    minActiveDays?: number
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!config) return
    setMinActiveDays(config.minActiveDays)
    setActivityPrompt(config.activityPrompt)
    setIsActive(config.isActive)
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
        minActiveDays: Math.max(1, Number(minActiveDays) || 10),
        activityPrompt,
        isActive,
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
        test: true,
        clientId: testClientId,
        activityPrompt,
        minActiveDays: Math.max(1, Number(minActiveDays) || 10),
      })
      if (!data.result) throw new Error('Пустой ответ анализа')
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
    setMsg('')
    try {
      const result = await runActivityAnalysisNow({ force: true })
      setMsg(
        `Анализ: обработано ${result.processed || 0}` +
          (result.remaining ? `, осталось ${result.remaining} — нажмите ещё раз` : ''),
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
          Настройки активности лидов
        </h2>
        <p className="mt-1 text-sm text-muted">
          Groq читает историю за месяц и ставит статус: активный / пассивный / на паузе. KPI с
          этапов больше не фиксируется.
        </p>
      </div>

      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>}

      <Input
        label="Минимум дней активности в месяц"
        type="number"
        min={1}
        max={31}
        value={String(minActiveDays)}
        onChange={(e) => setMinActiveDays(Number(e.target.value))}
      />
      <p className="text-xs text-muted">
        Лид считается активным, если в этом месяце было минимум столько дней с реальными
        действиями (Groq может повысить или понизить по содержанию записей).
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Анализ активности (Groq) включён
      </label>

      <Textarea
        label="Промпт для анализа активности"
        rows={16}
        value={activityPrompt}
        onChange={(e) => setActivityPrompt(e.target.value)}
      />

      <div className="space-y-2 rounded-lg border border-gray-100 bg-background p-3">
        <h3 className="text-sm font-semibold text-text">Тест</h3>
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
        {testResult && !testResult.error && testResult.label && (
          <div className="rounded-lg bg-surface px-3 py-2 text-sm">
            <p>
              Статус:{' '}
              <Badge
                variant={
                  testResult.label === 'active'
                    ? 'success'
                    : testResult.label === 'passive'
                      ? 'warning'
                      : 'default'
                }
              >
                {GROQ_ACTIVITY_LABELS[testResult.label]}
              </Badge>
            </p>
            <p className="mt-1">Оценка: {testResult.score}/100</p>
            <p className="mt-1 text-muted">{testResult.reason}</p>
            <p className="mt-1 text-xs text-muted">
              Дней активности: {testResult.activeDaysCount} из {testResult.minActiveDays} нужных
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '…' : 'Сохранить настройки'}
        </Button>
        <Button type="button" variant="secondary" disabled={running} onClick={() => void handleRunNow()}>
          {running ? 'Анализ…' : 'Запустить анализ сейчас'}
        </Button>
      </div>
    </Card>
  )
}
