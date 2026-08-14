import type { Task } from '@/types/task.types'
import { TASK_STATUSES } from '@/constants/taskStatuses'
import { TASK_PRIORITIES } from '@/constants/taskMeta'
import { todayISO } from '@/utils/dates'

function escapeCsv(value: string) {
  const v = value.replace(/"/g, '""')
  return /[",\n\r;]/.test(v) ? `"${v}"` : v
}

/** CSV с BOM — открывается в Excel без кракозябр. */
export function exportTasksToExcel(tasks: Task[], filenamePrefix = 'zadachi') {
  const headers = [
    'Название',
    'Описание',
    'Статус',
    'Приоритет',
    'Исполнитель',
    'Поставил',
    'Дата начала',
    'Срок',
    'Просрочена',
    'По шаблону',
    'Ссылки',
  ]

  const today = todayISO()
  const rows = tasks.map((t) => {
    const overdue = t.status !== 'done' && !!t.dueDate && t.dueDate < today
    return [
      t.title,
      t.description || '',
      TASK_STATUSES[t.status],
      TASK_PRIORITIES[t.priority],
      t.assignedToName,
      t.createdByName,
      t.startDate || '',
      t.dueDate || '',
      overdue ? 'да' : 'нет',
      t.sourceTemplateId ? 'да' : 'нет',
      (t.links || []).map((l) => l.url).join(' | '),
    ].map((cell) => escapeCsv(String(cell)))
  })

  const csv = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}_${today}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
