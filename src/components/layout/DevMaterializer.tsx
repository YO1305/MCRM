import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDevModule } from '@/hooks/useDevModule'

/** Monthly templates + carry overdue into current month. */
export function DevMaterializer() {
  const { viewAsUser } = useAuth()
  const { canWork, loading, materializeMonth } = useDevModule()
  const ran = useRef(false)

  useEffect(() => {
    if (viewAsUser) return
    if (!canWork || loading) return
    if (ran.current) return
    ran.current = true
    void materializeMonth().catch((err) => console.error('Dev materialize failed', err))
  }, [canWork, loading, materializeMonth, viewAsUser])

  return null
}
