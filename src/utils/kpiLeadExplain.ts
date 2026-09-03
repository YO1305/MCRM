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
  { re: /запрос\w*\s+образц|попросил\w*\s+образц|нужн\w*\s+образц/i, label: 'запрос образцов' },
  { re: /\bтз\b|техническ\w+\s+задани|спецификац/i, label: 'ТЗ / спецификация' },
  { re: /плотност|состав|ширин/i, label: 'запрос параметров ткани' },
  { re: /договор|поставк|инкотерм|логистик/i, label: 'условия договора / поставки' },
  { re: /сч[её]т|реквизит|инвойс/i, label: 'счёт / реквизиты' },
  { re: /получил\w*\s+образц|образц\w*\s+дошл|подтверд\w+\s+получен/i, label: 'подтвердил получение образцов' },
  { re: /выкрас|обратн\w+\s+связ|понравил|не понравил|одобрил/i, label: 'обратная связь / одобрение' },
  { re: /объ[её]м|метров|срок постав|готов\w+\s+к/i, label: 'объём / сроки / готовность' },
  { re: /артикул|цвет\b/i, label: 'артикул / цвет' },
  { re: /предоплат|подпис|оплат/i, label: 'предоплата / подпись' },
]

const MANAGER_ONLY_HINTS: { re: RegExp; label: string }[] = [
  { re: /отправил\w*\s+прайс|выслал\w*\s+прайс|каталог/i, label: 'менеджер отправил прайс/каталог' },
  { re: /напомнил|написала?$|написала?\s|позвонил|созвонил/i, label: 'напоминание / исходящий контакт' },
  { re: /подготов\w+\s+образц/i, label: 'менеджер подготовил образцы' },
  { re: /подумаем|позже|на паузе|ждём решения|ждем решения/i, label: 'ожидание без шага клиента' },
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

function matchHint(text: string, list: { re: RegExp; label: string }[]): string | null {
  for (const item of list) {
    if (item.re.test(text)) return item.label
  }
  return null
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
        looksLikeClientStep: matchHint(text, CLIENT_STEP_HINTS),
        looksLikeManagerOnly: matchHint(text, MANAGER_ONLY_HINTS),
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
  const gates: KpiExplainGate[] = []
  const recommendations: string[] = []

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

  const autoDeal = client.stage === 'deal' && activeMonths === 1
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

  const isFinal = FINAL_STAGES.has(client.stage)
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

  const clientStepLines = historyLines.filter((h) => h.looksLikeClientStep)
  const managerOnlyLines = historyLines.filter((h) => h.looksLikeManagerOnly && !h.looksLikeClientStep)

  if (!counted) {
    if (journalLabel === 'passive') {
      recommendations.push(
        'Занесите в «Историю» реальные действия: итог звонка, комментарий с фактом, смену этапа, следующий шаг. Пустой месяц = пассивный = не KPI.',
      )
    }
    if (journalLabel === 'paused') {
      recommendations.push(
        'Снимите чистое «на паузе» или добавьте работу в том же месяце. Одна пауза без других записей KPI не открывает.',
      )
    }
    if (journalLabel === 'active' && activeMonths <= 3 && !isFinal) {
      if (clientStepLines.length < minKpiMoments) {
        recommendations.push(
          `В тексте журнала похожих на шаг клиента фраз: ${clientStepLines.length} (нужно ${minKpiMoments}). Пишите конкретику: «клиент запросил артикул / ТЗ / объём / подтвердил образцы», а не «написала, ждём».`,
        )
      } else {
        recommendations.push(
          'По журналу работа есть и фразы похожи на шаги клиента, но в kpi_lead_log записи нет. Запустите «Анализ сейчас» в Настройки → ИИ в том месяце, либо проверьте, что прогон был до конца месяца. Прошлый месяц ночной скрипт уже не переписывает.',
        )
      }
    }
    if (managerOnlyLines.length && !clientStepLines.length) {
      recommendations.push(
        'Все записи похожи на действия менеджера (прайс, напомнил, подготовил). Это делает клиента активным, но KPI-лидом — нет.',
      )
    }
  } else {
    recommendations.push(
      `Засчитан в KPI за ${formatMonthHuman(month)}. В зарплате Айгуль/Кундуз это +1 к полкам ${catList(shelvesFromLog)}.`,
    )
  }

  let verdict: string
  if (counted) {
    verdict = `ЗАСЧИТАН в KPI-лиды за ${formatMonthHuman(month)}.`
  } else if (activeMonths > 3) {
    verdict = `НЕ засчитан: ${activeMonths}-й месяц ведения (лимит 3).`
  } else if (journalLabel !== 'active') {
    verdict =
      journalLabel === 'paused'
        ? 'НЕ засчитан: на паузе без другой работы в этом месяце (ступень 1 не пройдена).'
        : 'НЕ засчитан: пассивный — в истории месяца нет работы (ступень 1 не пройдена).'
  } else if (isFinal && !autoDeal) {
    verdict = `НЕ засчитан: этап «${stageLabel(client.stage)}» не квалифицируется.`
  } else if (groqKpiMatches && client.kpiQualified === false) {
    verdict = `НЕ засчитан: активный, но Groq не набрал ${minKpiMoments} шагов клиента (${client.kpiSignificantMoments ?? 0}).`
  } else {
    verdict = `НЕ засчитан: в журнале KPI за ${month} записи нет.`
  }

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
    recommendations,
  }
}
