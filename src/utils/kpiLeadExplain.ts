import { stageLabel } from '@/constants/clientStages'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import { resolveKpiCategories } from '@/constants/leadProducts'
import type { Client, ClientHistoryEntry } from '@/types/client.types'
import type { KpiLeadLog, LeadCategory } from '@/types/kpiLead.types'
import { calculateActiveDaysFromHistory } from '@/utils/groqLeadActivity'
import { classifyLeadHistoryEntry, evaluateKpiLead, isPauseText, KPI_SKIP_TYPES, type LeadStepKind } from '@/utils/kpiLeadSteps'

const FINAL_STAGES = new Set(['deal', 'rejected', 'failed', 'abandoned'])

export const HISTORY_TYPE_LABELS: Record<string, string> = {
  note: 'Комментарий',
  call: 'Итог звонка',
  sales_note: 'Комментарий продаж',
  sales_assigned: 'Назначен менеджер продаж',
  stage_change: 'Смена этапа',
  wait_status: 'Статус ожидания',
  next_step: 'Следующий шаг',
  visit: 'Визит',
  samples_sent: 'Отправка образцов',
  created: 'Клиент создан (не считается работой)',
}

export type GateStatus = 'pass' | 'fail' | 'info' | 'skip'

export interface KpiExplainGate {
  id: string
  title: string
  status: GateStatus
  detail: string
}

export interface HistoryLineExplain {
  date: string
  type: string
  typeLabel: string
  text: string
  skip: boolean
  skipReason?: string
  countsAsWork: boolean
  kind: LeadStepKind
  kpiCounted: boolean
  why: string
}

export interface KpiLeadExplanation {
  counted: boolean
  verdict: string
  month: string
  clientName: string
  managerName: string
  stageKey: string
  stageName: string
  openedRaw: string
  activeMonths: number
  journalLabel: 'active' | 'passive' | 'paused'
  activeDays: number
  minKpiMoments: number
  shelvesFromCard: LeadCategory[]
  shelvesFromLog: LeadCategory[]
  storedActivityMonth: string | null
  storedActivityLabel: string | null
  storedActivityReason: string | null
  storedKpiMonth: string | null
  storedKpiQualified: boolean | null
  storedKpiMoments: number | null
  storedKpiReason: string | null
  log: KpiLeadLog | null
  gates: KpiExplainGate[]
  history: HistoryLineExplain[]
  monthHistoryCount: number
  managerWorkCount: number
  leadStepCount: number
  clientStepCount: number
  needMoreSteps: number
  blockingReason: string
  howToFix: string[]
  recommendations: string[]
}

function historyDay(createdAt: unknown): string | null {
  if (!createdAt) return null
  if (typeof createdAt === 'string' && createdAt.length >= 10) return createdAt.slice(0, 10)
  if (typeof createdAt === 'object' && createdAt !== null) {
    const withToDate = createdAt as { toDate?: () => Date }
    if (typeof withToDate.toDate === 'function') {
      try {
        const d = withToDate.toDate()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
      } catch {
        /* fall through */
      }
    }
    const seconds =
      (createdAt as { seconds?: number }).seconds ??
      (createdAt as { _seconds?: number })._seconds
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  return null
}

export function resolveActiveMonthsForMonth(client: Client, month: string): number {
  const raw = String(client.openedDate || client.openedMonth || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(raw) || !/^\d{4}-\d{2}$/.test(month)) return 1
  const [oy, om] = raw.split('-').map(Number)
  const [ty, tm] = month.split('-').map(Number)
  return Math.min(99, Math.max(1, (ty - oy) * 12 + (tm - om) + 1))
}

function hasCrmWork(
  entries: { type?: string; text?: string | null }[],
): boolean {
  return entries.some((e) => {
    if (KPI_SKIP_TYPES.has(String(e.type || ''))) return false
    if (e.type === 'wait_status' && isPauseText(e.text)) return false
    return Boolean(e.type || e.text)
  })
}

export function classifyJournalLabel(
  monthEntries: { type?: string; text?: string | null }[],
  waitStatus: string | null | undefined,
): 'active' | 'passive' | 'paused' {
  const work = hasCrmWork(monthEntries)
  if (isPauseText(waitStatus) && !work) return 'paused'
  if (work) return 'active'
  return 'passive'
}

export function formatMonthHuman(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
}

function catList(cats: LeadCategory[]): string {
  if (!cats.length) return '—'
  return cats.map((c) => LEAD_CATEGORIES[c] || c).join(' + ')
}

export function explainKpiLead(opts: {
  client: Client
  month: string
  history: ClientHistoryEntry[]
  log: KpiLeadLog | null
  minKpiMoments: number
}): KpiLeadExplanation {
  const { client, month, history, log, minKpiMoments } = opts
  const monthEntries = history.filter((e) => {
    const day = historyDay(e.createdAt)
    return Boolean(day && day.startsWith(month))
  })

  const historyLines: HistoryLineExplain[] = monthEntries
    .slice()
    .sort((a, b) => String(historyDay(a.createdAt)).localeCompare(String(historyDay(b.createdAt))))
    .map((e) => {
      const date = historyDay(e.createdAt) || '—'
      const text = String(e.text || '').trim()
      const kpi = classifyLeadHistoryEntry({ type: e.type, text })
      return {
        date,
        type: e.type,
        typeLabel: HISTORY_TYPE_LABELS[e.type] || e.type,
        text: text || '—',
        skip: !kpi.countsAsWork && !kpi.kpiCounted,
        skipReason: kpi.kind === 'noise' ? kpi.why : undefined,
        countsAsWork: kpi.countsAsWork,
        kind: kpi.kind,
        kpiCounted: kpi.kpiCounted,
        why: kpi.why,
      }
    })

  const journalLabel = classifyJournalLabel(monthEntries, client.waitStatus)
  const activeDays = calculateActiveDaysFromHistory(monthEntries, month)
  const activeMonths = resolveActiveMonthsForMonth(client, month)
  const openedRaw = client.openedDate || client.openedMonth || 'не указана (система берёт 1-й месяц)'
  const shelvesFromCard = resolveKpiCategories(client.country, client.products || [])
  const shelvesFromLog: LeadCategory[] = log
    ? log.categories?.length
      ? log.categories
      : log.category
        ? [log.category]
        : []
    : []

  const counted = Boolean(log)
  const autoDeal = client.stage === 'deal' && activeMonths === 1
  const isFinal = FINAL_STAGES.has(client.stage)
  const managerWorkCount = historyLines.filter((h) => h.countsAsWork).length
  const leadStepCount = historyLines.filter((h) => h.kpiCounted).length
  const clientStepCount = leadStepCount
  const needMoreSteps = Math.max(0, minKpiMoments - leadStepCount)
  const score = evaluateKpiLead(monthEntries, minKpiMoments)
  const firstName = (client.name || 'клиент').split(/\s+/)[0]

  const gates: KpiExplainGate[] = []
  const recommendations: string[] = []
  const howToFix: string[] = []

  let blockingReason: string
  if (counted) {
    blockingReason = `Засчитан в зарплату за ${formatMonthHuman(month)}. Полки: ${catList(shelvesFromLog)}.`
  } else if (activeMonths > 3) {
    blockingReason = `Не засчитан, потому что это уже ${activeMonths}-й месяц ведения (лимит 3). Сколько бы работы ни было — в KPI-лид не идёт.`
  } else if (journalLabel === 'paused') {
    blockingReason = `Не засчитан: в карточке «на паузе» и за ${formatMonthHuman(month)} другой работы в истории нет.`
  } else if (journalLabel !== 'active') {
    blockingReason = `Не засчитан: за ${formatMonthHuman(month)} в истории нет ни одной рабочей записи. Что было в Telegram — система не видит.`
  } else if (isFinal && !autoDeal) {
    blockingReason = `Не засчитан: этап «${stageLabel(client.stage)}» в квалификацию не берётся.`
  } else if (!score.qualifies) {
    blockingReason = score.reason
  } else {
    blockingReason = `Не засчитан: правила по шагам уже выполнены, но в журнале зарплаты за ${month} записи нет. На дашборде нажмите «Переанализировать месяц».`
  }

  gates.push({
    id: 'human',
    title: 'Простыми словами',
    status: counted ? 'pass' : 'fail',
    detail: blockingReason,
  })

  gates.push({
    id: 'score',
    title: 'Что учтено / что нет',
    status: counted ? 'pass' : score.qualifies ? 'info' : 'fail',
    detail: `За ${formatMonthHuman(month)}: записей ${monthEntries.length}. Рабочих (активный): ${managerWorkCount}. Содержательных шагов KPI: ${leadStepCount} из ${minKpiMoments}. Видов работы: ${score.types}. Дней с шагами: ${score.days}. Сильный шаг: ${score.hasStrong ? 'да' : 'нет'}. ${
      counted
        ? 'Порог выполнен — клиент в зарплате.'
        : score.qualifies
          ? 'Правила шагов выполнены — нужен переанализ месяца.'
          : score.reason
    }`,
  })

  gates.push({
    id: 'source',
    title: 'Что смотрит система',
    status: 'info',
    detail: `Зарплатный факт за ${formatMonthHuman(month)} берётся только из журнала kpi_lead_log (месяц ${month}). Карточка клиента хранит последнюю оценку Groq — сейчас там месяц ${client.kpiQualifiedMonth || 'пусто'} / активность ${client.activityMonth || 'пусто'}. Если вы смотрите прошлый месяц, поля в карточке могут относиться уже к новому месяцу. Журнал истории за выбранный месяц — источник ступени 1.`,
  })

  gates.push({
    id: 'opened',
    title: `Месяц работы с лидом (ступень 2-А)`,
    status: activeMonths > 3 ? 'fail' : 'pass',
    detail:
      activeMonths > 3
        ? `Дата открытия: ${openedRaw}. На ${formatMonthHuman(month)} это ${activeMonths}-й месяц ведения. С 4-го месяца лид в KPI не идёт никогда — даже если активный и клиент пишет каждый день.`
        : `Дата открытия: ${openedRaw}. На ${formatMonthHuman(month)} это ${activeMonths}-й месяц (лимит — 3 месяца).`,
  })
  if (activeMonths > 3) {
    recommendations.push(
      'Этот клиент по сроку уже вне KPI. Новый лид в зарплату с него не будет. Если дата открытия ошибочная (поставили день занесения в CRM вместо первого общения) — исправьте календарь «Дата открытия лида» в карточке.',
    )
  }
  if (!client.openedDate && !client.openedMonth) {
    recommendations.push(
      'В карточке нет даты открытия. Система считает это 1-м месяцем. Проставьте реальный первый контакт — иначе срок 3 месяцев считается неверно.',
    )
  }

  gates.push({
    id: 'log',
    title: 'Запись в журнале KPI за месяц (ступень 2-Б)',
    status: log ? 'pass' : 'fail',
    detail: log
      ? `Засчитан. В kpi_lead_log есть документ: ${log.clientName}, менеджер ${log.assignedToName || '—'}, этап на момент записи «${stageLabel(log.stage)}», источник ${log.source || 'не указан'}, весомых моментов ${log.significantMoments ?? '—'}, полки: ${catList(shelvesFromLog)}.`
      : `В журнале KPI за ${month} этой карточки нет. Значит в зарплату (ткань / ГП / Европа) клиент не попал, даже если в карточке сейчас стоит «квалифицирован».`,
  })

  gates.push({
    id: 'autodeal',
    title: 'Автозачёт: сделка в 1-м месяце (ступень 2-В)',
    status: autoDeal ? 'pass' : 'skip',
    detail: autoDeal
      ? 'Сейчас этап «Сделка» и это 1-й месяц работы — по правилам должен засчитаться сразу, без трёх шагов (в журнале моменты пишутся как 999).'
      : client.stage === 'deal'
        ? `Этап «Сделка», но это ${activeMonths}-й месяц, не первый. Сделка сама по себе KPI-лид не ставит. Нужны обычные шаги менеджера по клиенту в журнале месяца.`
        : 'Этапа «Сделка» нет — автозачёт не применяется.',
  })

  gates.push({
    id: 'final',
    title: 'Закрытые этапы (ступень 2-Г)',
    status: isFinal && !autoDeal ? 'fail' : isFinal ? 'info' : 'pass',
    detail: isFinal && !autoDeal
      ? `Этап «${stageLabel(client.stage)}». Отказ / провал / заброшено / сделка не в 1-м месяце в ночной квалификации не разбираются (кроме уже существующей записи в журнале).`
      : `Этап «${stageLabel(client.stage)}» — обычная воронка, квалификация разрешена.`,
  })

  gates.push({
    id: 'activity',
    title: 'Ступень 1. Активный / пассивный / пауза по журналу месяца',
    status: journalLabel === 'active' ? 'pass' : 'fail',
    detail:
      journalLabel === 'active'
        ? `По журналу за ${formatMonthHuman(month)} есть рабочая запись (комментарий, звонок, этап, шаг, визит, образцы, продажи — кроме «создан» и чистой паузы). Метка: активный. Дней с записями: ${activeDays}. Это ещё НЕ KPI-лид, только допуск ко второй ступени.`
        : journalLabel === 'paused'
          ? `В карточке ожидание «на паузе» и за ${formatMonthHuman(month)} другой работы в истории нет. Метка: на паузе. До KPI такие клиенты не допускаются.`
          : `За ${formatMonthHuman(month)} в истории нет рабочей записи. Метка: пассивный. Написал в Telegram, но не занёс в CRM — для системы работы не было. В KPI не идёт.`,
  })

  const groqActivityMatches = client.activityMonth === month
  gates.push({
    id: 'groq-activity',
    title: 'Что записал Groq по активности (карточка)',
    status: groqActivityMatches ? (client.activityLabel === 'active' ? 'pass' : 'fail') : 'info',
    detail: groqActivityMatches
      ? `В карточке метка Groq за этот же месяц: ${client.activityLabel || 'нет'} (оценка ${client.activityScore ?? '—'}). Текст Groq: «${client.activityReason || '—'}». Важно: метку active/passive/paused ставит не «мнение ИИ», а журнал. ИИ пишет одну фразу, что делали. Если ИИ сказал «клиент не отвечает → пассивный», система эту фразу отбрасывает.`
      : `В карточке активность записана за ${client.activityMonth || 'другой месяц'} (${client.activityLabel || 'нет метки'}). Для ${month} смотрите пересчёт по журналу выше, а не это поле. Текст: «${client.activityReason || '—'}».`,
  })

  const groqKpiMatches = client.kpiQualifiedMonth === month
  const moments = groqKpiMatches
    ? client.kpiSignificantMoments
    : log?.significantMoments
  const groqReason = groqKpiMatches
    ? client.kpiQualificationReason
    : null
  const enoughMoments =
    typeof moments === 'number' && moments >= 900
      ? true
      : typeof moments === 'number' && moments >= minKpiMoments

  gates.push({
    id: 'groq-kpi',
    title: `Ступень 2-Е. Шаги менеджера по клиенту (нужно ≥ ${minKpiMoments})`,
    status: counted
      ? enoughMoments || autoDeal
        ? 'pass'
        : 'info'
      : journalLabel !== 'active' || activeMonths > 3 || (isFinal && !autoDeal)
        ? 'skip'
        : enoughMoments
          ? 'pass'
          : 'fail',
    detail: counted && typeof log?.significantMoments === 'number' && log.significantMoments >= 900
      ? 'В журнале KPI стоит автозачёт сделки (999 моментов).'
      : groqKpiMatches
        ? `По карточке за этот месяц: квалифицирован=${client.kpiQualified ? 'да' : 'нет'}, шагов=${client.kpiSignificantMoments ?? '—'} из ${minKpiMoments}. «${groqReason || '—'}». Считаются шаги менеджера по клиенту (КП, звонок, образцы, этап). Фразы клиента не нужны.`
        : log
          ? `Карточка уже перезаписана другим месяцем. Из журнала KPI: моментов ${log.significantMoments ?? '—'}.`
          : `Отдельной записи Groq-квалификации за ${month} в карточке нет (последний прогон: ${client.kpiQualifiedMonth || 'нет'}). Ночной анализ всегда пишет текущий месяц. Для прошлого месяца источник правды — журнал KPI и журнал истории.`,
  })

  gates.push({
    id: 'shelves',
    title: 'Полки зарплаты: ткань / ГП / Европа',
    status: counted ? 'pass' : 'info',
    detail: counted
      ? `В факт записано: ${catList(shelvesFromLog)}. Сейчас по карточке (страна + продукция) получилось бы: ${catList(shelvesFromCard)}. Европа — если страна европейская (тогда только Европа, план 3). Иначе ткань и/или ГП по галочкам продукции. Один человек может дать +1 ткань и +1 ГП, но в «всего лидов» он один.`
      : `Пока не засчитан. Если бы засчитали, полки взялись бы из карточки: ${catList(shelvesFromCard)} (страна ${client.country || 'не указана'}, продукция ${(client.products || []).join(', ') || 'не указана'}).`,
  })

  if (!counted && journalLabel === 'active' && activeMonths <= 3 && !isFinal) {
    howToFix.push(
      `В карточке ${firstName} → История нужны содержательные шаги: КП, звонок, образцы, смена этапа — не три раза «написала». Минимум ${minKpiMoments} таких шагов, 2 разных вида работы, и либо 2 дня, либо 3 вида за один день.`,
    )
    howToFix.push(
      `Пример 1: «Отправила КП ${firstName} на сатин 40/1, ширина 240, 2000 м».`,
    )
    howToFix.push(
      `Пример 2: «Созвон с ${firstName}: обсудили артикулы, жду ТЗ».`,
    )
    howToFix.push(
      `Пример 3: «Образцы 3 цвета отправлены ${firstName}».`,
    )
    howToFix.push(
      'После записи: Дашборд → этот месяц → «Переанализировать месяц».',
    )
  } else if (!counted && journalLabel !== 'active') {
    howToFix.push(
      `Сначала занесите в Историю хотя бы один факт работы за ${formatMonthHuman(month)} (звонок, комментарий, этап). Без этого KPI даже не рассматривается.`,
    )
  } else if (!counted && activeMonths > 3) {
    howToFix.push(
      'Проверьте дату открытия лида. Если в CRM попали позже реального старта — поставьте день первого общения. Если лид правда 4+ месяца — в KPI он уже не идёт, это правило.',
    )
  } else if (!counted && score.qualifies) {
    howToFix.push(
      `На дашборде выберите ${formatMonthHuman(month)} и нажмите «Переанализировать месяц» — шагов менеджера уже хватает.`,
    )
  }

  if (!counted) {
    recommendations.push(blockingReason)
    recommendations.push(...howToFix)
  } else {
    recommendations.push(
      `Засчитан. В зарплате это +1 к полкам ${catList(shelvesFromLog)}. Новых шагов для этого месяца не нужно.`,
    )
  }

  const verdict = counted
    ? `ЗАСЧИТАНА в KPI-лиды за ${formatMonthHuman(month)}.`
    : `НЕ засчитана. ${blockingReason}`

  return {
    counted,
    verdict,
    month,
    clientName: client.name || client.company || 'Без имени',
    managerName: client.assignedToName || 'без менеджера',
    stageKey: client.stage,
    stageName: stageLabel(client.stage),
    openedRaw: String(openedRaw),
    activeMonths,
    journalLabel,
    activeDays,
    minKpiMoments,
    shelvesFromCard,
    shelvesFromLog,
    storedActivityMonth: client.activityMonth || null,
    storedActivityLabel: client.activityLabel || null,
    storedActivityReason: client.activityReason || null,
    storedKpiMonth: client.kpiQualifiedMonth || null,
    storedKpiQualified: client.kpiQualified ?? null,
    storedKpiMoments: client.kpiSignificantMoments ?? null,
    storedKpiReason: client.kpiQualificationReason || null,
    log,
    gates,
    history: historyLines,
    monthHistoryCount: monthEntries.length,
    managerWorkCount,
    leadStepCount,
    clientStepCount,
    needMoreSteps,
    blockingReason,
    howToFix,
    recommendations,
  }
}
