export type SmmCurrency = 'UZS' | 'USD'
export type SmmPaymentCycle = 'first' | 'second'
export type SmmPaymentStatus = 'pending' | 'paid'

/** Payment line template for a team (constructor). */
export interface SmmPaymentItem {
  id: string
  teamId: string
  label: string
  amount: number
  currency: SmmCurrency
  usdRate: number | null
  amountUZS: number
  order: number
  isActive: boolean
  createdBy: string
  createdAt?: unknown
  updatedAt?: unknown
}

export interface SmmPaymentItemInput {
  teamId: string
  label: string
  amount: number
  currency: SmmCurrency
  usdRate?: number | null
  order?: number
  isActive?: boolean
}

/** Monthly payment record for one item × cycle. */
export interface SmmPayment {
  id: string
  teamId: string
  itemId: string
  itemLabel: string
  teamName: string
  agencyName: string
  amount: number
  currency: SmmCurrency
  period: string
  paymentCycle: SmmPaymentCycle
  status: SmmPaymentStatus
  paidAt?: unknown | null
  paidBy?: string | null
  note?: string | null
  createdAt?: unknown
  updatedAt?: unknown
}

export function computeAmountUZS(
  amount: number,
  currency: SmmCurrency,
  usdRate?: number | null,
): number {
  if (currency === 'USD') {
    const rate = Number(usdRate) || 0
    return Math.round(amount * rate)
  }
  return Math.round(amount)
}

export const CYCLE_LABELS: Record<SmmPaymentCycle, string> = {
  first: '10-е',
  second: '25-е',
}
