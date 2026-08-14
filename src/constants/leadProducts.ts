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
