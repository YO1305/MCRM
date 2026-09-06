import { useCallback, useEffect, useState } from 'react'
import { where } from 'firebase/firestore'
import {
  createDocument,
  getDocument,
  queryCollection,
  removeDocument,
  setDocument,
  subscribeToCollection,
  updateDocument,
} from '@/firebase/firestore'
import { useAuth } from '@/hooks/useAuth'
import type { Shop, ShopInput, ShopSaleLine, ShopSalesDay } from '@/types/shop.types'
import { salesDayId, totalsOf } from '@/utils/shopSales'

function normalizeLocationUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

function cleanManagers(managers: ShopInput['managers']) {
  return managers
    .map((m) => ({ name: m.name.trim(), phone: m.phone.trim() }))
    .filter((m) => m.name)
}

export function useShopSales(shopId: string | undefined) {
  const { user } = useAuth()
  const [days, setDays] = useState<ShopSalesDay[]>([])
  const [loading, setLoading] = useState(!!shopId)

  useEffect(() => {
    if (!shopId) {
      setDays([])
      setLoading(false)
      return
    }
    setLoading(true)
    return subscribeToCollection<ShopSalesDay>(
      'shop_sales_days',
      [where('shopId', '==', shopId)],
      (data) => {
        setDays([...data].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)))
        setLoading(false)
      },
      () => {
        setDays([])
        setLoading(false)
      },
    )
  }, [shopId])

  const upsertDay = useCallback(
    async (input: { date: string; lines: ShopSaleLine[]; fileName: string }) => {
      if (!shopId || !user) throw new Error('Нужно войти')
      if (!input.date) throw new Error('Укажите дату отчёта')
      if (!input.lines.length) throw new Error('В файле нет строк продаж')
      const totals = totalsOf(input.lines)
      const id = salesDayId(shopId, input.date)
      const existing = await getDocument<ShopSalesDay>('shop_sales_days', id)
      await setDocument('shop_sales_days', id, {
        shopId,
        date: input.date,
        lines: input.lines,
        qty: totals.qty,
        cost: totals.cost,
        sales: totals.sales,
        margin: totals.margin,
        uploadedBy: user.id,
        uploadedByName: user.name,
        fileName: input.fileName,
        createdAt: existing?.createdAt ?? Date.now(),
      })
      return { id, replaced: Boolean(existing) }
    },
    [shopId, user],
  )

  const deleteDay = useCallback(async (id: string) => {
    await removeDocument('shop_sales_days', id)
  }, [])

  return { days, loading, upsertDay, deleteDay }
}

export function useShops() {
  const { user } = useAuth()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return subscribeToCollection<Shop>(
      'shops',
      [],
      (data) => {
        setShops(data.sort((a, b) => a.name.localeCompare(b.name, 'ru')))
        setLoading(false)
      },
      () => {
        setError('Не удалось загрузить магазины')
        setLoading(false)
      },
    )
  }, [])

  const createShop = useCallback(
    async (input: ShopInput) => {
      if (!user) throw new Error('Нужно войти')
      const name = input.name.trim()
      if (!name) throw new Error('Укажите название магазина')
      return createDocument('shops', {
        name,
        locationUrl: normalizeLocationUrl(input.locationUrl),
        managers: cleanManagers(input.managers),
        createdBy: user.id,
        createdByName: user.name,
      })
    },
    [user],
  )

  const updateShop = useCallback(async (id: string, input: ShopInput) => {
    const name = input.name.trim()
    if (!name) throw new Error('Укажите название магазина')
    await updateDocument('shops', id, {
      name,
      locationUrl: normalizeLocationUrl(input.locationUrl),
      managers: cleanManagers(input.managers),
    })
  }, [])

  const removeShop = useCallback(async (id: string) => {
    const days = await queryCollection<ShopSalesDay>('shop_sales_days', [where('shopId', '==', id)])
    for (const day of days) {
      await removeDocument('shop_sales_days', day.id)
    }
    await removeDocument('shops', id)
  }, [])

  return { shops, loading, error, createShop, updateShop, removeShop }
}
