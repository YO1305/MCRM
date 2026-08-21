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

export const DEFAULT_KPI_PROMPT = `Ты аналитик CRM текстильной компании BAHMAL HOME (Узбекистан).

По журналу за месяц посчитай, сколько раз КЛИЕНТ сделал конкретный шаг вперёд.
Это журнал менеджера, не чат: если менеджер написал «клиент запросил образцы артикула 40/1» — это действие КЛИЕНТА.

ДАННЫЕ:
- Имя: {clientName}
- Категория: {category}
- Этап: {stage}
- Статус лида: {activityLabel}
- Месяц работы: {activeMonthsCount} из 3

ЖУРНАЛ:
{monthHistory}

ВЕСОМЫЙ МОМЕНТ (клиент):
- запросил образцы конкретных артикулов
- прислал ТЗ / спецификацию
- запросил параметры (плотность, состав, ширина)
- запросил условия договора или поставки
- запросил счёт или реквизиты
- подтвердил получение образцов
- дал обратную связь по образцам / выкрасу
- согласовал объём или сроки
- подтвердил готовность к следующему шагу
- одобрил цвет, артикул или спецификацию
- запросил договор, согласовал спецификацию заказа
- предоплата, подпись, явно движется вперёд

НЕ СЧИТАТЬ:
- менеджер отправил прайс / напомнил / подготовил образцы без подтверждения
- клиент спросил цену в общем или «что есть в ассортименте»
- «подумаем», «позже», «на паузе», «ждём решения» без действия

qualifies = true только если significantMoments >= {minKpiMoments}

JSON:
{"significantMoments":0,"qualifies":false,"reason":"1-2 предложения на русском"}`

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
