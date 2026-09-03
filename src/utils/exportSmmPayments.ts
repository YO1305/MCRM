import type { SmmPayment, SmmPaymentCycle } from '@/types/smmPayment.types'
import { CYCLE_LABELS } from '@/types/smmPayment.types'

export async function exportSmmPaymentsExcel(
  payments: SmmPayment[],
  month: string,
  cycle: SmmPaymentCycle,
) {
  const XLSX = await import('xlsx')
  const sorted = [...payments].sort(
    (a, b) =>
      a.teamName.localeCompare(b.teamName, 'ru') ||
      a.itemLabel.localeCompare(b.itemLabel, 'ru'),
  )

  const rows = sorted.map((p) => ({
    Команда: p.teamName,
    Агентство: p.agencyName || '',
    'Статья оплаты': p.itemLabel,
    'Сумма (сум)': p.amount,
    Статус: p.status === 'paid' ? 'Оплачено' : 'К оплате',
    'К оплате (сум)': p.status === 'pending' ? p.amount : 0,
  }))

  const total = sorted
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  rows.push({
    Команда: '',
    Агентство: '',
    'Статья оплаты': '',
    'Сумма (сум)': 0,
    Статус: 'ИТОГО К ОПЛАТЕ',
    'К оплате (сум)': total,
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'SMM Оплата')
  const cycleFile = cycle === 'first' ? '10' : '25'
  XLSX.writeFile(wb, `SMM_Оплата_${month}_${cycleFile}.xlsx`)
}

export { CYCLE_LABELS }
