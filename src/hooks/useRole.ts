import { useAuth } from '@/hooks/useAuth'
import type { Position } from '@/types/user.types'
import {
  canAccessSection,
  canAssignTasks,
  type AppSection,
} from '@/constants/access'

export function useRole() {
  const { user, isAdmin } = useAuth()

  const hasPosition = (...positions: Position[]) => {
    if (!user) return false
    if (isAdmin) return true
    return positions.includes(user.position)
  }

  const canAccess = (section: AppSection) =>
    canAccessSection(section, {
      isAdmin,
      position: user?.position,
      enabledSections: user?.enabledSections,
    })

  const canCreateTasks = canAssignTasks({ isAdmin, position: user?.position })

  return {
    role: user?.role,
    position: user?.position,
    isAdmin,
    isEmployee: user?.role === 'employee',
    hasPosition,
    canAccess,
    canCreateTasks,
  }
}
