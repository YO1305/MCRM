import { kpiCoefficient } from '@/constants/kpiPayroll'
import type {
  AssistantPayrollInput,
  CertificateFlags,
  DesignerPayrollInput,
  DutyRow,
  ExhibitionRow,
  HeadPayrollInput,
} from '@/types/kpiDeptPayroll.types'

export const HEAD_SALARY = 5000
export const HEAD_KPI_FUND = 4500
export const DESIGNER_SALARY = 3025
export const ASSISTANT_SALARY = 3000

export const CERT_TARIFFS = {
  iso: 300,
  betterWork: 2000,
  oekoFabric: 2000,
  oekoGp: 2000,
  bsci: 3000,
} as const

export const CERT_SHARE_ASSISTANT = 0.7
export const CERT_SHARE_HEAD = 0.3

export const DEFAULT_EXHIBITIONS: ExhibitionRow[] = [
  { id: 'frankfurt', name: 'Франкфурт (Heimtextil)', type: 'international', approved: true, done: false },
  { id: 'poland', name: 'Польша', type: 'international', approved: true, done: false },
  { id: 'moscow', name: 'Москва', type: 'regional', approved: true, done: false },
  { id: 'tashkent', name: 'Ташкент', type: 'regional', approved: true, done: false },
]

export const HEAD_DUTIES: { id: string; title: string }[] = [
  { id: 'tasks', title: 'Постановка и контроль ежедневных/еженедельных задач команде' },
  { id: 'reports', title: 'Регулярная отчётность руководству (еженедельно/ежемесячно)' },
  { id: 'sales', title: 'Координация с отделами продаж (ткань/ГП) по маркетинговым вопросам' },
  { id: 'budget', title: 'Контроль бюджета отдела маркетинга' },
  { id: 'strategy', title: 'Контроль прогресса по стратегическим проектам развития' },
]

export function emptyDuties(): DutyRow[] {
  return HEAD_DUTIES.map((d) => ({ ...d, status: 'yes' as const, comment: '' }))
}

export function emptyCerts(): CertificateFlags {
  return { iso: false, betterWork: false, oekoFabric: false, oekoGp: false, bsci: false }
}

export function defaultHeadInput(): HeadPayrollInput {
  return {
    daysPlan: 26,
    daysFact: 26,
    company: {
      bizPlan: 10000000,
      bizFact: 0,
      europePlan: 0.2,
      europeFact: 0,
      gpPlan: 0.35,
      gpFact: 0,
    },
    milestonesPct: 0,
    teamLeads: {
      aygulFabric: 0,
      aygulGp: 0,
      aygulEurope: 0,
      kunduzFabric: 0,
      kunduzGp: 0,
      kunduzEurope: 0,
    },
    exhibitions: DEFAULT_EXHIBITIONS.map((e) => ({ ...e })),
    certificates: emptyCerts(),
    duties: emptyDuties(),
  }
}

export function defaultDesignerInput(): DesignerPayrollInput {
  return {
    daysPlan: 25,
    daysFact: 25,
    videos: 0,
    catalogs: 0,
    mpCards: 0,
    siteNews: 0,
    siteProducts: 0,
  }
}

export function defaultAssistantInput(): AssistantPayrollInput {
  return {
    daysPlan: 26,
    daysFact: 26,
    certificates: emptyCerts(),
    subsidy: 0,
  }
}

export function safeRatio(fact: number, plan: number): number {
  if (!plan || !Number.isFinite(fact) || !Number.isFinite(plan)) return 0
  return fact / plan
}

export function certPayout(flags: CertificateFlags, share: number): number {
  let sum = 0
  if (flags.iso) sum += CERT_TARIFFS.iso
  if (flags.betterWork) sum += CERT_TARIFFS.betterWork
  if (flags.oekoFabric) sum += CERT_TARIFFS.oekoFabric
  if (flags.oekoGp) sum += CERT_TARIFFS.oekoGp
  if (flags.bsci) sum += CERT_TARIFFS.bsci
  return sum * share
}

export function calcHead(input: HeadPayrollInput) {
  const fixa = HEAD_SALARY * safeRatio(input.daysFact, input.daysPlan)
  const c = input.company
  const companyScore =
    0.6 * safeRatio(c.bizFact, c.bizPlan) +
    0.2 * safeRatio(c.europeFact, c.europePlan) +
    0.2 * safeRatio(c.gpFact, c.gpPlan)
  const companyCoeff = kpiCoefficient(companyScore)
  const companyPay = HEAD_KPI_FUND * 0.35 * companyCoeff
  const mileCoeff = kpiCoefficient(input.milestonesPct)
  const milePay = HEAD_KPI_FUND * 0.3 * mileCoeff
  const t = input.teamLeads
  const teamAvg =
    (t.aygulFabric + t.aygulGp + t.aygulEurope + t.kunduzFabric + t.kunduzGp + t.kunduzEurope) / 6
  const teamCoeff = kpiCoefficient(teamAvg)
  const teamPay = HEAD_KPI_FUND * 0.35 * teamCoeff
  const kpiTotal = companyPay + milePay + teamPay
  const expo = input.exhibitions.reduce(
    (s, row) => s + (row.done ? (row.type === 'international' ? 3500 : 1500) : 0),
    0,
  )
  const certs = certPayout(input.certificates, CERT_SHARE_HEAD)
  return {
    fixa,
    companyScore,
    companyCoeff,
    companyPay,
    mileCoeff,
    milePay,
    teamAvg,
    teamCoeff,
    teamPay,
    kpiTotal,
    expo,
    certs,
    total: fixa + kpiTotal + expo + certs,
  }
}

export function calcDesigner(input: DesignerPayrollInput) {
  const fixa = DESIGNER_SALARY * safeRatio(input.daysFact, input.daysPlan)
  const videosPay = 100 * input.videos
  const catalogPay = 1000 * input.catalogs
  const mpRatio = safeRatio(input.mpCards, 15)
  const mpPay = 1000 * mpRatio
  const newsRatio = safeRatio(input.siteNews, 4)
  const productsRatio = safeRatio(input.siteProducts, 2)
  const siteRatio = (newsRatio + productsRatio) / 2
  const sitePay = 1000 * siteRatio
  const extra = videosPay + catalogPay + mpPay + sitePay
  return {
    fixa,
    videosPay,
    catalogPay,
    mpRatio,
    mpPay,
    newsRatio,
    productsRatio,
    siteRatio,
    sitePay,
    extra,
    total: fixa + extra,
  }
}

export function calcAssistant(input: AssistantPayrollInput) {
  const fixa = ASSISTANT_SALARY * safeRatio(input.daysFact, input.daysPlan)
  const certs = certPayout(input.certificates, CERT_SHARE_ASSISTANT)
  const subsidy = input.subsidy || 0
  return { fixa, certs, subsidy, extra: certs + subsidy, total: fixa + certs + subsidy }
}

export function leadKpiRatios(facts: { fabric: number; finished: number; europe: number }) {
  return {
    fabric: safeRatio(facts.fabric, 5),
    gp: safeRatio(facts.finished, 5),
    europe: safeRatio(facts.europe, 3),
  }
}

export function formatPct(ratio: number): string {
  return `${Math.round((ratio || 0) * 1000) / 10} %`
}
