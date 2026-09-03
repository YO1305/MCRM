import type { Task } from '@/types/task.types'

export interface MonthlyReportRow {
  task: Task
  /** Result from task comments */
  result: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function monthBounds(month: string): { start: string; end: string; label: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(last)}`,
    label: `${pad(1)}.${pad(m)}.${y} - ${pad(last)}.${pad(m)}.${y}`,
  }
}

function taskInMonth(task: Task, start: string, end: string): boolean {
  const due = task.dueDate
  if (due && due >= start && due <= end) return true

  const completed = task.completedAt as { seconds?: number } | null
  if (completed?.seconds) {
    const d = new Date(completed.seconds * 1000)
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    if (iso >= start && iso <= end) return true
  }
  return false
}

/** Important (high) + done tasks for the selected month. */
export function filterMonthlyReportTasks(tasks: Task[], month: string): Task[] {
  const { start, end } = monthBounds(month)
  return tasks
    .filter(
      (t) =>
        t.status === 'done' &&
        t.priority === 'high' &&
        taskInMonth(t, start, end),
    )
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
}

export async function exportMonthlyWorkReport(opts: {
  employeeName: string
  positionLabel: string
  month: string
  rows: MonthlyReportRow[]
}) {
  const XLSX = await import('xlsx')
  const { label } = monthBounds(opts.month)
  const title = 'ОЙДА БАЖАРИЛГАН ИШЛАР БЎЙИЧА ҲИСОБОТ'

  const aoa: (string | number)[][] = [
    [title, '', '', '', '', ''],
    [
      `Масъул ходим: ${opts.employeeName}`,
      `Лавозим: ${opts.positionLabel}`,
      `Давр: ${label}`,
      '',
      '',
      '',
    ],
    [
      '№',
      'Қилинган вазифа номи',
      'Масъул шахс',
      'Натижа',
      'Ҳолати (Бажарилди/Жараёнда)',
      'Изоҳ',
    ],
  ]

  opts.rows.forEach((row, i) => {
    const linksNote = (row.task.links || [])
      .map((l) => `${l.label}: ${l.url}`)
      .join('\n')
    const noteParts = [row.task.description || '', linksNote].filter(Boolean)
    aoa.push([
      i + 1,
      row.task.title,
      row.task.assignedToName || opts.employeeName,
      row.result || '',
      'Бажарилди',
      noteParts.join('\n'),
    ])
  })

  if (opts.rows.length === 0) {
    aoa.push(['', 'Бу ойда «Важно» + бажарилган вазифалар йўқ', '', '', '', ''])
  }

  aoa.push([])
  aoa.push(['Иловалар / Прикрепления (ссылки)', '', '', '', '', ''])

  const allLinks = opts.rows.flatMap((r) =>
    (r.task.links || []).map((l) => ({
      task: r.task.title,
      label: l.label,
      url: l.url,
    })),
  )

  if (allLinks.length === 0) {
    aoa.push(['—', 'Ссылок нет', '', '', '', ''])
  } else {
    aoa.push(['Вазифа', 'Номи', 'Ҳавола', '', '', ''])
    for (const l of allLinks) {
      aoa.push([l.task, l.label, l.url, '', '', ''])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 28 },
    { wch: 45 },
    { wch: 22 },
    { wch: 35 },
  ]
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hisobot')
  const safeName = opts.employeeName.replace(/[^\wа-яёА-ЯЁ\- ]+/gi, '').trim() || 'xodim'
  XLSX.writeFile(wb, `Hisobot_${safeName}_${opts.month}.xlsx`)
}
