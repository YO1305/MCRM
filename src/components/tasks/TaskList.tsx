import type { Task } from '@/types/task.types'
import type { TaskStatus } from '@/constants/taskStatuses'
import { TaskCard } from './TaskCard'

interface TaskListProps {
  tasks: Task[]
  showAssignee?: boolean
  viewerId?: string | null
  canConfirmTasks?: boolean
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onOpen: (task: Task) => void
}

export function TaskList({
  tasks,
  showAssignee,
  viewerId,
  canConfirmTasks,
  onStatusChange,
  onOpen,
}: TaskListProps) {
  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-surface px-4 py-12 text-center">
        <p className="text-sm text-muted">Задач пока нет</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
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
    </div>
  )
}
