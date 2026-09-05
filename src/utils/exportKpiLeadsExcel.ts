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
  KPI_STEP_TYPE_LABELS,
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

function formatLine(entry: ClientHistoryEntry): string {
  const day = entryDay(entry) || '—'
  const cls = classifyLeadHistoryEntry(entry)
  const type = KPI_STEP_TYPE_LABELS[entry.type] || cls.label || entry.type
  const text = String(entry.text || '').replace(/\s+/g, ' ').trim()
  return text ? `${day} · ${type}: ${text}` : `${day} · ${type}`
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
      const monthLines = history.filter((e) => entryDay(e).startsWith(opts.month))
      const kpiLines = monthLines.filter((e) => classifyLeadHistoryEntry(e).kpiCounted)
      const done = kpiLines.map(formatLine).join('\n') || 'Нет содержательных шагов в истории месяца'
      const allHist = monthLines.map(formatLine).join('\n') || 'В этом месяце записей в истории нет'
      const stage = stageLabel(client?.stage || lead.stage)
      const wait = client?.waitStatus ? ` Ожидание: ${client.waitStatus}.` : ''
      const manual =
        client?.kpiManualMonth === opts.month && client.kpiManualIncluded
          ? ' Админ засчитал вручную.'
          : ''
      const overview = [
        `Этап «${stage}».`,
        score.reason,
        wait,
        client?.nextStep ? ` Следующий шаг: ${client.nextStep}.` : '',
      ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      const why = [
        client?.kpiQualificationReason || '',
        score.reason,
        `Критерии: ${score.significantMoments} шагов, ${score.days} дн., ${score.types} вида работы, тишина ${score.silenceDays} дн.`,
        score.abandoned ? 'Заброшен по автоправилу — в журнале только потому что засчитан вручную.' : 'По критериям проходит: не заброшен, работа велась.',
        manual,
      ]
        .filter(Boolean)
        .join(' ')

      return {
        '№': index + 1,
        Клиент: lead.clientName || client?.name || '—',
        Компания: client?.company || '—',
        Этап: stage,
        Полка: leadCats(lead, client),
        Менеджер: lead.assignedToName || client?.assignedToName || opts.managerName,
        'Краткий обзор': clip(overview),
        'Что проделано': clip(done),
        'История / комментарии': clip(allHist),
        'Почему в KPI': clip(why),
      }
    }),
  )

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 4 },
    { wch: 28 },
    { wch: 24 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 48 },
    { wch: 52 },
    { wch: 56 },
    { wch: 48 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'KPI лиды')
  const safeMgr = (opts.managerName || 'менеджер').replace(/[\\/:*?"<>|]+/g, ' ').trim()
  XLSX.writeFile(wb, `KPI_лиды_${safeMgr}_${opts.month}.xlsx`)
}
