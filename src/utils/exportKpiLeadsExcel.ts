import { where } from 'firebase/firestore'
import { queryCollection } from '@/firebase/firestore'
import { stageLabel } from '@/constants/clientStages'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import type { Client, ClientHistoryEntry } from '@/types/client.types'
import type { KpiLeadLog, LeadCategory } from '@/types/kpiLead.types'
import {
  classifyLeadHistoryEntry,
  evaluateKpiLead,
  historyForKpiClock,
} from '@/utils/kpiLeadSteps'

function leadCats(lead: KpiLeadLog, client?: Client | null): string {
  const raw: LeadCategory[] =
    lead.categories?.length
      ? lead.categories
      : lead.category
        ? [lead.category]
        : client?.categories?.length
          ? client.categories
          : client?.category
            ? [client.category]
            : []
  return raw.map((c) => LEAD_CATEGORIES[c] || c).join(' + ') || '—'
}

function entryDay(entry: ClientHistoryEntry): string {
  if (typeof entry.sentDate === 'string' && entry.sentDate.length >= 10) {
    return entry.sentDate.slice(0, 10)
  }
  const raw = entry.createdAt
  if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10)
  if (raw && typeof raw === 'object') {
    const withToDate = raw as { toDate?: () => Date }
    if (typeof withToDate.toDate === 'function') {
      try {
        return withToDate.toDate().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
      } catch {
        /* fall through */
      }
    }
    const seconds = (raw as { seconds?: number }).seconds ?? (raw as { _seconds?: number })._seconds
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })
    }
  }
  return ''
}

function sortHistory(entries: ClientHistoryEntry[]): ClientHistoryEntry[] {
  return [...entries].sort((a, b) => entryDay(a).localeCompare(entryDay(b)))
}

function clean(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^\d{4}-\d{2}-\d{2}\s*[·.\-–:]?\s*/g, '')
    .replace(/^(этап|статус|ожидание)\s*[:—-]\s*/i, '')
    .trim()
}

function asSentence(text: string): string {
  const t = clean(text).replace(/^[.\s]+/, '')
  if (!t) return ''
  const capped = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?…]$/.test(capped) ? capped : `${capped}.`
}

function actionPhrase(entry: ClientHistoryEntry): string {
  const type = String(entry.type || '')
  const text = clean(entry.text)
  const cls = classifyLeadHistoryEntry(entry)
  if (cls.kind === 'noise' && !cls.kpiCounted) return ''

  if (type === 'call') {
    return text ? `Созвон: ${text}` : 'Созванивались с клиентом'
  }
  if (type === 'visit') {
    return text ? `Визит: ${text}` : 'Был визит'
  }
  if (type === 'samples_sent') {
    return text ? `Отправили образцы: ${text}` : 'Отправили образцы'
  }
  if (type === 'stage_change') {
    return text ? `По воронке: ${text}` : 'Сдвинули этап'
  }
  if (type === 'next_step') {
    return text ? `Договорились о следующем шаге: ${text}` : 'Поставили следующий шаг'
  }
  if (type === 'sales_note') {
    return text ? `Продажи: ${text}` : ''
  }
  if (type === 'sales_assigned') {
    return text ? `Передали в продажи: ${text}` : 'Передали в продажи'
  }
  if (type === 'wait_status') {
    if (!text || /на паузе/i.test(text)) return ''
    return `Сейчас по клиенту: ${text}`
  }
  if (type === 'note' || cls.kpiCounted) {
    return text
  }
  return text
}

function narrateWork(entries: ClientHistoryEntry[]): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const entry of entries) {
    const phrase = actionPhrase(entry)
    if (!phrase) continue
    const key = phrase.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim()
    if (key.length < 4 || seen.has(key)) continue
    seen.add(key)
    parts.push(asSentence(phrase))
  }
  if (!parts.length) {
    return 'По карточке в этом месяце отдельных заметок мало — лид в списке засчитанных, работу смотрели по факту ведения.'
  }
  return parts.join(' ')
}

function narrateComment(opts: {
  client?: Client
  lead: KpiLeadLog
  month: string
  work: string
  score: ReturnType<typeof evaluateKpiLead>
}): string {
  const { client, lead, month, work, score } = opts
  const stage = stageLabel(client?.stage || lead.stage)
  const bits: string[] = []

  bits.push(`Клиент сейчас на этапе «${stage}».`)
  if (client?.company) bits.push(`Компания ${client.company}.`)

  if (lead.significantMoments != null && lead.significantMoments >= 900) {
    bits.push('Сделку закрыли в первый месяц работы — лид засчитан.')
  } else if (client?.kpiManualMonth === month && client.kpiManualIncluded) {
    bits.push('В KPI взяли по решению руководителя: работу по клиенту приняли.')
  } else {
    bits.push(
      'Клиента вели по-настоящему: не один короткий комментарий, а несколько разных действий, и не бросили после КП.',
    )
  }

  if (work) bits.push(work)

  if (client?.waitStatus && !/на паузе/i.test(client.waitStatus)) {
    bits.push(`Сейчас ${client.waitStatus.replace(/^[а-яё]/, (ch) => ch.toLowerCase())}.`)
  }
  if (client?.nextStep) bits.push(`Дальше: ${clean(client.nextStep)}.`)

  if (score.abandoned && !(client?.kpiManualMonth === month && client.kpiManualIncluded)) {
    bits.push('По автомату лид мог не пройти из‑за паузы в работе — в отчёте он потому что его засчитали.')
  }

  bits.push('В засчитанные KPI-лиды входит.')
  return bits.join(' ').replace(/\s+/g, ' ').trim()
}

async function loadHistory(clientId: string): Promise<ClientHistoryEntry[]> {
  const rows = await queryCollection<ClientHistoryEntry>('client_history', [
    where('clientId', '==', clientId),
  ])
  return sortHistory(rows)
}

function clip(text: string, max = 30000): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 20)}…`
}

export async function exportKpiLeadsExcel(opts: {
  month: string
  monthLabel: string
  managerName: string
  leads: KpiLeadLog[]
  clients: Client[]
}): Promise<void> {
  const XLSX = await import('xlsx')
  const byId = new Map(opts.clients.map((c) => [c.id, c]))

  const rows = await Promise.all(
    opts.leads.map(async (lead, index) => {
      const client = byId.get(lead.clientId)
      const history = lead.clientId ? await loadHistory(lead.clientId) : []
      const clock = client ? historyForKpiClock(client, history) : history
      const score = evaluateKpiLead(clock, 3, opts.month)
      const monthLines = history.filter((e) => {
        const day = entryDay(e)
        return !day || day.startsWith(opts.month)
      })
      const useful = monthLines.filter((e) => {
        const cls = classifyLeadHistoryEntry(e)
        return cls.kpiCounted || cls.countsAsWork
      })
      const work = narrateWork(useful.length ? useful : monthLines)
      const comment = narrateComment({ client, lead, month: opts.month, work, score })

      return {
        '№': index + 1,
        Клиент: lead.clientName || client?.name || '—',
        Компания: client?.company || '—',
        Этап: stageLabel(client?.stage || lead.stage),
        Полка: leadCats(lead, client),
        Менеджер: lead.assignedToName || client?.assignedToName || opts.managerName,
        'Что сделано по клиенту': clip(work),
        Комментарий: clip(comment),
      }
    }),
  )

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 4 },
    { wch: 28 },
    { wch: 24 },
    { wch: 22 },
    { wch: 14 },
    { wch: 20 },
    { wch: 62 },
    { wch: 62 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'KPI лиды')
  const safeMgr = (opts.managerName || 'менеджер').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  XLSX.writeFile(wb, `KPI_лиды_${safeMgr}_${opts.month}.xlsx`)
}
