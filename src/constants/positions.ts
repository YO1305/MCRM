import type { Position } from '@/types/user.types'

export const POSITION_LABELS: Record<Position, string> = {
  head: 'Начальник отдела',
  leads_manager_1: 'Старший менеджер по лидам',
  leads_manager_2: 'Менеджер по лидам',
  designer: 'Дизайнер',
  dev_manager: 'Менеджер по развитию',
  assistant: 'Ассистент',
  operator: 'Операционщик',
}

// Порядок отображения сотрудников по структуре отдела
export const POSITION_ORDER: Position[] = [
  'leads_manager_1',
  'leads_manager_2',
  'assistant',
  'dev_manager',
  'designer',
  'operator',
  'head',
]

export function positionRank(position: Position): number {
  const index = POSITION_ORDER.indexOf(position)
  return index === -1 ? POSITION_ORDER.length : index
}
