export type OptionListId =
  | 'contact_status'
  | 'contact_relation'
  | 'contact_source'
  | 'client_source'

export interface AppOption {
  value: string
  label: string
  /** Show exhibition name + date when this source is selected */
  requiresExhibition?: boolean
  /** Built-in option — cannot delete, only rename via override */
  builtin?: boolean
}

export interface OptionListDoc {
  id: OptionListId
  options: AppOption[]
  updatedBy?: string | null
  updatedAt?: unknown
}

export const DEFAULT_CONTACT_STATUS: AppOption[] = [
  { value: 'active', label: 'Актив', builtin: true },
  { value: 'passive', label: 'Пассив', builtin: true },
]

export const DEFAULT_CONTACT_RELATION: AppOption[] = [
  { value: 'contact', label: 'Контакт', builtin: true },
  { value: 'prospect', label: 'Потенциальный', builtin: true },
  { value: 'partner', label: 'Партнёр', builtin: true },
]

export const DEFAULT_CONTACT_SOURCE: AppOption[] = [
  { value: 'instagram', label: 'Instagram', builtin: true },
  { value: 'telegram', label: 'Telegram', builtin: true },
  { value: 'textile_finds', label: 'Платформа Textile Finds', builtin: true },
  {
    value: 'exhibition',
    label: 'Выставка',
    builtin: true,
    requiresExhibition: true,
  },
  { value: 'call', label: 'Звонок', builtin: true },
  { value: 'referral', label: 'Рекомендация', builtin: true },
  { value: 'website', label: 'Сайт', builtin: true },
  { value: 'showroom', label: 'Шоурум', builtin: true },
  { value: 'other', label: 'Другое', builtin: true },
]

/** Same as CRM lead sources + textile finds + exhibition */
export const DEFAULT_CLIENT_SOURCE: AppOption[] = [
  { value: 'instagram', label: 'Instagram', builtin: true },
  { value: 'telegram', label: 'Telegram', builtin: true },
  { value: 'textile_finds', label: 'Платформа Textile Finds', builtin: true },
  {
    value: 'exhibition',
    label: 'Выставка',
    builtin: true,
    requiresExhibition: true,
  },
  { value: 'call', label: 'Звонок', builtin: true },
  { value: 'referral', label: 'Рекомендация', builtin: true },
  { value: 'website', label: 'Сайт', builtin: true },
  { value: 'showroom', label: 'Шоурум', builtin: true },
  { value: 'other', label: 'Другое', builtin: true },
]

export const OPTION_LIST_DEFAULTS: Record<OptionListId, AppOption[]> = {
  contact_status: DEFAULT_CONTACT_STATUS,
  contact_relation: DEFAULT_CONTACT_RELATION,
  contact_source: DEFAULT_CONTACT_SOURCE,
  client_source: DEFAULT_CLIENT_SOURCE,
}

export const OPTION_LIST_LABELS: Record<OptionListId, string> = {
  contact_status: 'Статус контакта',
  contact_relation: 'Тип контакта',
  contact_source: 'Источник контакта',
  client_source: 'Источник лида CRM',
}

export function slugifyOption(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '_')
    .replace(/^_|_$/g, '')
  return base || `opt_${Date.now()}`
}
