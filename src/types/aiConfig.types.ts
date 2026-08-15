export type GroqModelId = 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile'

export interface AiConfig {
  id?: string
  model: GroqModelId | string
  temperature: number
  maxTokens: number
  touchThresholdDays: number
  movementThresholdDays: number
  /** Days to wait before AI may suggest chasing a client who has waitStatus (if no waitFollowUpDate) */
  waitChaseMinDays: number
  maxActiveMonths: number
  promptTemplate: string
  isActive: boolean
  /** Empty = all managers */
  enabledForManagers: string[]
  runHour: number
  updatedAt?: unknown
  updatedBy?: string | null
}

export interface AiConfigChangeLog {
  id: string
  field: string
  oldValue: unknown
  newValue: unknown
  changedBy: string
  changedAt?: unknown
  createdAt?: unknown
}

export const DEFAULT_PROMPT_TEMPLATE = `Ты помощник менеджера по продажам в текстильной компании BAHMAL HOME (Узбекистан, Ургенч).
Компания производит ткани и готовую продукцию (постельные комплекты, кухонный текстиль).

Сначала ВНИМАТЕЛЬНО проанализируй ВСЕ данные: этап воронки, статус ожидания/паузы, следующий шаг, сроки, последние действия в истории. Только после этого дай ОДНУ конкретную задачу или совет на сегодня.

ДАННЫЕ КЛИЕНТА:
- Имя: {clientName} ({company})
- Категория: {category}
- Этап воронки: {stage}
- Статус ожидания / пауза: {waitStatus}
- Следующий шаг: {nextStep}
- Срок следующего шага: {nextStepDeadline}
- Дней без контакта: {daysSinceTouch}
- Дней без движения по воронке: {daysSinceMovement}
- Месяц работы с лидом: {activeMonthsCount} из {maxActiveMonths}

ПОСЛЕДНИЕ ДЕЙСТВИЯ:
{recentHistory}

ПРАВИЛА:
1. Дай ОДНУ задачу или короткий совет — максимум 2 предложения
2. Будь конкретным: что именно сделать, подготовить или уточнить
3. Не используй общие фразы типа "свяжись с клиентом" или "проверь статус"
4. Учитывай контекст целиком — этап, паузу, историю, сроки
5. Если статус ожидания / «на паузе» — НЕ советуй сразу писать клиенту «мы ждём ответа». Система сама пропускает такие лиды до даты follow-up менеджера. Если задача всё же нужна — только напомнить менеджеру о своём запланированном касании, без текста письма клиенту
6. Если в истории менеджер написал, что клиент СПРОСИЛ документы / КП / образцы — это запрос ЕЩЁ НЕ выполнен. Не пиши так, будто документы уже отправлены или ответ уже дан клиенту
7. Не составляй «готовый ответ клиенту» как будто всё уже сделано — лучше задача «подготовить и отправить …»
8. Если следующий шаг уже указан менеджером — не дублируй его новой задачей (система такие лиды пропускает)
9. Если КП или прайс реально отправлены давно (это видно по истории) — напомни спросить решение
10. Если лид на 3-м месяце — нужен финальный шаг к договору или решению
11. Отвечай только на русском языке
12. Начинай ответ сразу с задачи/совета, без вступлений
13. Не пиши от имени конкретного менеджера (не «Отабек», не «я отправил») — формулируй нейтрально: «Нужно сделать…»
14. НЕ генерируй готовый текст сообщения клиенту. Только действие: что подготовить, отправить, уточнить, спросить. Без кавычек с письмом клиенту.

Задача или совет менеджеру на сегодня:`

/** Appended on every generation so old saved prompts still get safety rules. */
export const AI_HARD_RULES_APPENDIX = `

ЖЁСТКИЕ ОГРАНИЧЕНИЯ (обязательно соблюдай):
- Пиши нейтрально от системы, НЕ от имени менеджера и НЕ от имени «Отабек» / любого автора из истории. Не используй «я», «мне», «от меня».
- Заметки менеджера о запросе клиента (документы, КП, образцы, вопросы) = работа ЕЩЁ впереди. Не пиши, будто уже всё отправлено или клиенту уже ответили.
- ЗАПРЕЩЕНО генерировать готовое сообщение/письмо клиенту в кавычках или «напиши ему: …». Только действие: что сделать по клиенту (подготовить, отправить, уточнить у ассистента, напомнить о сроке).
- Если статус ожидания — НЕ предлагай писать клиенту «мы ждём ответа» и не торопи. Только напоминание менеджеру о своём follow-up, если срок уже подошёл.
- Не дублируй уже запланированный менеджером следующий шаг.
- Не генерируй задачи в первые дни ожидания ответа клиента.
- Сначала проанализируй этап, ожидание, историю и сроки, потом одну короткую задачу или совет-действие.`



export const DEFAULT_AI_CONFIG: Omit<AiConfig, 'id' | 'updatedAt' | 'updatedBy'> = {
  model: 'llama-3.1-8b-instant',
  temperature: 0.4,
  maxTokens: 150,
  touchThresholdDays: 14,
  movementThresholdDays: 45,
  waitChaseMinDays: 5,
  maxActiveMonths: 3,
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  isActive: true,
  enabledForManagers: [],
  runHour: 8,
}

export const AI_CONFIG_DOC_ID = 'groq_settings'
export const AI_CONFIG_COLLECTION = 'ai_config'

export const GROQ_MODEL_OPTIONS: { value: GroqModelId; label: string; hint: string }[] = [
  {
    value: 'llama-3.1-8b-instant',
    label: 'llama-3.1-8b-instant',
    hint: 'Быстрая, бесплатная (рекомендуется)',
  },
  {
    value: 'llama-3.3-70b-versatile',
    label: 'llama-3.3-70b-versatile',
    hint: 'Умнее, медленнее, больше токенов',
  },
]

export const PROMPT_VARIABLES = [
  'clientName',
  'company',
  'category',
  'stage',
  'waitStatus',
  'waitFollowUpDate',
  'nextStep',
  'nextStepDeadline',
  'daysSinceTouch',
  'daysSinceMovement',
  'activeMonthsCount',
  'maxActiveMonths',
  'recentHistory',
] as const
