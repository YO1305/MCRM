import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { Download, FileText } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { useTasks } from '@/hooks/useTasks'
import { useUsers } from '@/hooks/useUsers'
import { db } from '@/firebase/config'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { POSITION_LABELS } from '@/constants/positions'
import {
  exportMonthlyWorkReport,
  filterMonthlyReportTasks,
  monthBounds,
  type MonthlyReportRow,
} from '@/utils/exportMonthlyReport'
import type { TaskComment } from '@/types/taskComment.types'
import type { User } from '@/types/user.types'

function currentMonth() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}`
}

async function loadCommentsText(taskId: string): Promise<string> {
  const snap = await getDocs(collection(db, 'tasks', taskId, 'comments'))
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TaskComment)
    .sort((a, b) => {
      const at = (a.createdAt as { seconds?: number } | null)?.seconds ?? 0
      const bt = (b.createdAt as { seconds?: number } | null)?.seconds ?? 0
      return at - bt
    })
  return list.map((c) => c.text).filter(Boolean).join('\n')
}

export function Reports() {
  const { user, isAdmin } = useAuth()
  const { canCreateTasks } = useRole()
  const { tasks, loading } = useTasks()
  const { users } = useUsers(canCreateTasks || isAdmin)

  const [month, setMonth] = useState(currentMonth)
  const [employeeId, setEmployeeId] = useState(user?.id || '')
  const [rows, setRows] = useState<MonthlyReportRow[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [exporting, setExporting] = useState(false)

  const canPickEmployee = canCreateTasks || isAdmin

  const teamUsers = useMemo(() => {
    if (!canPickEmployee) return user ? [user] : ([] as User[])
    return users.filter((u) => u.isActive !== false)
  }, [canPickEmployee, users, user])

  useEffect(() => {
    if (user && !canPickEmployee) setEmployeeId(user.id)
  }, [user, canPickEmployee])

  const selectedUser = useMemo(
    () => teamUsers.find((u) => u.id === employeeId) || user,
    [teamUsers, employeeId, user],
  )

  const scopedTasks = useMemo(() => {
    const uid = selectedUser?.id
    if (!uid) return []
    return tasks.filter((t) => t.assignedTo === uid)
  }, [tasks, selectedUser?.id])

  const reportTasks = useMemo(
    () => filterMonthlyReportTasks(scopedTasks, month),
    [scopedTasks, month],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingComments(true)
      try {
        const next: MonthlyReportRow[] = []
        for (const task of reportTasks) {
          const result = await loadCommentsText(task.id)
          if (cancelled) return
          next.push({ task, result })
        }
        if (!cancelled) setRows(next)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setRows(reportTasks.map((task) => ({ task, result: '' })))
        }
      } finally {
        if (!cancelled) setLoadingComments(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [reportTasks])

  const period = monthBounds(month)

  async function handleExport() {
    if (!selectedUser) return
    setExporting(true)
    try {
      await exportMonthlyWorkReport({
        employeeName: selectedUser.name,
        positionLabel: POSITION_LABELS[selectedUser.position] || selectedUser.position,
        month,
        rows,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Отчёты</h1>
          <p className="mt-1 text-sm text-muted">
            Месячный отчёт: задачи с приоритетом «Важно» и статусом «Выполнено».
            Результат берётся из комментариев к задаче.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loadingComments}
        >
          <Download className="h-4 w-4" />
          {exporting ? '...' : 'Скачать Excel'}
        </Button>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Месяц</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
            />
          </div>
          {canPickEmployee && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Сотрудник</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
              >
                {teamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {POSITION_LABELS[u.position]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-primary/5 px-4 py-3 text-sm">
          <p className="font-semibold text-text">
            ОЙДА БАЖАРИЛГАН ИШЛАР БЎЙИЧА ҲИСОБОТ
          </p>
          <p className="mt-1 text-muted">
            Масъул ходим: <span className="font-medium text-text">{selectedUser?.name || '—'}</span>
            {' · '}
            Лавозим:{' '}
            <span className="font-medium text-text">
              {selectedUser ? POSITION_LABELS[selectedUser.position] : '—'}
            </span>
            {' · '}
            Давр: <span className="font-medium text-text">{period.label}</span>
          </p>
        </div>
      </Card>

      {loading || loadingComments ? (
        <p className="text-sm text-muted">Загрузка отчёта...</p>
      ) : rows.length === 0 ? (
        <Card>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-muted" />
            <div>
              <p className="text-sm font-medium text-text">Пока пусто</p>
              <p className="mt-1 text-xs text-muted">
                В отчёт попадают только задачи: приоритет «Важно» + статус «Выполнено» за выбранный
                месяц. Добавьте комментарий с результатом в задаче.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-primary text-xs text-white">
                <th className="px-3 py-2.5 font-medium">№</th>
                <th className="px-3 py-2.5 font-medium">Қилинган вазифа номи</th>
                <th className="px-3 py-2.5 font-medium">Масъул шахс</th>
                <th className="px-3 py-2.5 font-medium">Натижа</th>
                <th className="px-3 py-2.5 font-medium">Ҳолати</th>
                <th className="px-3 py-2.5 font-medium">Изоҳ / ссылки</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.task.id} className="border-b border-gray-50 align-top">
                  <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-text">{row.task.title}</td>
                  <td className="px-3 py-2.5 text-muted">{row.task.assignedToName}</td>
                  <td className="whitespace-pre-wrap px-3 py-2.5 text-text">
                    {row.result || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="success">Бажарилди</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    {row.task.description && (
                      <p className="mb-1 whitespace-pre-wrap">{row.task.description}</p>
                    )}
                    {(row.task.links || []).map((l, idx) => (
                      <a
                        key={`${l.url}-${idx}`}
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-secondary hover:underline"
                      >
                        {l.label}
                      </a>
                    ))}
                    {!row.task.description && !(row.task.links || []).length && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted">Задач в отчёте: {rows.length}</p>
        </Card>
      )}
    </div>
  )
}
