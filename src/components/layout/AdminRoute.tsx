import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
