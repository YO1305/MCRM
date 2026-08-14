import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { useDevModule } from '@/hooks/useDevModule'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import {
  PROJECT_STATUS_LABELS,
  SUBTASK_STATUS_LABELS,
  type DevProject,
  type ProjectStatus,
} from '@/types/dev.types'
import { getCurrentMonth, isSubtaskOverdue, monthLabel, todayISO } from '@/utils/devDates'

export function Projects() {
  const {
    projects,
    subtasks,
    templates,
    loading,
    canManageProjects,
    defaultAssignee,
    createProject,
    updateProject,
    deleteProject,
    addSubtask,
    deleteSubtask,
    createTemplate,
    deleteTemplate,
  } = useDevModule()

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [subTitle, setSubTitle] = useState('')
  const [subDue, setSubDue] = useState('')
  const [subMonth, setSubMonth] = useState(getCurrentMonth())
  const [tplTitle, setTplTitle] = useState('')
  const [tplDay, setTplDay] = useState('1')
  const [tplProjectId, setTplProjectId] = useState('')

  const statsByProject = useMemo(() => {
    const map = new Map<string, { total: number; done: number; overdue: number; pending: number }>()
    const today = todayISO()
    for (const s of subtasks) {
      const cur = map.get(s.projectId) || { total: 0, done: 0, overdue: 0, pending: 0 }
      cur.total += 1
      if (s.status === 'done') cur.done += 1
      if (s.status === 'pending_confirm') cur.pending += 1
      if (isSubtaskOverdue(s.dueDate, s.status, today)) cur.overdue += 1
      map.set(s.projectId, cur)
    }
    return map
  }, [subtasks])

  async function handleCreateProject() {
    if (!title.trim()) return
    setBusy(true)
    try {
      await createProject({
        title,
        description: desc,
        dueDate: dueDate || null,
      })
      setTitle('')
      setDesc('')
      setDueDate('')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddSubtask(projectId: string) {
    if (!subTitle.trim()) return
    setBusy(true)
    try {
      await addSubtask({
        projectId,
        title: subTitle,
        dueDate: subDue || null,
        monthKey: subMonth,
      })
      setSubTitle('')
      setSubDue('')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateTemplate() {
    if (!tplTitle.trim()) return
    setBusy(true)
    try {
      await createTemplate({
        title: tplTitle,
        dayOfMonth: Number(tplDay) || 1,
        projectId: tplProjectId || null,
      })
      setTplTitle('')
    } finally {
      setBusy(false)
    }
  }

  function statusBadge(status: ProjectStatus) {
    if (status === 'done') return <Badge variant="success">{PROJECT_STATUS_LABELS[status]}</Badge>
    if (status === 'paused') return <Badge variant="warning">{PROJECT_STATUS_LABELS[status]}</Badge>
    return <Badge variant="info">{PROJECT_STATUS_LABELS[status]}</Badge>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Проекты</h1>
        <p className="mt-1 text-sm text-muted">
          Общий обзор проектов, сроков и подзадач.
          {defaultAssignee
            ? ` Исполнитель по умолчанию: ${defaultAssignee.name}.`
            : ' Добавьте менеджера по развитию в команду.'}
          {' '}KPI по проектам — позже.
        </p>
      </div>

      {canManageProjects && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-text">Новый проект</h2>
          <Input
            label="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Запуск новой линии"
          />
          <Textarea
            label="Описание"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Кратко о проекте"
          />
          <Input
            type="date"
            label="Срок проекта"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void handleCreateProject()}
          >
            <Plus className="h-4 w-4" />
            Создать проект
          </Button>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : projects.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Проектов пока нет.
            {canManageProjects ? ' Создайте первый выше.' : ''}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              open={openId === project.id}
              onToggle={() => setOpenId((id) => (id === project.id ? null : project.id))}
              stats={statsByProject.get(project.id)}
              statusBadge={statusBadge(project.status)}
              subtasks={subtasks.filter((s) => s.projectId === project.id)}
              canManage={canManageProjects}
              busy={busy}
              subTitle={subTitle}
              setSubTitle={setSubTitle}
              subDue={subDue}
              setSubDue={setSubDue}
              subMonth={subMonth}
              setSubMonth={setSubMonth}
              onAddSub={() => void handleAddSubtask(project.id)}
              onDeleteSub={(id) => void deleteSubtask(id)}
              onStatus={(status) => void updateProject(project.id, { status })}
              onDelete={() => {
                if (confirm(`Удалить проект «${project.title}» и все подзадачи?`)) {
                  void deleteProject(project.id)
                }
              }}
            />
          ))}
        </div>
      )}

      {canManageProjects && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-text">Ежемесячные шаблоны</h2>
            <p className="text-xs text-muted">
              Автоматически создают подзадачи каждый месяц (и привязка к проекту — по желанию)
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Название"
              value={tplTitle}
              onChange={(e) => setTplTitle(e.target.value)}
              placeholder="Отчёт по развитию"
            />
            <Input
              label="День месяца"
              type="number"
              min={1}
              max={28}
              value={tplDay}
              onChange={(e) => setTplDay(e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Проект (необяз.)</label>
              <select
                value={tplProjectId}
                onChange={(e) => setTplProjectId(e.target.value)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm"
              >
                <option value="">Без проекта · «Ежемесячные»</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={busy || !tplTitle.trim()}
            onClick={() => void handleCreateTemplate()}
          >
            <Plus className="h-4 w-4" />
            Добавить шаблон
          </Button>
          {templates.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="text-sm font-medium text-text">{t.title}</p>
                    <p className="text-xs text-muted">
                      день {t.dayOfMonth}
                      {t.projectTitle ? ` · ${t.projectTitle}` : ''}
                      {t.lastGeneratedMonth ? ` · последний: ${t.lastGeneratedMonth}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void deleteTemplate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

function ProjectCard(props: {
  project: DevProject
  open: boolean
  onToggle: () => void
  stats?: { total: number; done: number; overdue: number; pending: number }
  statusBadge: ReactNode
  subtasks: ReturnType<typeof useDevModule>['subtasks']
  canManage: boolean
  busy: boolean
  subTitle: string
  setSubTitle: (v: string) => void
  subDue: string
  setSubDue: (v: string) => void
  subMonth: string
  setSubMonth: (v: string) => void
  onAddSub: () => void
  onDeleteSub: (id: string) => void
  onStatus: (s: ProjectStatus) => void
  onDelete: () => void
}) {
  const {
    project,
    open,
    onToggle,
    stats,
    statusBadge,
    subtasks,
    canManage,
    busy,
    subTitle,
    setSubTitle,
    subDue,
    setSubDue,
    subMonth,
    setSubMonth,
    onAddSub,
    onDeleteSub,
    onStatus,
    onDelete,
  } = props

  const today = todayISO()

  return (
    <Card className="space-y-3">
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 text-left">
        {open ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-text">{project.title}</h3>
            {statusBadge}
            {stats && stats.overdue > 0 && (
              <Badge variant="danger">Просрочено: {stats.overdue}</Badge>
            )}
            {stats && stats.pending > 0 && (
              <Badge variant="warning">На подтверждении: {stats.pending}</Badge>
            )}
          </div>
          {project.description && (
            <p className="mt-0.5 text-sm text-muted">{project.description}</p>
          )}
          <p className="mt-1 text-xs text-muted">
            {project.dueDate ? `Срок: ${project.dueDate}` : 'Без срока'}
            {project.assigneeName ? ` · ${project.assigneeName}` : ''}
            {stats ? ` · ${stats.done}/${stats.total} выполнено` : ''}
          </p>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {(['active', 'paused', 'done'] as ProjectStatus[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={project.status === s ? 'secondary' : 'ghost'}
                  onClick={() => onStatus(s)}
                >
                  {PROJECT_STATUS_LABELS[s]}
                </Button>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Удалить
              </Button>
            </div>
          )}

          <ul className="space-y-2">
            {subtasks.length === 0 ? (
              <li className="text-sm text-muted">Подзадач пока нет</li>
            ) : (
              subtasks.map((s) => {
                const overdue = isSubtaskOverdue(s.dueDate, s.status, today)
                return (
                  <li
                    key={s.id}
                    className={`flex flex-wrap items-start justify-between gap-2 rounded-lg px-3 py-2 ${
                      overdue ? 'bg-red-50' : 'bg-background'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text">{s.title}</p>
                      <p className="text-xs text-muted">
                        {monthLabel(s.monthKey)}
                        {s.dueDate ? ` · до ${s.dueDate}` : ''}
                        {s.carriedFromMonth ? ` · перенос с ${s.carriedFromMonth}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {overdue && <Badge variant="danger">Просрочено</Badge>}
                      <Badge
                        variant={
                          s.status === 'done'
                            ? 'success'
                            : s.status === 'pending_confirm'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {SUBTASK_STATUS_LABELS[s.status]}
                      </Badge>
                      {canManage && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteSub(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })
            )}
          </ul>

          {canManage && (
            <div className="grid gap-2 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Input
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  placeholder="Новая подзадача"
                />
              </div>
              <Input
                type="month"
                value={subMonth}
                onChange={(e) => setSubMonth(e.target.value)}
              />
              <Input
                type="date"
                value={subDue}
                onChange={(e) => setSubDue(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                className="sm:col-span-4"
                disabled={busy || !subTitle.trim()}
                onClick={onAddSub}
              >
                <Plus className="h-4 w-4" />
                Добавить подзадачу в этап месяца
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
