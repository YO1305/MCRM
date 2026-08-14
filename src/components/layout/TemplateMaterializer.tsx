import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { todayISO } from '@/utils/dates'

/** Prevent parallel materialize from Strict Mode / multiple mounts in one tab. */
let inflight: Promise<number> | null = null

/**
 * Генерирует задачи из шаблонов при любом входе в CRM.
 * Идемпотентно: один шаблон = одна задача на день (фиксированный id).
 */
export function TemplateMaterializer() {
  const { viewAsUser } = useAuth()
  const { templates, materializeDue } = useTaskTemplates()
  const templatesKey = useRef('')

  useEffect(() => {
    if (viewAsUser) return
    if (!templates.length) return

    const key = `${todayISO()}:${templates
      .filter((t) => t.active)
      .map((t) => t.id)
      .sort()
      .join(',')}`
    // Skip identical re-subscribe noise, but allow when template set changes
    if (templatesKey.current === key && !inflight) {
      // still ok to no-op; materialize is cheap/idempotent if we do run
    }
    templatesKey.current = key

    const run = async () => {
      if (inflight) {
        await inflight
        return
      }
      inflight = materializeDue().finally(() => {
        inflight = null
      })
      await inflight
    }

    void run().catch((err) => console.error('Template materialize failed', err))
  }, [templates, materializeDue, viewAsUser])

  return null
}
