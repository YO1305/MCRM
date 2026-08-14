import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot, where } from 'firebase/firestore'
import { db } from '@/firebase/config'
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  removeDocument,
  setDocument,
  setDocumentIfMissing,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import type {
  ShowroomCheck,
  ShowroomItem,
  ShowroomSettings,
} from '@/types/showroom.types'
import { DEFAULT_SHOWROOM_SETTINGS } from '@/types/showroom.types'
import { parseISODate, todayISO } from '@/utils/dates'

function weekdayOf(isoDate: string): number {
  return parseISODate(isoDate).getDay()
}

export function useShowroom() {
  const { user, isAdmin } = useAuth()
  const canConfigure = isAdmin || user?.position === 'head' || user?.position === 'leads_manager_2'
  const { users } = useUsers(!!user)

  const [items, setItems] = useState<ShowroomItem[]>([])
  const [checks, setChecks] = useState<ShowroomCheck[]>([])
  const [settings, setSettings] = useState<ShowroomSettings>({
    id: 'config',
    ...DEFAULT_SHOWROOM_SETTINGS,
  })
  const [date, setDate] = useState(todayISO())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setItems([])
      setLoading(false)
      return
    }
    return subscribeToCollection<ShowroomItem>(
      'showroom_items',
      [],
      (data) => {
        setItems(
          [...data].sort(
            (a, b) =>
              (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title, 'ru'),
          ),
        )
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'showroom_settings', 'config'), (snap) => {
      if (!snap.exists()) {
        setSettings({ id: 'config', ...DEFAULT_SHOWROOM_SETTINGS })
        return
      }
      const data = snap.data()
      const weekdays = Array.isArray(data.weekdays)
        ? (data.weekdays as number[])
        : DEFAULT_SHOWROOM_SETTINGS.weekdays
      setSettings({
        id: 'config',
        weekdays,
        timesPerWeek: weekdays.length || data.timesPerWeek || 3,
        updatedBy: data.updatedBy ?? null,
        updatedAt: data.updatedAt,
      })
    })
  }, [user])

  useEffect(() => {
    if (!user || !date) {
      setChecks([])
      return
    }
    return subscribeToCollection<ShowroomCheck>(
      'showroom_checklist',
      [where('date', '==', date)],
      setChecks,
    )
  }, [user, date])

  const activeItems = useMemo(() => items.filter((i) => i.active !== false), [items])

  const isWalkDay = useMemo(() => {
    const days = settings.weekdays?.length
      ? settings.weekdays
      : DEFAULT_SHOWROOM_SETTINGS.weekdays
    return days.includes(weekdayOf(date))
  }, [settings.weekdays, date])

  const todayProgress = useMemo(() => {
    const map = new Map(checks.map((c) => [c.itemId, c]))
    const rows = activeItems.map((item) => {
      const check = map.get(item.id)
      return {
        item,
        check: check || null,
        done: check?.done === true,
      }
    })
    const doneCount = rows.filter((r) => r.done).length
    const complete = rows.length > 0 && doneCount === rows.length
    return { rows, doneCount, total: rows.length, complete }
  }, [activeItems, checks])

  async function saveSchedule(weekdays: number[]) {
    if (!user) throw new Error('Not authenticated')
    const unique = [...new Set(weekdays)].sort((a, b) => a - b)
    await setDocument('showroom_settings', 'config', {
      weekdays: unique,
      timesPerWeek: unique.length,
      updatedBy: user.id,
    })
  }

  async function addItem(title: string) {
    if (!user) throw new Error('Not authenticated')
    const trimmed = title.trim()
    if (!trimmed) return
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sortOrder ?? 0), 0)
    await createDocument('showroom_items', {
      title: trimmed,
      sortOrder: maxOrder + 1,
      active: true,
      createdBy: user.id,
    })
  }

  async function updateItem(id: string, data: Partial<ShowroomItem>) {
    const { id: _id, ...rest } = data as ShowroomItem
    void _id
    await updateDocument('showroom_items', id, rest as Record<string, unknown>)
  }

  async function deleteItem(id: string) {
    await removeDocument('showroom_items', id)
  }

  async function notifyWalkConfirmed(walkDate: string) {
    if (!user) return
    const recipients = new Map<string, string>()
    recipients.set(user.id, user.name)
    for (const u of users) {
      if (u.isActive === false) continue
      if (u.role === 'admin' || u.position === 'head' || u.position === 'leads_manager_2') {
        recipients.set(u.id, u.name)
      }
    }

    const title = 'Обход шоурума подтверждён'
    const body = `${walkDate} · выполнил ${user.name} · все пункты отмечены`

    await Promise.all(
      [...recipients.keys()].map((uid) =>
        setDocumentIfMissing('notifications', `showroom_done_${walkDate}_${uid}`, {
          userId: uid,
          type: 'showroom_done',
          title,
          body,
          taskId: null,
          dedupeKey: `showroom_done_${walkDate}`,
          read: false,
        }),
      ),
    )
  }

  async function toggleCheck(item: ShowroomItem, done: boolean, note = '') {
    if (!user) throw new Error('Not authenticated')
    const existing = checks.find((c) => c.itemId === item.id)

    if (existing) {
      await updateDocument('showroom_checklist', existing.id, {
        done,
        doneBy: done ? user.id : null,
        doneByName: done ? user.name : null,
        note: note.trim(),
        itemTitle: item.title,
      })
    } else {
      await createDocument('showroom_checklist', {
        date,
        itemId: item.id,
        itemTitle: item.title,
        done,
        doneBy: done ? user.id : null,
        doneByName: done ? user.name : null,
        note: note.trim(),
      })
    }

    // After marking done — if this completes the full checklist, notify
    if (done && activeItems.length > 0) {
      const otherDone = activeItems
        .filter((i) => i.id !== item.id)
        .every((i) => {
          const c = checks.find((x) => x.itemId === i.id)
          return c?.done === true
        })
      if (otherDone) {
        await notifyWalkConfirmed(date)
      }
    }
  }

  return {
    items,
    activeItems,
    checks,
    settings,
    date,
    setDate,
    loading,
    todayProgress,
    isWalkDay,
    canConfigure,
    addItem,
    updateItem,
    deleteItem,
    toggleCheck,
    saveSchedule,
  }
}
