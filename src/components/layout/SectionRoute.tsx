import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { firstAccessiblePath, type AppSection } from '@/constants/access'

interface SectionRouteProps {
  section: AppSection
}

export function SectionRoute({ section }: SectionRouteProps) {
  const { loading, user, isAdmin } = useAuth()
  const { canAccess } = useRole()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!canAccess(section)) {
    const fallback = firstAccessiblePath({
      isAdmin,
      position: user?.position,
      enabledSections: user?.enabledSections,
    })
    return <Navigate to={fallback} replace />
  }

  return <Outlet />
}
