import type { ActivityStatus, Client } from '@/types/client.types'
import type { NotificationType } from '@/types/notification.types'
import { calculateActiveMonths, daysDiff, resolveLastTouchDate } from '@/utils/dateUtils'
import { todayISO } from '@/utils/dates'
import { buildActivityFields, isLeadFinal, resolveOpenedMonth } from '@/utils/leadActivity'

export interface LeadActivityNotice {
  userId: string
  type: NotificationType
  title: string
  body: string
  clientId: string
  link: string
  dedupeKey: string
}

export function leadActivityNotices(
  client: Client,
  newStatus: ActivityStatus,
  adminIds: string[],
  today: Date = new Date(),
): LeadActivityNotice[] {
  if (isLeadFinal(client.stage)) return []

  const todayStr = todayISO()
  const daysSinceTouch = daysDiff(resolveLastTouchDate(client), today)
  const openedMonth = resolveOpenedMonth(client)
  const months = calculateActiveMonths(openedMonth)
  const link = `/crm?client=${client.id}`
  const notices: LeadActivityNotice[] = []

  function add(
    userId: string | null | undefined,
    type: NotificationType,
    title: string,
    body: string,
    dedupeKey: string,
  ) {
    if (!userId) return
    notices.push({
      userId,
      type,
      title,
      body,
      clientId: client.id,
      link,
      dedupeKey,
    })
  }

  if (daysSinceTouch != null && daysSinceTouch === 14) {
    add(
      client.assignedTo,
      'lead_no_touch',
      'Нет контакта с клиентом',
      `14 дней без активности по клиенту ${client.name}. Напиши или позвони.`,
      `lead_no_touch:${client.id}:${todayStr}`,
    )
  }

  if (daysSinceTouch != null && daysSinceTouch === 30) {
    for (const adminId of adminIds) {
      add(
        adminId,
        'lead_no_touch_admin',
        'Менеджер не работает с клиентом',
        `${client.assignedToName || 'Менеджер'} не контактировал с ${client.name} уже 30 дней.`,
        `lead_no_touch_admin:${client.id}:${adminId}:${todayStr}`,
      )
    }
  }

  if (client.nextStepDeadline && client.nextStepDeadline < todayStr) {
    add(
      client.assignedTo,
      'lead_next_step_overdue',
      'Пропущен срок по клиенту',
      `Истёк срок следующего шага по ${client.name}. Обнови дату.`,
      `lead_next_step_overdue:${client.id}:${client.nextStepDeadline}`,
    )
  }

  if (months === 3 && client.activeMonthsCount !== 3) {
    add(
      client.assignedTo,
      'lead_month_3',
      'Лид на 3-м месяце',
      `Клиент ${client.name} на 3-м месяце. Это последний оплачиваемый месяц — нужен договор или решение.`,
      `lead_month_3:${client.id}:${openedMonth}`,
    )
  }

  if (newStatus === 'frozen' && client.activityStatus && client.activityStatus !== 'frozen') {
    const frozenBody = `Клиент ${client.name} переведён в статус «Заморожен». Оплата за этот лид прекращена.`
    add(
      client.assignedTo,
      'lead_frozen',
      'Лид заморожен',
      frozenBody,
      `lead_frozen:${client.id}`,
    )
    for (const adminId of adminIds) {
      if (adminId === client.assignedTo) continue
      add(
        adminId,
        'lead_frozen',
        'Лид заморожен',
        frozenBody,
        `lead_frozen:${client.id}:${adminId}`,
      )
    }
  }

  return notices
}

export function activityFieldsChanged(
  client: Client,
  fields: ReturnType<typeof buildActivityFields>,
): boolean {
  return (
    client.openedDate !== fields.openedDate ||
    client.openedMonth !== fields.openedMonth ||
    client.activityStatus !== fields.activityStatus ||
    client.activeMonthsCount !== fields.activeMonthsCount
  )
}
