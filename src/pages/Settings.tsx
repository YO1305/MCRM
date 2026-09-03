import { useState } from 'react'
import { Plus, Settings2, Brain } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmployeeConstructor } from '@/components/settings/EmployeeConstructor'
import { AddEmployeeModal } from '@/components/settings/AddEmployeeModal'
import { MassTemplateForm } from '@/components/settings/MassTemplateForm'
import { DepartmentsManager } from '@/components/settings/DepartmentsManager'
import { CountriesAdminPanel } from '@/components/settings/CountriesAdminPanel'
import { CrmStagesAdminPanel } from '@/components/settings/CrmStagesAdminPanel'
import { POSITION_LABELS } from '@/constants/positions'
import { isRecurringTasksPaused } from '@/utils/taskTemplates'
import { formatISODateShort, todayISO } from '@/utils/dates'
import type { User } from '@/types/user.types'

export function Settings() {
  const { user, isAdmin } = useAuth()
  const { users, loading } = useUsers(isAdmin)
  const { templates, restartDailyTasks, dedupeTodayTasks } = useTaskTemplates(
    isAdmin ? undefined : null,
  )
  const [selected, setSelected] = useState<User | null>(null)
  const [adding, setAdding] = useState(false)
  const [restartingAll, setRestartingAll] = useState(false)
  const [restartMsg, setRestartMsg] = useState('')
  const [addMsg, setAddMsg] = useState('')

  function templateCount(userId: string) {
    return templates.filter((t) => t.userId === userId).length
  }

  function dailyCount(userId: string) {
    return templates.filter((t) => t.userId === userId && t.recurrence === 'daily').length
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text">Настройки</h1>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Профиль</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted">Имя</p>
            <p className="font-medium">{user?.name}</p>
          </div>
          <div>
            <p className="text-muted">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-muted">Должность</p>
            <p className="font-medium">
              {user ? POSITION_LABELS[user.position] : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted">Роль</p>
            <Badge variant={isAdmin ? 'info' : 'default'}>
              {isAdmin ? 'Администратор' : 'Сотрудник'}
            </Badge>
          </div>
        </div>
      </Card>

      {isAdmin && (
        <>
          <Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Brain className="h-5 w-5 text-violet-600" />
                  ИИ Помощник
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Промпт Groq, пороги активности, кому генерировать задачи, тест на клиенте
                </p>
              </div>
              <Link
                to="/settings/ai"
                className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Открыть
              </Link>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Разбор KPI-лидов</h2>
                <p className="mt-1 text-xs text-muted">
                  По каждому клиенту воронки: почему засчитали в лид KPI за месяц и почему нет.
                  Журнал, Groq, рекомендации.
                </p>
              </div>
              <Link
                to="/settings/ai?tab=audit"
                className="inline-flex items-center rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Открыть разбор
              </Link>
            </div>
          </Card>

          <CountriesAdminPanel />
          <CrmStagesAdminPanel />
          <DepartmentsManager />

          <MassTemplateForm users={users} />

          <Card className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Ежедневные задачи · перезапуск</h2>
              <p className="mt-1 text-xs text-muted">
                Если у сотрудников дубли — нажмите перезапуск. Старые копии за сегодня
                удалятся, по каждому активному шаблону создастся одна задача.
              </p>
            </div>
            {restartMsg && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {restartMsg}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={restartingAll}
              onClick={() => {
                if (
                  !confirm(
                    'Перезапустить ежедневные задачи на сегодня для ВСЕЙ команды?\n\nДубликаты и копии за сегодня будут удалены и созданы заново.',
                  )
                ) {
                  return
                }
                setRestartingAll(true)
                setRestartMsg('')
                void (async () => {
                  const deduped = await dedupeTodayTasks()
                  const { removed, created } = await restartDailyTasks()
                  setRestartMsg(
                    `Готово: убрано ${removed + deduped}, создано заново ${created}`,
                  )
                })()
                  .catch((err) => {
                    console.error(err)
                    setRestartMsg(
                      err instanceof Error ? err.message : 'Ошибка перезапуска',
                    )
                  })
                  .finally(() => setRestartingAll(false))
              }}
            >
              {restartingAll ? 'Перезапуск...' : 'Перезапустить ежедневные для всех'}
            </Button>
          </Card>

          <Card className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Команда · доступ и задачи</h2>
                <p className="mt-1 text-xs text-muted">
                  Добавьте человека, при желании задайте логин/пароль и отметьте, какие
                  разделы ему видны. Потом можно открыть и донастроить.
                </p>
              </div>
              <Button type="button" size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5" />
                Добавить
              </Button>
            </div>
            {addMsg && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {addMsg}
              </p>
            )}
            {loading ? (
              <p className="text-sm text-muted">Загрузка...</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {users.map((member) => {
                  const total = templateCount(member.id)
                  const daily = dailyCount(member.id)
                  const noLogin = member.hasLogin === false
                  return (
                    <li
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-text">{member.name}</p>
                        <p className="text-xs text-muted">
                          {noLogin
                            ? 'Без входа'
                            : member.email || '—'}{' '}
                          · {POSITION_LABELS[member.position]}
                          {total > 0
                            ? ` · шаблонов: ${total} (ежедневных: ${daily})`
                            : ' · шаблонов пока нет'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {noLogin && <Badge variant="default">Без входа</Badge>}
                        {isRecurringTasksPaused(member) ? (
                          <Badge variant="warning">
                            Пауза до {formatISODateShort(member.recurringTasksPausedUntil || '')}
                          </Badge>
                        ) : member.recurringTasksPausedUntil &&
                          member.recurringTasksPausedUntil >= todayISO() ? (
                          <Badge variant="default">
                            Пауза с{' '}
                            {formatISODateShort(
                              member.recurringTasksPausedFrom || member.recurringTasksPausedUntil,
                            )}
                          </Badge>
                        ) : null}
                        <Badge variant={member.role === 'admin' ? 'info' : 'default'}>
                          {member.role === 'admin' ? 'Admin' : 'Employee'}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelected(member)}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Логин и настройки
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      {adding && (
        <AddEmployeeModal
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAddMsg('Сотрудник добавлен в команду')
            setTimeout(() => setAddMsg(''), 4000)
          }}
        />
      )}

      {selected && (
        <EmployeeConstructor
          member={users.find((u) => u.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
