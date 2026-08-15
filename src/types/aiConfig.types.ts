export type GroqModelId = 'llama-3.1-8b-instant' | 'llama-3.3-70b-versatile'

export interface AiConfig {
  id?: string
  model: GroqModelId | string
  temperature: number
  maxTokens: number
  touchThresholdDays: number
  movementThresholdDays: number
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

Проанализируй данные по клиенту и дай ОДНУ конкретную задачу менеджеру на сегодня.

ДАННЫЕ КЛИЕНТА:
- Имя: {clientName} ({company})
- Категория: {category}
- Этап воронки: {stage}
- Статус ожидания: {waitStatus}
- Следующий шаг: {nextStep}
- Срок следующего шага: {nextStepDeadline}
- Дней без контакта: {daysSinceTouch}
- Дней без движения по воронке: {daysSinceMovement}
- Месяц работы с лидом: {activeMonthsCount} из {maxActiveMonths}

ПОСЛЕДНИЕ ДЕЙСТВИЯ:
{recentHistory}

ПРАВИЛА:
1. Дай ОДНУ задачу — максимум 2 предложения
2. Задача должна быть конкретной — что именно написать, спросить или сделать
3. Не используй общие фразы типа "свяжись с клиентом" или "проверь статус"
4. Учитывай контекст — что ждём, что было отправлено, сколько времени прошло
5. Если образцы отправлены почтой — спроси трек-номер у ассистента и отправь клиенту
6. Если КП или прайс отправлен больше 5 дней назад — напомни и спроси о решении
7. Если клиент молчит больше 10 дней — предложи конкретный текст сообщения
8. Если лид на 3-м месяце — задача должна быть про финальное решение
9. Отвечай только на русском языке
10. Начинай ответ сразу с задачи без вступлений и объяснений

Задача для менеджера на сегодня:`

export const DEFAULT_AI_CONFIG: Omit<AiConfig, 'id' | 'updatedAt' | 'updatedBy'> = {
  model: 'llama-3.1-8b-instant',
  temperature: 0.4,
  maxTokens: 150,
  touchThresholdDays: 14,
  movementThresholdDays: 45,
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
  'nextStep',
  'nextStepDeadline',
  'daysSinceTouch',
  'daysSinceMovement',
  'activeMonthsCount',
  'maxActiveMonths',
  'recentHistory',
] as const
