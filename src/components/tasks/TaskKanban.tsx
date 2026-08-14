import type { Task } from '@/types/task.types'
import type { TaskStatus } from '@/constants/taskStatuses'
import { TASK_STATUSES } from '@/constants/taskStatuses'
import { KANBAN_COLUMNS } from '@/constants/taskMeta'
import { TaskCard } from './TaskCard'

interface TaskKanbanProps {
  tasks: Task[]
  showAssignee?: boolean
  viewerId?: string | null
  canConfirmTasks?: boolean
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onOpen: (task: Task) => void
}

export function TaskKanban({
  tasks,
  showAssignee,
  viewerId,
  canConfirmTasks,
  onStatusChange,
  onOpen,
}: TaskKanbanProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((colStatus) => {
        const columnTasks = tasks.filter((t) => t.status === colStatus)
        return (
          <section
            key={colStatus}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-background/80 p-3"
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold text-text">{TASK_STATUSES[colStatus]}</h2>
              <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted">
                {columnTasks.length}
              </span>
            </header>
            <div className="space-y-2">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  showAssignee={showAssignee}
                  viewerId={viewerId}
                  canConfirmTasks={canConfirmTasks}
                  onStatusChange={onStatusChange}
                  onOpen={onOpen}
                />
              ))}
              {columnTasks.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-muted">Пусто</p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
