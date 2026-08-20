export type GroqActivityLabel = 'active' | 'passive' | 'paused'

export interface AiActivityConfig {
  minActiveDays: number
  activityPrompt: string
  isActive: boolean
  updatedAt?: unknown
  updatedBy?: string | null
}

export const AI_ACTIVITY_COLLECTION = 'ai_activity_config'
export const AI_ACTIVITY_DOC_ID = 'settings'

export const DEFAULT_ACTIVITY_PROMPT = `Ты аналитик CRM системы текстильной компании BAHMAL HOME (Узбекистан).

Проанализируй активность по клиенту за текущий месяц и определи:
активный лид или пассивный.

ДАННЫЕ КЛИЕНТА:
- Имя: {clientName}
- Этап воронки: {stage}
- Статус ожидания: {waitStatus}
- Дней с активностью в этом месяце: {activeDaysCount} (минимум нужно: {minActiveDaysRequired})
- Дней без контакта: {daysSinceLastTouch}

ИСТОРИЯ ЗА ТЕКУЩИЙ МЕСЯЦ:
{monthHistory}

ПРАВИЛА ОЦЕНКИ:

Активный лид (active) — если:
- Идут реальные переговоры: обсуждение цены, объёма, условий, прайса, образцов
- Клиент отвечает и задаёт вопросы по существу
- Менеджер и клиент обмениваются конкретной информацией
- Есть движение вперёд даже если медленное

Пассивный лид (passive) — если:
- Менеджер пишет но клиент не отвечает или отвечает формально
- Нет конкретных обсуждений цены, объёма, условий
- Записи формальные ("напомнил", "написал" без результата)

На паузе (paused) — если:
- Явно стоит статус "На паузе" или "Ждём решения" долго без ответа
- Клиент попросил подождать
- Нет активности больше 14 дней подряд

ВАЖНО:
- Смотри на СОДЕРЖАНИЕ записей, не только на их количество
- Подготовка образцов без подтверждения от клиента = малый вес
- Статус "На паузе" без других активных действий = пассивный/паузе
- Если записей мало но они содержательные = может быть активный

Ответь строго в формате JSON:
{
  "label": "active" | "passive" | "paused",
  "score": 0-100,
  "reason": "краткое объяснение на русском (1 предложение)"
}`

export const DEFAULT_AI_ACTIVITY_CONFIG: AiActivityConfig = {
  minActiveDays: 10,
  activityPrompt: DEFAULT_ACTIVITY_PROMPT,
  isActive: true,
  updatedBy: null,
}

export const GROQ_ACTIVITY_LABELS: Record<GroqActivityLabel, string> = {
  active: 'Активный',
  passive: 'Пассивный',
  paused: 'На паузе',
}

export function isGroqActivityLabel(value: unknown): value is GroqActivityLabel {
  return value === 'active' || value === 'passive' || value === 'paused'
}
