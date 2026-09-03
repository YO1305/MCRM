import type { Client } from '@/types/client.types'
import type { User } from '@/types/user.types'
import { stageKpiBucket } from '@/constants/clientStages'
import type {
  CalculatedDealRow,
  CalculatedKpiRow,
  DealBandId,
  InstagramTierId,
  KpiLeadFacts,
  KpiPayrollInputs,
  KpiPayrollResult,
  KpiPayrollRole,
} from '@/types/kpiPayroll.types'

/** MATCH(..., 1) по листу «Коэффициенты»: порог снизу. 100 % → 1.0, не 1.2. */
export function kpiCoefficient(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < 0.6) return 0
  if (ratio < 0.7) return 0.5
  if (ratio < 0.9) return 0.8
  if (ratio < 1.0001) return 1
  if (ratio < 1.1) return 1.2
  return 1.5
}

export const KPI_COEFFICIENT_ROWS = [
  { range: 'менее 60 %', coef: 0, meaning: 'показатель не оплачивается' },
  { range: '60 – 69,99 %', coef: 0.5, meaning: 'половина суммы по показателю' },
  { range: '70 – 89,99 %', coef: 0.8, meaning: '80 % суммы' },
  { range: '90 – 100,00 %', coef: 1, meaning: 'норма — полная сумма' },
  { range: '100,01 – 109,99 %', coef: 1.2, meaning: 'перевыполнение +20 %' },
  { range: '110 % и выше', coef: 1.5, meaning: 'сильное перевыполнение +50 %' },
] as const

export const DEAL_BANDS: {
  id: DealBandId
  label: string
  unitBonus: number
  product: 'fabric' | 'finished'
}[] = [
  { id: 'fabric_1_10', label: 'Ткань · новый клиент · 1 000–10 000 $', unitBonus: 800, product: 'fabric' },
  { id: 'fabric_10_50', label: 'Ткань · новый клиент · 10 000–50 000 $', unitBonus: 1500, product: 'fabric' },
  { id: 'fabric_50', label: 'Ткань · новый клиент · свыше 50 000 $', unitBonus: 3000, product: 'fabric' },
  { id: 'finished_1_10', label: 'ГП · новый клиент · 1 000–10 000 $', unitBonus: 1500, product: 'finished' },
  { id: 'finished_10_50', label: 'ГП · новый клиент · 10 000–50 000 $', unitBonus: 2500, product: 'finished' },
  { id: 'finished_50', label: 'ГП · новый клиент · свыше 50 000 $', unitBonus: 5000, product: 'finished' },
]

export const INSTAGRAM_TIERS: { id: InstagramTierId; label: string; bonus: number }[] = [
  { id: 't170', label: 'До 170 млн сум/мес', bonus: 500 },
  { id: 't170_200', label: '170–200 млн сум/мес', bonus: 1000 },
  { id: 't200_225', label: '200–225 млн сум/мес', bonus: 1500 },
  { id: 't225_250', label: '225–250 млн сум/мес', bonus: 2000 },
  { id: 't250', label: '250 млн+ сум/мес', bonus: 2500 },
]

export const INSTAGRAM_DIRECT_FIX = 500

/** Доля от чистых онлайн-продаж через Direct. Сумма ввода — сумы за месяц. */
export const ONLINE_SALES_TIERS: { maxMln: number; rate: number; label: string }[] = [
  { maxMln: 15, rate: 0.04, label: '0–15 млн · 4%' },
  { maxMln: 40, rate: 0.05, label: '15–40 млн · 5%' },
  { maxMln: 80, rate: 0.06, label: '40–80 млн · 6%' },
  { maxMln: Infinity, rate: 0.07, label: '80 млн+ · 7%' },
]

export function onlineSalesShare(uzs: number): {
  mln: number
  rate: number
  bonusThousands: number
  label: string | null
} {
  const amount = Number.isFinite(uzs) && uzs > 0 ? uzs : 0
  const mln = amount / 1_000_000
  if (amount <= 0) return { mln: 0, rate: 0, bonusThousands: 0, label: null }
  const tier =
    ONLINE_SALES_TIERS.find((t) => mln <= t.maxMln) || ONLINE_SALES_TIERS[ONLINE_SALES_TIERS.length - 1]
  return {
    mln,
    rate: tier.rate,
    bonusThousands: Math.round(((amount * tier.rate) / 1000) * 100) / 100,
    label: tier.label,
  }
}

export interface DutyItem {
  id: string
  title: string
  detail: string
}

export interface KpiRoleTemplate {
  roleKey: KpiPayrollRole
  position: 'leads_manager_1' | 'leads_manager_2'
  nameHint: string
  title: string
  shortName: string
  salary: number
  kpiFund: number
  hasSmm: boolean
  hasShowroom: boolean
  hasInstagram: boolean
  duties: DutyItem[]
}

const SHARED_DUTIES: DutyItem[] = [
  {
    id: 'inbox',
    title: 'Ежедневная обработка входящих — SLA до 2 часов',
    detail:
      'Direct, Telegram, телефон, email. Проверка каналов минимум 3 раза в день, ответ в течение 2 часов в рабочее время, фиксация обращения в CRM с источником.',
  },
  {
    id: 'crm',
    title: 'Ведение CRM / базы лидов',
    detail:
      'Новый контакт в день обращения, статус после каждого взаимодействия, следующий шаг и дата по каждому активному лиду.',
  },
  {
    id: 'handoff',
    title: 'Передача квалифицированных лидов в продажи — SLA до 2 часов',
    detail:
      'Квалификация ткань / ГП / Европа, передача менеджеру продаж с описанием запроса, обратная связь и фиксация в базе.',
  },
  {
    id: 'weekly',
    title: 'Еженедельный отчёт по воронке начальнику',
    detail:
      'Каждый понедельник: сколько входящих, квалифицировано, передано в продажи, стало сделками, где застряли.',
  },
]

const SHOWROOM_DUTIES: DutyItem[] = [
  {
    id: 'showroom_check',
    title: 'Ежедневная проверка шоурума (2 точки)',
    detail:
      'Утренний обход: наличие позиций, чистота, экспозиция, ценники и образцы, фиксация в чек-листе.',
  },
  {
    id: 'showroom_restock',
    title: 'Заявка на пополнение шоурума до конца дня',
    detail: 'При нехватке позиции — заявка в тот же день, контроль поступления, подтверждение в базе шоурума.',
  },
]

export const KPI_ROLE_TEMPLATES: Record<KpiPayrollRole, KpiRoleTemplate> = {
  aygul: {
    roleKey: 'aygul',
    position: 'leads_manager_1',
    nameHint: 'айгуль',
    title: 'Старший менеджер по лидам · Айгуль',
    shortName: 'Айгуль',
    salary: 3025,
    kpiFund: 2000,
    hasSmm: true,
    hasShowroom: false,
    hasInstagram: true,
    duties: [
      ...SHARED_DUTIES,
      {
        id: 'social',
        title: 'Входящие из соцсетей (только Айгуль)',
        detail:
          'Direct Instagram и Telegram по онлайн-заказам, оформление, координация со складом, подтверждение сроков и стоимости.',
      },
      {
        id: 'smm',
        title: 'Контроль SMM-подрядчиков (только Айгуль)',
        detail:
          'Еженедельная проверка плана публикаций, статистика охвата в конце месяца, отчёт начальнику.',
      },
    ],
  },
  kunduz: {
    roleKey: 'kunduz',
    position: 'leads_manager_2',
    nameHint: 'кундуз',
    title: 'Менеджер по лидам · Кундуз',
    shortName: 'Кундуз',
    salary: 3025,
    kpiFund: 1200,
    hasSmm: false,
    hasShowroom: true,
    hasInstagram: false,
    duties: [...SHARED_DUTIES, ...SHOWROOM_DUTIES],
  },
}

export function emptyDealCounts(): Record<DealBandId, number> {
  return {
    fabric_1_10: 0,
    fabric_10_50: 0,
    fabric_50: 0,
    finished_1_10: 0,
    finished_10_50: 0,
    finished_50: 0,
  }
}

export function defaultPayrollInputs(role: KpiPayrollRole): KpiPayrollInputs {
  const duties = KPI_ROLE_TEMPLATES[role].duties
  const dutyDone: Record<string, boolean> = {}
  for (const d of duties) dutyDone[d.id] = true
  return {
    workDaysPlan: 26,
    workDaysFact: 26,
    smmFact: 0,
    showroomFact: 0,
    dealCounts: emptyDealCounts(),
    repeatBonus: 0,
    instagramTier: null,
    onlineSalesUzs: 0,
    instagramDirectFix: false,
    dutyDone,
    leadOverride: null,
  }
}

export function payrollDocId(role: KpiPayrollRole, month: string) {
  return `${role}_${month}`
}

export function findPayrollManager(users: User[], role: KpiPayrollRole): User | undefined {
  const tpl = KPI_ROLE_TEMPLATES[role]
  const samePos = users.filter((u) => u.isActive !== false && u.position === tpl.position)
  const byName = samePos.find((u) => u.name.toLowerCase().includes(tpl.nameHint))
  return byName || samePos[0]
}

export function formatKpiMoney(amount: number): string {
  const n = Math.round(amount * 10) / 10
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс сум`
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0 %'
  return `${Math.round(ratio * 1000) / 10} %`
}

/** Сумма в CRM: мелкие числа считаем USD, крупные — сумы (курс 12 500). */
export function dealAmountUsd(amount: number | null | undefined): number | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null
  if (amount >= 100_000) return amount / 12_500
  return amount
}

export function classifyDealBand(usd: number): '1_10' | '10_50' | '50' | null {
  if (usd < 1000) return null
  if (usd < 10_000) return '1_10'
  if (usd < 50_000) return '10_50'
  return '50'
}

export function dealProductSide(client: Pick<Client, 'products'>): 'fabric' | 'finished' | 'both' | null {
  const fabric = client.products?.includes('fabric')
  const finished = client.products?.includes('finished')
  if (fabric && finished) return 'both'
  if (fabric) return 'fabric'
  if (finished) return 'finished'
  return null
}

export function clientInMonth(iso: string | null | undefined, month: string): boolean {
  if (!iso) return false
  return iso.slice(0, 7) === month
}

export function isDealClient(client: Pick<Client, 'stage'>): boolean {
  return stageKpiBucket(client.stage) === 'deal' || client.stage === 'deal'
}

export interface SuggestedDeal {
  clientId: string
  clientName: string
  usd: number | null
  rawAmount: number | null
  bandId: DealBandId | null
  product: 'fabric' | 'finished' | 'both' | null
  date: string | null
  note: string
}

export function suggestDealsForMonth(clients: Client[], managerId: string, month: string): SuggestedDeal[] {
  if (!managerId) return []
  const rows: SuggestedDeal[] = []
  for (const c of clients) {
    if (c.assignedTo !== managerId) continue
    if (!isDealClient(c)) continue
    const date = c.lastStageChangeDate || null
    if (date && !clientInMonth(date, month)) continue
    const usd = dealAmountUsd(c.dealAmount)
    const product = dealProductSide(c)
    const size = usd != null ? classifyDealBand(usd) : null
    let bandId: DealBandId | null = null
    if (size && product === 'fabric') bandId = `fabric_${size}` as DealBandId
    if (size && product === 'finished') bandId = `finished_${size}` as DealBandId
    const noteParts: string[] = []
    if (!date) noteParts.push('нет даты перехода в сделку — проверьте месяц')
    if (usd == null) noteParts.push('нет суммы сделки')
    else if (usd < 1000) noteParts.push('меньше 1 000 $ — бонус не положен')
    if (product === 'both') noteParts.push('ткань и ГП — укажите диапазон вручную')
    if (!product) noteParts.push('не указана продукция')
    rows.push({
      clientId: c.id,
      clientName: c.name || c.company || 'Без имени',
      usd,
      rawAmount: c.dealAmount,
      bandId,
      product,
      date,
      note: noteParts.join('. '),
    })
  }
  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

export function applySuggestedDealCounts(suggestions: SuggestedDeal[]): Record<DealBandId, number> {
  const counts = emptyDealCounts()
  for (const s of suggestions) {
    if (s.bandId) counts[s.bandId] += 1
  }
  return counts
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function block2Row(
  id: string,
  label: string,
  weight: number,
  plan: number,
  fact: number,
  fund: number,
  source: 'crm' | 'manual',
  hint: string,
): CalculatedKpiRow {
  const ratio = plan > 0 ? fact / plan : 0
  const coefficient = kpiCoefficient(ratio)
  const amount = roundMoney(fund * weight * coefficient)
  return { id, label, weight, plan, fact, ratio, coefficient, amount, source, hint }
}

export function calculatePayroll(
  role: KpiPayrollRole,
  inputs: KpiPayrollInputs,
  leadFacts: KpiLeadFacts,
): KpiPayrollResult {
  const tpl = KPI_ROLE_TEMPLATES[role]
  const salary = tpl.salary
  const kpiFund = tpl.kpiFund
  const planDays = inputs.workDaysPlan > 0 ? inputs.workDaysPlan : 26
  const workRatio = planDays > 0 ? inputs.workDaysFact / planDays : 0
  const fixa = roundMoney(salary * workRatio)

  const facts = inputs.leadOverride ?? leadFacts
  const block2Rows: CalculatedKpiRow[] = [
    block2Row(
      'fabric',
      'Лиды: ткань (шт/мес)',
      0.3,
      5,
      facts.fabric,
      kpiFund,
      inputs.leadOverride ? 'manual' : 'crm',
      'Квалифицированные KPI-лиды по ткани за месяц из журнала (шаги менеджера по клиенту). Один лид может дать и ткань, и ГП.',
    ),
    block2Row(
      'finished',
      'Лиды: ГП (шт/мес)',
      0.3,
      5,
      facts.finished,
      kpiFund,
      inputs.leadOverride ? 'manual' : 'crm',
      'Квалифицированные KPI-лиды по готовой продукции.',
    ),
    block2Row(
      'europe',
      'Лиды: Европа (шт/мес)',
      0.2,
      3,
      facts.europe,
      kpiFund,
      inputs.leadOverride ? 'manual' : 'crm',
      'Лиды с европейских рынков. План ниже из‑за длинного цикла.',
    ),
  ]

  if (tpl.hasSmm) {
    block2Rows.push(
      block2Row(
        'smm',
        'SMM-подрядчики: контроль контента и взаиморасчётов',
        0.2,
        1,
        inputs.smmFact,
        kpiFund,
        'manual',
        'План = 1. Факт 1, если за месяц проверен контент-план, взаиморасчёты и отчёты. Ниже 60 % коэффициент 0.',
      ),
    )
  }
  if (tpl.hasShowroom) {
    block2Rows.push(
      block2Row(
        'showroom',
        'Шоурум в норме (чистота, наличие, экспозиция)',
        0.2,
        1,
        inputs.showroomFact,
        kpiFund,
        'manual',
        'Бинарно: 0 или 1 за состояние двух шоурумов за месяц.',
      ),
    )
  }

  const block2Total = roundMoney(block2Rows.reduce((s, r) => s + r.amount, 0))

  const dealRows: CalculatedDealRow[] = DEAL_BANDS.map((b) => {
    const count = Math.max(0, Number(inputs.dealCounts[b.id]) || 0)
    return {
      id: b.id,
      label: b.label,
      count,
      unitBonus: b.unitBonus,
      amount: roundMoney(count * b.unitBonus),
    }
  })

  const instagram = tpl.hasInstagram
    ? INSTAGRAM_TIERS.find((t) => t.id === inputs.instagramTier)
    : undefined
  const instagramBonus = instagram?.bonus ?? 0
  const online = tpl.hasInstagram
    ? onlineSalesShare(inputs.onlineSalesUzs)
    : { mln: 0, rate: 0, bonusThousands: 0, label: null as string | null }
  const instagramDirectFixBonus =
    tpl.hasInstagram && inputs.instagramDirectFix ? INSTAGRAM_DIRECT_FIX : 0
  const repeatBonus = Math.max(0, Number(inputs.repeatBonus) || 0)
  const block3Total = roundMoney(
    dealRows.reduce((s, r) => s + r.amount, 0) +
      repeatBonus +
      instagramBonus +
      online.bonusThousands +
      instagramDirectFixBonus,
  )

  return {
    salary,
    kpiFund,
    fixa,
    workRatio,
    block2Rows,
    block2Total,
    dealRows,
    repeatBonus,
    instagramBonus,
    instagramLabel: instagram?.label ?? null,
    onlineSalesUzs: inputs.onlineSalesUzs || 0,
    onlineSalesRate: online.rate,
    onlineSalesBonus: online.bonusThousands,
    onlineSalesLabel: online.label,
    instagramDirectFixBonus,
    block3Total,
    handsTotal: roundMoney(fixa + block2Total + block3Total),
  }
}

export const KPI_EXPLAIN_GENERAL = {
  title: 'Как считается зарплата (как в Excel)',
  formula: 'НА РУКИ = Фикса + KPI блока 2 + Бонусы от сделок',
  blocks: [
    {
      title: 'Блок 1 — фикса',
      text: 'Оклад × (раб. дни факт ÷ раб. дни план). При 26 из 26 = 100 % оклада. Чек-лист обязанностей входит в оклад, отдельно не оплачивается.',
    },
    {
      title: 'Блок 2 — KPI',
      text: 'Фонд KPI × вес показателя × коэффициент. Коэффициент ступенчатый, не пропорциональный: меньше 60 % — ноль, ровно 100 % — коэффициент 1,0 (не 1,2).',
    },
    {
      title: 'Блок 3 — бонусы',
      text: 'Вне фонда KPI. Сделки с новым клиентом — по диапазону $. Повторный заказ: 0,8 % от инвойса. У Айгуль ещё: оборот магазина (Instagram / филиал, одна ступень), доля от чистых онлайн-продаж через Direct (4–7 %) и фикса Direct 500 тыс.',
    },
  ],
}
