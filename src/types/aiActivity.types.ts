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

Правило (план спокойно 70–80%):
1) Активный = любая работа в Истории за месяц.
2) KPI-лид = активный, не старше 3 месяцев, и все четыре пункта:
   — 4 содержательных шага;
   — работа в 3 разных дня;
   — звонок или визит;
   — КП или образцы или сдвиг этапа.
3) Сделка в 1-м месяце = сразу.
4) «Написала» без сути не шаг.`

export const DEFAULT_AI_ACTIVITY_CONFIG: AiActivityConfig = {
  minActiveDays: 10,
  activityPrompt: DEFAULT_ACTIVITY_PROMPT,
  isActive: true,
  minKpiMoments: 4,
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
  return !/4 содержательных шага|3 разных дня/i.test(s)
}
