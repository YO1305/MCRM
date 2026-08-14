import type { Contact, ContactRelation, ContactStatus } from '@/types/contact.types'
import { CONTACT_RELATION_LABELS, CONTACT_STATUS_LABELS } from '@/types/contact.types'
import { getCountries } from '@/constants/leadProducts'
import { normalizePhone } from '@/utils/phone'

const HEADERS = [
  'Имя',
  'Телефон',
  'Компания',
  'Email',
  'Страна',
  'Статус',
  'Тип',
  'Источник',
  'Выставка',
  'Дата выставки',
  'Что покупает',
  'Заметки',
] as const

function escapeCsv(value: string) {
  const v = value.replace(/"/g, '""')
  return /[",\n\r;]/.test(v) ? `"${v}"` : v
}

function downloadCsv(filename: string, lines: string[]) {
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function countryLabel(code: string | null | undefined) {
  if (!code) return ''
  return getCountries().find((c) => c.code === code)?.name || code
}

function resolveCountryCode(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const list = getCountries()
  const byCode = list.find((c) => c.code.toLowerCase() === v.toLowerCase())
  if (byCode) return byCode.code
  const byName = list.find((c) => c.name.toLowerCase() === v.toLowerCase())
  return byName?.code || null
}

function resolveStatus(raw: string): ContactStatus {
  const v = raw.trim().toLowerCase()
  if (v.startsWith('пас') || v === 'passive' || v === '0') return 'passive'
  return 'active'
}

function resolveRelation(raw: string): ContactRelation {
  const v = raw.trim().toLowerCase()
  if (v.includes('парт') || v.includes('клиент') || v === 'partner') return 'partner'
  if (v.includes('потенц') || v === 'prospect') return 'prospect'
  if (v.includes('контакт') || v === 'contact') return 'contact'
  return 'contact'
}

export function downloadContactsTemplate() {
  const example = [
    'Иванов Иван',
    '+998901234567',
    'ООО Пример',
    'mail@example.com',
    'Узбекистан',
    'Актив',
    'Контакт',
    'Instagram',
    '',
    '',
    'Сатин, постельное бельё',
    '',
  ]
  downloadCsv('shablon_baza_klientov.csv', [
    HEADERS.join(';'),
    example.map((c) => escapeCsv(c)).join(';'),
  ])
}

export function exportContactsToExcel(contacts: Contact[]) {
  const rows = contacts.map((c) =>
    [
      c.name,
      c.phone,
      c.company || '',
      c.email || '',
      countryLabel(c.country),
      CONTACT_STATUS_LABELS[c.status || 'active'] || c.status || '',
      CONTACT_RELATION_LABELS[c.relation || 'contact'] || c.relation || '',
      c.source || '',
      c.exhibitionName || '',
      c.exhibitionDate || '',
      c.buysWhat || '',
      c.notes || '',
    ]
      .map((cell) => escapeCsv(String(cell)))
      .join(';'),
  )
  const stamp = new Date().toISOString().slice(0, 10)
  downloadCsv(`baza_klientov_${stamp}.csv`, [HEADERS.join(';'), ...rows])
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if ((ch === ';' || ch === ',') && !inQuotes) {
      result.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  result.push(cur.trim())
  return result
}

export interface ParsedContactRow {
  name: string
  phone: string
  company: string
  email: string
  country: string | null
  notes: string
  status: ContactStatus
  relation: ContactRelation
  source?: string | null
  exhibitionName?: string
  exhibitionDate?: string | null
  buysWhat: string
}

export function parseContactsCsv(text: string): { rows: ParsedContactRow[]; errors: string[] } {
  const cleaned = text.replace(/^\uFEFF/, '')
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim())
  const errors: string[] = []
  const rows: ParsedContactRow[] = []

  if (lines.length === 0) return { rows, errors: ['Файл пустой'] }

  const start = /имя/i.test(lines[0]) ? 1 : 0

  for (let i = start; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const name = (cols[0] || '').trim()
    const phone = (cols[1] || '').trim()
    if (!name && !phone) continue
    if (!name || !phone) {
      errors.push(`Строка ${i + 1}: нужны Имя и Телефон`)
      continue
    }
    if (!normalizePhone(phone)) {
      errors.push(`Строка ${i + 1}: некорректный телефон`)
      continue
    }
    // Full: Страна, Статус, Тип, Источник, Выставка, Дата, Что покупает, Заметки
    // Mid:  Страна, Статус, Тип, Что покупает, Заметки
    // Old:  Страна, Заметки
    const hasFull = cols.length >= 11
    const hasExtended = cols.length >= 8
    rows.push({
      name,
      phone,
      company: (cols[2] || '').trim(),
      email: (cols[3] || '').trim(),
      country: resolveCountryCode(cols[4] || ''),
      status: hasExtended ? resolveStatus(cols[5] || '') : 'passive',
      relation: hasExtended ? resolveRelation(cols[6] || '') : 'contact',
      source: hasFull ? (cols[7] || '').trim() || null : null,
      exhibitionName: hasFull ? (cols[8] || '').trim() : '',
      exhibitionDate: hasFull ? (cols[9] || '').trim() || null : null,
      buysWhat: hasFull
        ? (cols[10] || '').trim()
        : hasExtended
          ? (cols[7] || '').trim()
          : '',
      notes: hasFull
        ? (cols[11] || '').trim()
        : hasExtended
          ? (cols[8] || '').trim()
          : (cols[5] || '').trim(),
    })
  }

  return { rows, errors }
}
