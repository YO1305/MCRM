export type KpiDeptRole = 'head' | 'designer' | 'assistant'

export type DutyStatus = 'yes' | 'partial' | 'no'

export interface CompanyKpiInput {
  bizPlan: number
  bizFact: number
  europePlan: number
  europeFact: number
  gpPlan: number
  gpFact: number
}

export interface TeamLeadPcts {
  aygulFabric: number
  aygulGp: number
  aygulEurope: number
  kunduzFabric: number
  kunduzGp: number
  kunduzEurope: number
}

export interface ExhibitionRow {
  id: string
  name: string
  type: 'international' | 'regional'
  approved: boolean
  done: boolean
}

export interface DutyRow {
  id: string
  title: string
  status: DutyStatus
  comment: string
}

export interface CertificateFlags {
  iso: boolean
  betterWork: boolean
  oekoFabric: boolean
  oekoGp: boolean
  bsci: boolean
}

export interface HeadPayrollInput {
  daysPlan: number
  daysFact: number
  company: CompanyKpiInput
  milestonesPct: number
  teamLeads: TeamLeadPcts
  exhibitions: ExhibitionRow[]
  certificates: CertificateFlags
  duties: DutyRow[]
}

export interface DesignerPayrollInput {
  daysPlan: number
  daysFact: number
  videos: number
  catalogs: number
  mpCards: number
  siteNews: number
  siteProducts: number
}

export interface AssistantPayrollInput {
  daysPlan: number
  daysFact: number
  certificates: CertificateFlags
  subsidy: number
}

export interface KpiDeptPayrollDoc {
  id: string
  role: KpiDeptRole
  month: string
  head?: HeadPayrollInput
  designer?: DesignerPayrollInput
  assistant?: AssistantPayrollInput
}
