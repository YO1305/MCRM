import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Brain, Play } from 'lucide-react'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useAiConfig } from '@/hooks/useAiConfig'
import { useUsers } from '@/hooks/useUsers'
import { useClients } from '@/hooks/useClients'
import { useAiTasks } from '@/hooks/useAiTasks'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { db } from '@/firebase/config'
import { getDocument } from '@/firebase/firestore'
import { runAiPromptTest } from '@/firebase/callable'
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_PROMPT_TEMPLATE,
  GROQ_MODEL_OPTIONS,
  PROMPT_VARIABLES,
  type AiConfig,
} from '@/types/aiConfig.types'
import type { Client, ClientHistoryEntry } from '@/types/client.types'
import { buildPromptFromTemplate } from '@/utils/aiPrompt'
import { calculateActiveMonths, daysSinceMovement, daysSinceTouch } from '@/utils/dateUtils'
import { resolveOpenedMonth } from '@/utils/leadActivity'
import { stageLabel } from '@/constants/clientStages'
import { todayISO, toISODate } from '@/utils/dates'
import { POSITION_LABELS } from '@/constants/positions'

type TabId = 'main' | 'prompt' | 'managers' | 'history'

function formatWhen(value: unknown): string {
  if (!value) return '—'
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toLocaleString('ru-RU')
  }
  return String(value)
}

export function AiSettings() {
  const { user, isAdmin } = useAuth()
  const { config, loading, changeLog, saveConfig, resetToDefaults } = useAiConfig()
  const { users } = useUsers(isAdmin)
  const { clients } = useClients()
  const { tasks: aiTasks } = useAiTasks()

  const [tab, setTab] = useState<TabId>('main')
  const [form, setForm] = useState<AiConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [testClientId, setTestClientId] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{
    taskText?: string
    promptSent?: string
    tokensUsed?: number
    error?: string
  } | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [managerMode, setManagerMode] = useState<'all' | 'selected'>('all')

  useEffect(() => {
    if (!config) return
    setForm({ ...config })
    setManagerMode(config.enabledForManagers.length ? 'selected' : 'all')
  }, [config])

  const leadManagers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.isActive !== false &&
          (u.position === 'leads_manager_1' ||
            u.position === 'leads_manager_2' ||
            u.role === 'admin'),
      ),
    [users],
  )

  const todayStats = useMemo(() => {
    const today = todayISO()
    const isToday = (value: unknown) => {
      if (!value) return false
      if (typeof value === 'object' && value !== null && 'seconds' in value) {
        return toISODate(new Date((value as { seconds: number }).seconds * 1000)) === today
      }
      return false
    }
    const map = new Map<string, { name: string; total: number; done: number; snoozed: number }>()
    for (const t of aiTasks) {
      if (!isToday(t.generatedAt) && t.status !== 'pending') continue
      const row = map.get(t.assignedTo) || {
        name: t.assignedToName || 'Менеджер',
        total: 0,
        done: 0,
        snoozed: 0,
      }
      row.total += 1
      if (t.status === 'done') row.done += 1
      if (t.status === 'snoozed') row.snoozed += 1
      map.set(t.assignedTo, row)
    }
    return [...map.values()]
  }, [aiTasks])

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Доступ только для администратора.</p>
        <Link to="/settings" className="text-sm text-secondary hover:underline">
          ← Настройки
        </Link>
      </div>
    )
  }

  if (loading || !form) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  function patchForm(partial: Partial<AiConfig>) {
    setForm((prev) => (prev ? { ...prev, ...partial } : prev))
    setMsg('')
  }

  async function handleSave(partial?: Partial<AiConfig>) {
    if (!form) return
    setSaving(true)
    setMsg('')
    try {
      const payload = partial || {
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        touchThresholdDays: form.touchThresholdDays,
        movementThresholdDays: form.movementThresholdDays,
        waitChaseMinDays: form.waitChaseMinDays,
        maxActiveMonths: form.maxActiveMonths,
        promptTemplate: form.promptTemplate,
        isActive: form.isActive,
        enabledForManagers: managerMode === 'all' ? [] : form.enabledForManagers,
        runHour: form.runHour,
      }
      await saveConfig(payload)
      setMsg('Сохранено')
    } catch (err) {
      console.error(err)
      setMsg(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!form || !testClientId) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const client = await getDocument<Client>('clients', testClientId)
      if (!client) throw new Error('Клиент не найден')

      const histQ = query(
        collection(db, 'client_history'),
        where('clientId', '==', testClientId),
        orderBy('createdAt', 'desc'),
        limit(5),
      )
      const histSnap = await getDocs(histQ)
      const history = histSnap.docs.map((d) => d.data() as ClientHistoryEntry)
      const today = new Date()
      const recentHistory = history.map((h) => ({
        type: h.type,
        text: h.text,
        authorName: h.authorName,
        date: (() => {
          const sec = (h.createdAt as { seconds?: number } | null)?.seconds
          return sec ? toISODate(new Date(sec * 1000)) : todayISO()
        })(),
      }))
      const snapshot = {
        clientName: client.name,
        company: client.company || '',
        category: client.category || '',
        stage: stageLabel(client.stage),
        waitStatus: client.waitStatus || null,
        nextStep: client.nextStep || null,
        nextStepDeadline: client.nextStepDeadline || null,
        daysSinceTouch: daysSinceTouch(client, today, { historyDate: recentHistory[0]?.date }),
        daysSinceMovement: daysSinceMovement(client, today),
        activeMonthsCount: calculateActiveMonths(resolveOpenedMonth(client)),
        recentHistory,
      }

      const prompt = buildPromptFromTemplate(form.promptTemplate, snapshot, form)
      const result = await runAiPromptTest({
        prompt,
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
      })
      setTestResult({
        taskText: result.taskText,
        promptSent: prompt,
        tokensUsed: result.tokensUsed,
      })
      setShowPrompt(false)
    } catch (err) {
      console.error(err)
      setTestResult({
        error: err instanceof Error ? err.message : 'Ошибка теста Groq',
      })
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/settings"
            className="mb-2 inline-flex items-center gap-1 text-sm text-secondary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Настройки
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-text">
            <Brain className="h-6 w-6 text-violet-600" />
            ИИ Помощник
          </h1>
          <p className="mt-1 text-sm text-muted">Настройки Groq · промпт, пороги, менеджеры</p>
        </div>
        <div className="text-right text-sm">
          <Badge variant={form.isActive ? 'success' : 'default'}>
            {form.isActive ? 'Активен' : 'Отключён'}
          </Badge>
          <p className="mt-1 text-xs text-muted">
            Изменил: {config?.updatedBy || '—'} · {formatWhen(config?.updatedAt)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['main', 'Основные'],
            ['prompt', 'Промпт'],
            ['managers', 'Менеджеры'],
            ['history', 'История'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === id ? 'bg-primary text-white' : 'bg-surface text-muted shadow-sm'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{msg}</p>
      )}

      {tab === 'main' && (
        <Card className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Модель и параметры
            </h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-text">Модель Groq</span>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
                  value={form.model}
                  onChange={(e) => patchForm({ model: e.target.value })}
                >
                  {GROQ_MODEL_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.hint}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label={`Температура (${form.temperature}) — 0 строго, 1 творчески`}
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={String(form.temperature)}
                onChange={(e) => patchForm({ temperature: Number(e.target.value) })}
              />
              <Input
                label="Длина ответа (токены)"
                type="number"
                min={50}
                max={300}
                value={String(form.maxTokens)}
                onChange={(e) => patchForm({ maxTokens: Number(e.target.value) })}
              />
              <Input
                label="Время запуска (час по Ташкенту)"
                type="number"
                min={0}
                max={23}
                value={String(form.runHour)}
                onChange={(e) => patchForm({ runHour: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Пороги активности лидов
            </h2>
            <p className="mt-1 text-xs text-muted">
              Эти же числа использует статус Новый / Активный / Заморожен.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Касание раз в (дней)"
                type="number"
                min={1}
                value={String(form.touchThresholdDays)}
                onChange={(e) => patchForm({ touchThresholdDays: Number(e.target.value) })}
              />
              <Input
                label="Движение раз в (дней)"
                type="number"
                min={1}
                value={String(form.movementThresholdDays)}
                onChange={(e) => patchForm({ movementThresholdDays: Number(e.target.value) })}
              />
              <Input
                label="Ждём ответа — ИИ не раньше (дней)"
                type="number"
                min={1}
                max={30}
                value={String(form.waitChaseMinDays)}
                onChange={(e) => patchForm({ waitChaseMinDays: Number(e.target.value) })}
              />
              <Input
                label="Макс. месяцев работы"
                type="number"
                min={1}
                max={12}
                value={String(form.maxActiveMonths)}
                onChange={(e) => patchForm({ maxActiveMonths: Number(e.target.value) })}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Пока стоит «ждём ответа» и дата follow-up менеджера ещё не наступила — ИИ-задачи не
              создаются. Если даты нет, действует порог «не раньше N дней».
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background px-3 py-3">
            <div>
              <p className="text-sm font-medium text-text">ИИ анализ лидов</p>
              <p className="text-xs text-muted">Мастер-переключатель генерации задач</p>
            </div>
            <button
              type="button"
              onClick={() => patchForm({ isActive: !form.isActive })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                form.isActive ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-muted'
              }`}
            >
              {form.isActive ? 'Включён' : 'Выключен'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              Сохранить изменения
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => {
                if (!confirm('Сбросить все настройки ИИ к заводским?')) return
                setForm({ ...DEFAULT_AI_CONFIG })
                setManagerMode('all')
                void resetToDefaults()
                  .then(() => setMsg('Сброшено к умолчанию'))
                  .catch((err) => setMsg(err instanceof Error ? err.message : 'Ошибка'))
              }}
            >
              Сбросить по умолчанию
            </Button>
          </div>
        </Card>
      )}

      {tab === 'prompt' && (
        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-text">Шаблон промпта</h2>
            <p className="mt-1 text-xs text-muted">
              Переменные:{' '}
              {PROMPT_VARIABLES.map((v) => (
                <code key={v} className="mr-1 rounded bg-background px-1">
                  {`{${v}}`}
                </code>
              ))}
            </p>
          </div>
          <Textarea
            label="Промпт"
            rows={18}
            value={form.promptTemplate}
            onChange={(e) => patchForm({ promptTemplate: e.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving}
              onClick={() => void handleSave({ promptTemplate: form.promptTemplate })}
            >
              Сохранить промпт
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => patchForm({ promptTemplate: DEFAULT_PROMPT_TEMPLATE })}
            >
              Сбросить к исходному
            </Button>
            <p className="w-full text-xs text-muted">
              После сброса нажмите «Сохранить промпт». К каждому запросу система добавляет
              правила: не писать от имени менеджера, не генерировать готовое сообщение клиенту —
              только действие «что сделать».
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-text">Тест промпта</h3>
            <p className="mt-1 text-xs text-muted">
              Запуск через сервер (ключ Groq не светится в браузере). Задача в CRM не
              сохраняется.
            </p>
            <label className="mt-3 block text-sm">
              <span className="font-medium">Клиент</span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm"
                value={testClientId}
                onChange={(e) => setTestClientId(e.target.value)}
              >
                <option value="">Выберите клиента…</option>
                {clients
                  .filter((c) => c.stage !== 'deal')
                  .slice(0, 200)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` · ${c.company}` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              type="button"
              className="mt-3"
              disabled={testLoading || !testClientId}
              onClick={() => void handleTest()}
            >
              <Play className="h-4 w-4" />
              {testLoading ? 'Тест…' : 'Запустить тест'}
            </Button>

            {testResult && (
              <div className="mt-4 space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                {testResult.error ? (
                  <p className="text-sm text-danger">{testResult.error}</p>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase text-violet-800">
                      Задача от ИИ
                    </p>
                    <p className="text-sm text-text">{testResult.taskText}</p>
                    {testResult.tokensUsed != null && (
                      <p className="text-xs text-muted">
                        Токенов: {testResult.tokensUsed} / {form.maxTokens}
                      </p>
                    )}
                    <button
                      type="button"
                      className="text-xs font-medium text-secondary hover:underline"
                      onClick={() => setShowPrompt((v) => !v)}
                    >
                      {showPrompt ? 'Скрыть промпт' : 'Показать данные для Groq'}
                    </button>
                    {showPrompt && (
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-muted">
                        {testResult.promptSent}
                      </pre>
                    )}
                    <p className="text-xs text-amber-800">Это тест — задача НЕ сохранена в CRM</p>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'managers' && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Настройки по менеджерам</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setManagerMode('all')
                patchForm({ enabledForManagers: [] })
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                managerMode === 'all' ? 'bg-secondary text-white' : 'bg-background text-muted'
              }`}
            >
              Все менеджеры
            </button>
            <button
              type="button"
              onClick={() => setManagerMode('selected')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                managerMode === 'selected' ? 'bg-secondary text-white' : 'bg-background text-muted'
              }`}
            >
              Только выбранные
            </button>
          </div>

          {managerMode === 'selected' && (
            <ul className="space-y-2">
              {leadManagers.map((u) => {
                const on = form.enabledForManagers.includes(u.id)
                return (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-text">{u.name}</p>
                      <p className="text-xs text-muted">{POSITION_LABELS[u.position]}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = on
                          ? form.enabledForManagers.filter((id) => id !== u.id)
                          : [...form.enabledForManagers, u.id]
                        patchForm({ enabledForManagers: next })
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        on ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-muted'
                      }`}
                    >
                      {on ? 'Включён' : 'Выкл'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <Button
            type="button"
            disabled={saving}
            onClick={() =>
              void handleSave({
                enabledForManagers: managerMode === 'all' ? [] : form.enabledForManagers,
              })
            }
          >
            Сохранить менеджеров
          </Button>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-text">Статистика за сегодня</h3>
            {todayStats.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Пока нет ИИ-задач за сегодня</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {todayStats.map((row) => (
                  <li key={row.name} className="flex justify-between gap-3">
                    <span>{row.name}</span>
                    <span className="text-muted">
                      {row.total} / {row.done} вып. / {row.snoozed} отл.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {tab === 'history' && (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text">История изменений настроек</h2>
          {changeLog.length === 0 ? (
            <p className="text-sm text-muted">Пока пусто</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="px-2 py-2">Дата</th>
                    <th className="px-2 py-2">Кто</th>
                    <th className="px-2 py-2">Поле</th>
                    <th className="px-2 py-2">Было</th>
                    <th className="px-2 py-2">Стало</th>
                  </tr>
                </thead>
                <tbody>
                  {changeLog.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 align-top">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatWhen(row.changedAt || row.createdAt)}
                      </td>
                      <td className="px-2 py-2">{row.changedBy}</td>
                      <td className="px-2 py-2 font-medium">{row.field}</td>
                      <td className="px-2 py-2 max-w-[180px] break-words text-muted">
                        {String(row.oldValue ?? '')}
                      </td>
                      <td className="px-2 py-2 max-w-[180px] break-words">
                        {String(row.newValue ?? '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <p className="text-xs text-muted">
        Вошёл как {user?.name}. Ключ Groq хранится только на сервере (Vercel / Functions).
      </p>
    </div>
  )
}
