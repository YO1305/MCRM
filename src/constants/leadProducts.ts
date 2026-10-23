import type { LeadCategory } from '@/types/kpiLead.types'
import type { ProductKind } from '@/types/client.types'

export interface CountryOption {
  code: string
  name: string
  /** Европейская страна → KPI категория «Европа» */
  europe: boolean
  builtin?: boolean
}

/** Default countries (overridden by admin list in Firestore). */
export const COUNTRIES: CountryOption[] = [
  { code: 'UZ', name: 'Узбекистан', europe: false, builtin: true },
  { code: 'KZ', name: 'Казахстан', europe: false, builtin: true },
  { code: 'KG', name: 'Кыргызстан', europe: false, builtin: true },
  { code: 'TJ', name: 'Таджикистан', europe: false, builtin: true },
  { code: 'TM', name: 'Туркменистан', europe: false, builtin: true },
  { code: 'AZ', name: 'Азербайджан', europe: false, builtin: true },
  { code: 'AM', name: 'Армения', europe: false, builtin: true },
  { code: 'GE', name: 'Грузия', europe: false, builtin: true },
  { code: 'BY', name: 'Беларусь', europe: false, builtin: true },
  { code: 'UA', name: 'Украина', europe: false, builtin: true },
  { code: 'RU', name: 'Россия', europe: false, builtin: true },
  { code: 'TR', name: 'Турция', europe: false, builtin: true },
  { code: 'CN', name: 'Китай', europe: false, builtin: true },
  { code: 'AE', name: 'ОАЭ', europe: false, builtin: true },
  { code: 'IR', name: 'Иран', europe: false, builtin: true },
  { code: 'IN', name: 'Индия', europe: false, builtin: true },
  { code: 'PK', name: 'Пакистан', europe: false, builtin: true },
  { code: 'AF', name: 'Афганистан', europe: false, builtin: true },
  { code: 'SA', name: 'Саудовская Аравия', europe: false, builtin: true },
  { code: 'QA', name: 'Катар', europe: false, builtin: true },
  { code: 'KW', name: 'Кувейт', europe: false, builtin: true },
  { code: 'BH', name: 'Бахрейн', europe: false, builtin: true },
  { code: 'OM', name: 'Оман', europe: false, builtin: true },
  { code: 'IL', name: 'Израиль', europe: false, builtin: true },
  { code: 'KR', name: 'Южная Корея', europe: false, builtin: true },
  { code: 'JP', name: 'Япония', europe: false, builtin: true },
  { code: 'US', name: 'США', europe: false, builtin: true },
  { code: 'CA', name: 'Канада', europe: false, builtin: true },
  { code: 'DE', name: 'Германия', europe: true, builtin: true },
  { code: 'FR', name: 'Франция', europe: true, builtin: true },
  { code: 'IT', name: 'Италия', europe: true, builtin: true },
  { code: 'ES', name: 'Испания', europe: true, builtin: true },
  { code: 'PL', name: 'Польша', europe: true, builtin: true },
  { code: 'NL', name: 'Нидерланды', europe: true, builtin: true },
  { code: 'BE', name: 'Бельгия', europe: true, builtin: true },
  { code: 'AT', name: 'Австрия', europe: true, builtin: true },
  { code: 'CH', name: 'Швейцария', europe: true, builtin: true },
  { code: 'GB', name: 'Великобритания', europe: true, builtin: true },
  { code: 'CZ', name: 'Чехия', europe: true, builtin: true },
  { code: 'SE', name: 'Швеция', europe: true, builtin: true },
  { code: 'NO', name: 'Норвегия', europe: true, builtin: true },
  { code: 'FI', name: 'Финляндия', europe: true, builtin: true },
  { code: 'DK', name: 'Дания', europe: true, builtin: true },
  { code: 'PT', name: 'Португалия', europe: true, builtin: true },
  { code: 'GR', name: 'Греция', europe: true, builtin: true },
  { code: 'RO', name: 'Румыния', europe: true, builtin: true },
  { code: 'HU', name: 'Венгрия', europe: true, builtin: true },
  { code: 'BG', name: 'Болгария', europe: true, builtin: true },
  { code: 'HR', name: 'Хорватия', europe: true, builtin: true },
  { code: 'SK', name: 'Словакия', europe: true, builtin: true },
  { code: 'SI', name: 'Словения', europe: true, builtin: true },
  { code: 'LT', name: 'Литва', europe: true, builtin: true },
  { code: 'LV', name: 'Латвия', europe: true, builtin: true },
  { code: 'EE', name: 'Эстония', europe: true, builtin: true },
  { code: 'IE', name: 'Ирландия', europe: true, builtin: true },
  { code: 'OTHER_EU', name: 'Другая страна Европы', europe: true, builtin: true },
  { code: 'OTHER', name: 'Другая страна', europe: false, builtin: true },
]

/** Live list from Firestore (set by useCountries). */
let liveCountries: CountryOption[] | null = null

export function setLiveCountries(list: CountryOption[] | null) {
  liveCountries = list
}

export function getCountries(): CountryOption[] {
  return liveCountries && liveCountries.length > 0 ? liveCountries : COUNTRIES
}

const CYR_TO_LAT: Record<string, string> = {
  а: 'A',
  б: 'B',
  в: 'V',
  г: 'G',
  д: 'D',
  е: 'E',
  ё: 'E',
  ж: 'Z',
  з: 'Z',
  и: 'I',
  й: 'I',
  к: 'K',
  л: 'L',
  м: 'M',
  н: 'N',
  о: 'O',
  п: 'P',
  р: 'R',
  с: 'S',
  т: 'T',
  у: 'U',
  ф: 'F',
  х: 'H',
  ц: 'C',
  ч: 'C',
  ш: 'S',
  щ: 'S',
  ъ: '',
  ы: 'Y',
  ь: '',
  э: 'E',
  ю: 'U',
  я: 'A',
}

/** Stable 2–4 letter code for a custom country name. */
export function makeCountryCode(name: string, taken: Set<string>): string {
  const letters = Array.from(name.trim().toLowerCase())
    .map((ch) => {
      if (/[a-z]/.test(ch)) return ch.toUpperCase()
      return CYR_TO_LAT[ch] || ''
    })
    .join('')
  let base = letters.slice(0, 3) || 'XX'
  if (base.length < 2) base = (base + 'X').slice(0, 2)
  const candidates = [base.slice(0, 2), base.slice(0, 3), base]
  for (const code of candidates) {
    if (code.length >= 2 && !taken.has(code)) return code
  }
  for (let i = 2; i < 100; i += 1) {
    const code = `${base.slice(0, 2)}${i}`
    if (!taken.has(code)) return code
  }
  return `C${Date.now().toString(36).slice(-4).toUpperCase()}`
}

export const FABRIC_TYPES: Record<string, string> = {
  cotton: 'Хлопок',
  satin: 'Сатин',
  poplin: 'Поплин',
  jacquard: 'Жаккард',
  linen: 'Лён',
  blend: 'Смесовая',
  terry: 'Махра (ткань)',
  other_fabric: 'Другая ткань',
}

export const GP_TYPES: Record<string, string> = {
  bedding: 'Постельное бельё',
  towels: 'Полотенца',
  bathrobe: 'Халаты',
  table_linen: 'Столовое бельё',
  home_textile: 'Домашний текстиль',
  kit: 'Наборы / комплекты',
  other_gp: 'Другое ГП',
}

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  fabric: 'Ткань',
  finished: 'ГП (готовая продукция)',
}

export function isEuropeanCountry(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false
  return getCountries().find((c) => c.code === countryCode)?.europe === true
}

export function countryName(code: string | null | undefined): string {
  if (!code) return '—'
  return getCountries().find((c) => c.code === code)?.name || code
}

/**
 * KPI-категории лида:
 * - европейская страна → только europe
 * - иначе — по выбранной продукции (ткань / ГП / обе)
 */
export function resolveKpiCategories(
  countryCode: string | null | undefined,
  products: ProductKind[],
): LeadCategory[] {
  if (isEuropeanCountry(countryCode)) return ['europe']
  const cats: LeadCategory[] = []
  if (products.includes('fabric')) cats.push('fabric')
  if (products.includes('finished')) cats.push('finished')
  return cats.length ? cats : ['fabric']
}

export function primaryKpiCategory(categories: LeadCategory[]): LeadCategory {
  if (categories.includes('europe')) return 'europe'
  if (categories.includes('fabric')) return 'fabric'
  if (categories.includes('finished')) return 'finished'
  return 'fabric'
}
