export type GroqActivityLabel = 'active' | 'passive' | 'paused'

export interface AiActivityConfig {
  minActiveDays: number
  activityPrompt: string
  isActive: boolean
  minKpiMoments: number
  kpiPrompt: string
  updatedAt?: unknown
  updatedBy?: string | null
}

export const AI_ACTIVITY_COLLECTION = 'ai_config'
export const AI_ACTIVITY_DOC_ID = 'activity_settings'

export const DEFAULT_ACTIVITY_PROMPT = `Ты смотришь журнал CRM BAHMAL HOME, не чат с клиентом.
В истории почти никогда нет прямой речи клиента — это нормально.

Твоя задача: одной фразой на русском сказать, ЧТО менеджер делал с лидом в этом месяце.
Метку active/passive/paused ставит система по журналу, не ты. Но label в JSON всё равно заполни так:
- active — в истории есть работа (шаг, этап, звонок, комментарий, ТЗ, цены, образцы, продажи)
- passive — за месяц журнала нет
- paused — в карточке «На паузе» и другой работы нет

Примеры работы (это active):
- «Шаг выполнен: Предоставить цены на основе ТЗ»
- «КП отправлено → ТЗ получено»
- «Итог звонка…», комментарий, визит, образцы, назначение продаж

Не ставь passive из‑за «нет ответа клиента» или «запись формальная».

ДАННЫЕ:
- Имя: {clientName}
- Этап: {stage}
- Ожидание: {waitStatus}
- Дней с записями: {activeDaysCount}
- Дней без касания: {daysSinceLastTouch}

ЖУРНАЛ ЗА МЕСЯЦ:
{monthHistory}

JSON:
{"label":"active|passive|paused","score":0-100,"reason":"одно предложение что сделали"}`

export const DEFAULT_KPI_PROMPT = `Отбор KPI считает программа, не ИИ.

Правило:
1) Активный = в Истории месяца есть работа менеджера.
2) KPI-лид = активный + не старше 3 месяцев + минимум {minKpiMoments} СОДЕРЖАТЕЛЬНЫХ шагов (КП, звонок, образцы, этап, визит, комментарий с сутью). Плюс: есть сильный шаг, минимум 2 вида работы, и либо 2 разных дня, либо 3 вида в один день.
3) Сделка в 1-м месяце = сразу.
4) «Клиент создан», «на паузе», «написала» без сути — не шаг KPI.
5) Фразы от клиента не нужны. Цель: выполнение плана по лидам около 80–90%, не сверхвыполнение за счёт пустых комментариев.`

export const DEFAULT_AI_ACTIVITY_CONFIG: AiActivityConfig = {
  minActiveDays: 10,
  activityPrompt: DEFAULT_ACTIVITY_PROMPT,
  isActive: true,
  minKpiMoments: 3,
  kpiPrompt: DEFAULT_KPI_PROMPT,
  updatedBy: null,
}

export const GROQ_ACTIVITY_LABELS: Record<GroqActivityLabel, string> = {
  active: 'Активный',
  passive: 'Пассивный',
  paused: 'На паузе',
}

export function isLegacyActivityPrompt(text: unknown): boolean {
  return /клиент отвечает|смотри на содержание|формальные \(|нет конкретных обсуждений/i.test(
    String(text || ''),
  )
}

export function isLegacyKpiPrompt(text: unknown): boolean {
  const s = String(text || '')
  if (!s.trim()) return true
  return !/содержательн|два разных вида работы|сильный шаг/i.test(s)
}
