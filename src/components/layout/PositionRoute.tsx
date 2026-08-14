import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import type { Position } from '@/types/user.types'

interface PositionRouteProps {
  positions: Position[]
}

export function PositionRoute({ positions }: PositionRouteProps) {
  const { loading } = useAuth()
  const { hasPosition } = useRole()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!hasPosition(...positions)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
