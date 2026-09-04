export type KpiPayrollRole = 'aygul' | 'kunduz'

export type DealBandId =
  | 'fabric_1_10'
  | 'fabric_10_50'
  | 'fabric_50'
  | 'finished_1_10'
  | 'finished_10_50'
  | 'finished_50'

export type InstagramTierId = 't170' | 't170_200' | 't200_225' | 't225_250' | 't250'

export interface KpiPayrollInputs {
  workDaysPlan: number
  workDaysFact: number
  /** 0 / 0.5 / 1 — только Айгуль */
  smmFact: number
  /** 0 / 1 — только Кундуз */
  showroomFact: number
  dealCounts: Record<DealBandId, number>
  /** Бонус 0,8% от инвойса повторного заказа, уже в тыс сум */
  repeatBonus: number
  instagramTier: InstagramTierId | null
  /** Чистые онлайн-продажи через Direct, в сумах за месяц (не тыс). Только Айгуль. */
  onlineSalesUzs: number
  /** Фикса Instagram Direct 500 тыс, как в Excel. Только Айгуль. */
  instagramDirectFix: boolean
  dutyDone: Record<string, boolean>
  leadOverride: { fabric: number; finished: number; europe: number } | null
}

export type KpiPayrollStatus = 'draft' | 'approved'

export interface KpiPayrollDoc extends KpiPayrollInputs {
  id: string
  roleKey: KpiPayrollRole
  month: string
  savedBy?: string
  savedByName?: string
  /** After director signs: payroll is final. */
  payrollStatus?: KpiPayrollStatus
  approvedAt?: unknown
  approvedBy?: string
  approvedByName?: string
  approvedHandsTotal?: number
}

export interface KpiLeadFacts {
  fabric: number
  finished: number
  europe: number
}

export interface CalculatedKpiRow {
  id: string
  label: string
  weight: number
  plan: number
  fact: number
  ratio: number
  coefficient: number
  amount: number
  source: 'crm' | 'manual'
  hint: string
}

export interface CalculatedDealRow {
  id: DealBandId
  label: string
  count: number
  unitBonus: number
  amount: number
}

export interface KpiPayrollResult {
  salary: number
  kpiFund: number
  fixa: number
  workRatio: number
  block2Rows: CalculatedKpiRow[]
  block2Total: number
  dealRows: CalculatedDealRow[]
  repeatBonus: number
  instagramBonus: number
  instagramLabel: string | null
  onlineSalesUzs: number
  onlineSalesRate: number
  onlineSalesBonus: number
  onlineSalesLabel: string | null
  instagramDirectFixBonus: number
  block3Total: number
  handsTotal: number
}
