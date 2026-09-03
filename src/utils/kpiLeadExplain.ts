import { stageLabel } from '@/constants/clientStages'
import { LEAD_CATEGORIES } from '@/constants/clientMeta'
import { resolveKpiCategories } from '@/constants/leadProducts'
import type { Client, ClientHistoryEntry, ClientHistoryType } from '@/types/client.types'
import type { KpiLeadLog, LeadCategory } from '@/types/kpiLead.types'
import { calculateActiveDaysFromHistory } from '@/utils/groqLeadActivity'

const SKIP_TYPES = new Set<string>(['created', 'system', 'auto'])
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

const CLIENT_STEP_HINTS: { re: RegExp; label: string }[] = [
  { re: /клиент\s+(запрос|попросил|просил|прислал|написал|подтверд|соглас|одобрил|дал)/i, label: 'действие клиента в тексте' },
  { re: /запрос\w*\s+(кп|коммерч|образц)|попросил\w*\s+(кп|образц)|нужн\w*\s+образц/i, label: 'клиент запросил КП / образцы' },
  { re: /\bтз\b|техническ\w+\s+задани|спецификац/i, label: 'ТЗ / спецификация' },
  { re: /плотност|состав|ширин/i, label: 'запрос параметров ткани' },
  { re: /договор|поставк|инкотерм|логистик/i, label: 'условия договора / поставки' },
  { re: /сч[её]т|реквизит|инвойс/i, label: 'счёт / реквизиты' },
  { re: /получил\w*\s+(образц|кп)|образц\w*\s+дошл|подтверд\w+\s+получен/i, label: 'подтвердил получение' },
  { re: /выкрас|обратн\w+\s+связ|понравил|не понравил|одобрил/i, label: 'обратная связь / одобрение' },
  { re: /объ[её]м|метров|срок постав|готов\w+\s+к/i, label: 'объём / сроки / готовность' },
  { re: /артикул/i, label: 'артикул' },
  { re: /предоплат|подпис|оплат/i, label: 'предоплата / подпись' },
]

const MANAGER_ONLY_HINTS: { re: RegExp; label: string; rewrite: string }[] = [
  {
    re: /отправил\w*\s+(кп|коммерч)|выслал\w*\s+(кп|коммерч)|подготов\w+\s+(кп|коммерч)|кп\s+отправ/i,
    label: 'менеджер сама отправила КП',
    rewrite: 'Клиент запросила КП на [артикул, ширина, метры]. КП отправлена.',
  },
  {
    re: /отправил\w*\s+прайс|выслал\w*\s+прайс|каталог/i,
    label: 'менеджер отправила прайс/каталог',
    rewrite: 'Клиент запросила прайс на [артикул / вид ткани].',
  },
  {
    re: /шаг выполнен|предоставить цен/i,
    label: 'внутренний шаг менеджера',
    rewrite: 'Клиент запросила цены / КП по [конкретный артикул].',
  },
  {
    re: /напомнил|написала|написал\b|позвонил|созвонил/i,
    label: 'исходящий контакт менеджера',
    rewrite: 'Клиент ответила: [что именно попросила / подтвердила].',
  },
  {
    re: /подготов\w+\s+образц/i,
    label: 'менеджер подготовила образцы',
    rewrite: 'Клиент запросила образцы артикулов [список] / подтвердила получение.',
  },
  {
    re: /подумаем|позже|на паузе|ждём решения|ждем решения|ожида/i,
    label: 'ожидание без шага клиента',
    rewrite: 'Клиент попросила подождать до [дата] / пришлёт ТЗ [что именно].',
  },
]

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
  kind: 'client' | 'manager' | 'noise'
  /** yes = шаг клиента (KPI), no = только работа менеджера */
  kpiCounted: boolean
  why: string
  rewrite?: string
  looksLikeClientStep: string | null
  looksLikeManagerOnly: string | null
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
  clientStepCount: number
  needMoreSteps: number
  blockingReason: string
  howToFix: string[]
  recommendations: string[]
}

function isPauseText(value: string | null | undefined): boolean {
  return String(value || '').toLowerCase().includes('на паузе')
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
    if (SKIP_TYPES.has(String(e.type || ''))) return false
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

function matchHint<T extends { re: RegExp; label: string }>(
  text: string,
  list: T[],
): T | null {
  for (const item of list) {
    if (item.re.test(text)) return item
  }
  return null
}

function classifyKpiLine(text: string, countsAsWork: boolean, skip: boolean): {
  kind: 'client' | 'manager' | 'noise'
  kpiCounted: boolean
  why: string
  rewrite?: string
  looksLikeClientStep: string | null
  looksLikeManagerOnly: string | null
} {
  if (skip || !countsAsWork) {
    return {
      kind: 'noise',
      kpiCounted: false,
      why: 'Не учитывается ни как работа, ни как KPI.',
      looksLikeClientStep: null,
      looksLikeManagerOnly: null,
    }
  }
  const clientHit = matchHint(text, CLIENT_STEP_HINTS)
  if (clientHit) {
    return {
      kind: 'client',
      kpiCounted: true,
      why: `Учтено как шаг клиента: ${clientHit.label}. Это идёт в KPI-лид.`,
      looksLikeClientStep: clientHit.label,
      looksLikeManagerOnly: null,
    }
  }
  const mgr = matchHint(text, MANAGER_ONLY_HINTS)
  if (mgr) {
    return {
      kind: 'manager',
      kpiCounted: false,
      why: `Учтено только как работа менеджера (${mgr.label}). Клиент из‑за этого активный, но в KPI-лид эта строка НЕ идёт.`,
      rewrite: mgr.rewrite,
      looksLikeClientStep: null,
      looksLikeManagerOnly: mgr.label,
    }
  }
  if (/\bкп\b|коммерческ/i.test(text)) {
    return {
      kind: 'manager',
      kpiCounted: false,
      why: 'В тексте есть КП / коммерческое, но нет действия клиента («запросила», «подтвердила»). Это работа менеджера, не KPI.',
      rewrite: 'Клиент запросила КП на [артикул, ширина, метры]. КП отправлена.',
      looksLikeClientStep: null,
      looksLikeManagerOnly: 'КП без шага клиента',
    }
  }
  return {
    kind: 'manager',
    kpiCounted: false,
    why: 'Работа в журнале есть (активный), но в тексте нет шага клиента. Groq такое обычно не считает в KPI.',
    rewrite: 'Клиент запросила [КП / образцы / ТЗ / объём] — напишите её слова, не «я отправила».',
    looksLikeClientStep: null,
    looksLikeManagerOnly: 'неясная формулировка',
  }
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
      const skip = SKIP_TYPES.has(e.type) || e.type === ('system' as ClientHistoryType)
      const pauseOnly = e.type === 'wait_status' && isPauseText(e.text)
      const countsAsWork = !skip && !pauseOnly
      const text = String(e.text || '').trim()
      const kpi = classifyKpiLine(text, countsAsWork, skip)
      return {
        date,
        type: e.type,
        typeLabel: HISTORY_TYPE_LABELS[e.type] || e.type,
        text: text || '—',
        skip,
        skipReason: skip
          ? 'Системная запись / «клиент создан» — в работу месяца не входит'
          : pauseOnly
            ? 'Только статус «на паузе» — день работы не даёт'
            : undefined,
        countsAsWork,
        kind: kpi.kind,
        kpiCounted: kpi.kpiCounted,
        why: kpi.why,
        rewrite: kpi.rewrite,
        looksLikeClientStep: kpi.looksLikeClientStep,
        looksLikeManagerOnly: kpi.looksLikeManagerOnly,
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
  const clientStepCount = historyLines.filter((h) => h.kpiCounted).length
  const needMoreSteps = Math.max(0, minKpiMoments - clientStepCount)
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
  } else if (clientStepCount < minKpiMoments) {
    blockingReason = `Не засчитан, хотя работа есть. В журнале ${managerWorkCount} записей менеджера (это делает лид АКТИВНЫМ), но шагов КЛИЕНТА похоже ${clientStepCount} из ${minKpiMoments}. Отправка КП / прайса / «написала» — работа менеджера, не KPI-лид.`
  } else {
    blockingReason = `Не засчитан: в тексте уже видно ${clientStepCount} шага клиента, но в журнале зарплаты (kpi_lead_log) за ${month} записи нет. Нужно прогнать анализ за этот месяц на дашборде.`
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
    status: counted ? 'pass' : clientStepCount >= minKpiMoments ? 'info' : 'fail',
    detail: `За ${formatMonthHuman(month)}: записей в истории ${monthEntries.length}. Учтено как работа менеджера (активный лид): ${managerWorkCount}. Учтено как шаг клиента (KPI): ${clientStepCount} из ${minKpiMoments}. ${
      counted
        ? 'Порог шагов выполнен или стоит автозачёт — клиент в зарплате.'
        : `До KPI-лида не хватает ${needMoreSteps} шаг(а) клиента в тексте истории.`
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
      ? 'Сейчас этап «Сделка» и это 1-й месяц работы — по правилам должен засчитаться сразу, без трёх шагов клиента (в журнале моменты пишутся как 999).'
      : client.stage === 'deal'
        ? `Этап «Сделка», но это ${activeMonths}-й месяц, не первый. Сделка сама по себе KPI-лид не ставит. Нужны обычные весомые шаги клиента в журнале месяца.`
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
    title: `Ступень 2-Е. Весомые шаги клиента (нужно ≥ ${minKpiMoments})`,
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
        ? `Groq по карточке за этот месяц: квалифицирован=${client.kpiQualified ? 'да' : 'нет'}, моментов=${client.kpiSignificantMoments ?? '—'} из ${minKpiMoments}. Причина: «${groqReason || '—'}». qualifies=true только если моментов ≥ ${minKpiMoments}. Считается шаг КЛИЕНТА (даже если фразу написал менеджер: «клиент запросил образцы 40/1»). Не считается: сам прайс, напоминание, «подумаем», общая цена.`
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

  const managerOnlyLines = historyLines.filter((h) => h.countsAsWork && !h.kpiCounted)

  if (!counted && journalLabel === 'active' && activeMonths <= 3 && !isFinal) {
    howToFix.push(
      `Откройте карточку ${firstName} → История и допишите ещё ${needMoreSteps || minKpiMoments} фразы, где субъект — клиент, не менеджер.`,
    )
    howToFix.push(
      `Пример 1: «${firstName} запросила КП на сатин 40/1, ширина 240, объём 2000 м».`,
    )
    howToFix.push(
      `Пример 2: «${firstName} подтвердила получение КП / образцов, ждёт расчёт по артикулу …».`,
    )
    howToFix.push(
      `Пример 3: «${firstName} согласовала артикул / цвет / срок поставки».`,
    )
    if (managerOnlyLines.length) {
      howToFix.push(
        `Сейчас в журнале как работа менеджера (активно, но не KPI): ${managerOnlyLines
          .slice(0, 4)
          .map((h) => `${h.date} — ${h.text.slice(0, 80)}`)
          .join('; ')}. Перепишите эти факты через «клиент запросила / подтвердила», если так и было.`,
      )
    }
    howToFix.push(
      'После записи в историю: Дашборд → выбрать этот месяц → «Переанализировать месяц». Иначе зарплатный журнал не обновится.',
    )
  } else if (!counted && journalLabel !== 'active') {
    howToFix.push(
      `Сначала занесите в Историю хотя бы один факт работы за ${formatMonthHuman(month)} (звонок, комментарий, этап). Без этого KPI даже не рассматривается.`,
    )
  } else if (!counted && activeMonths > 3) {
    howToFix.push(
      'Проверьте дату открытия лида. Если в CRM попали позже реального старта — поставьте день первого общения. Если лид правда 4+ месяца — в KPI он уже не идёт, это правило.',
    )
  } else if (!counted && clientStepCount >= minKpiMoments) {
    howToFix.push(
      `На дашборде выберите ${formatMonthHuman(month)} и нажмите «Переанализировать месяц» — шаги клиента в тексте уже есть.`,
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
    clientStepCount,
    needMoreSteps,
    blockingReason,
    howToFix,
    recommendations,
  }
}
