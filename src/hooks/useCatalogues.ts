import { useCallback, useEffect, useMemo, useState } from 'react'
import { increment, updateDoc, doc } from 'firebase/firestore'
import {
  subscribeToCollection,
  setDocument,
  updateDocument,
  removeDocument,
} from '@/firebase/firestore'
import { db } from '@/firebase/config'
import { uploadFile } from '@/firebase/storage'
import { useAuth } from '@/hooks/useAuth'
import { parseExcelPrices } from '@/utils/excelParser'
import { cataloguePublicUrl, generateSlug } from '@/utils/slugUtils'
import { CATALOGUE_MAX_FILE_BYTES, type Catalogue, type CatalogueInput } from '@/types/catalogue.types'

export type CatalogueUploadProgress = {
  label: string
  percent: number
}

function assertFileSize(file: File, label: string) {
  if (file.size > CATALOGUE_MAX_FILE_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024))
    throw new Error(`${label} слишком большой (${mb} МБ). Максимум 80 МБ.`)
  }
}

export function useCatalogues(type?: 'general' | 'personal', clientId?: string) {
  const { user } = useAuth()
  const [catalogues, setCatalogues] = useState<Catalogue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    return subscribeToCollection<Catalogue>(
      'catalogues',
      [],
      (data) => {
        const sorted = [...data].sort((a, b) => {
          const at = String((a.updatedAt as { seconds?: number })?.seconds || 0)
          const bt = String((b.updatedAt as { seconds?: number })?.seconds || 0)
          return bt.localeCompare(at)
        })
        setCatalogues(sorted)
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [])

  const filtered = useMemo(() => {
    return catalogues.filter((c) => {
      if (type && c.type !== type) return false
      if (clientId && c.clientId !== clientId) return false
      return true
    })
  }, [catalogues, type, clientId])

  const createCatalogue = useCallback(
    async (
      input: CatalogueInput,
      onProgress?: (progress: CatalogueUploadProgress) => void,
    ): Promise<string> => {
      if (!user) throw new Error('Нужно войти')
      const title = input.title.trim()
      if (!title) throw new Error('Укажите название')
      if (!input.pdf) throw new Error('Загрузите PDF каталога')
      if (input.type === 'personal' && !input.clientId) {
        throw new Error('Выберите клиента для персонального КП')
      }
      assertFileSize(input.pdf, 'PDF')
      if (input.excel) assertFileSize(input.excel, 'Excel')

      const id = crypto.randomUUID()
      const slug = generateSlug(input.type === 'personal' ? `kp-${title}` : title)
      const publicUrl = cataloguePublicUrl(slug)

      onProgress?.({ label: 'Загрузка PDF', percent: 0 })
      const pdfUrl = await uploadFile(`catalogues/${id}/catalogue.pdf`, input.pdf, (percent) => {
        onProgress?.({ label: 'Загрузка PDF', percent })
      })

      let excelUrl: string | null = null
      let excelFileName: string | null = null
      let priceData: Catalogue['priceData'] = input.priceData ?? null
      if (input.excel) {
        excelFileName = input.excel.name
        onProgress?.({ label: 'Загрузка Excel', percent: 0 })
        excelUrl = await uploadFile(
          `catalogues/${id}/prices_${Date.now()}.xlsx`,
          input.excel,
          (percent) => onProgress?.({ label: 'Загрузка Excel', percent }),
        )
        if (!priceData) {
          onProgress?.({ label: 'Разбор прайса', percent: 50 })
          priceData = await parseExcelPrices(input.excel)
        }
      }

      onProgress?.({ label: 'Сохранение в Firebase', percent: 90 })
      await setDocument('catalogues', id, {
        type: input.type,
        title,
        category: input.category,
        description: (input.description || '').trim(),
        pdfUrl,
        pdfFileName: input.pdf.name,
        pdfUploadedAt: new Date().toISOString(),
        pdfUploadedBy: user.name,
        excelUrl,
        excelFileName,
        excelUploadedAt: input.excel ? new Date().toISOString() : null,
        excelUploadedBy: input.excel ? user.name : null,
        priceData,
        slug,
        publicUrl,
        isActive: true,
        viewCount: 0,
        clientId: input.type === 'personal' ? input.clientId || null : null,
        clientName: input.type === 'personal' ? input.clientName || null : null,
        createdBy: user.id,
        createdByName: user.name,
      })
      onProgress?.({ label: 'Готово', percent: 100 })
      return publicUrl
    },
    [user],
  )

  const updateExcel = useCallback(
    async (id: string, file: File) => {
      if (!user) throw new Error('Нужно войти')
      assertFileSize(file, 'Excel')
      const excelUrl = await uploadFile(`catalogues/${id}/prices_${Date.now()}.xlsx`, file)
      const priceData = await parseExcelPrices(file)
      await updateDocument('catalogues', id, {
        excelUrl,
        excelFileName: file.name,
        excelUploadedAt: new Date().toISOString(),
        excelUploadedBy: user.name,
        priceData,
      })
    },
    [user],
  )

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    await updateDocument('catalogues', id, { isActive })
  }, [])

  const deleteCatalogue = useCallback(async (id: string) => {
    await removeDocument('catalogues', id)
  }, [])

  const attachToClient = useCallback(
    async (source: Catalogue, client: { id: string; name: string }) => {
      if (!user) throw new Error('Нужно войти')
      const id = crypto.randomUUID()
      const slug = generateSlug(`kp-${client.name}-${source.title}`)
      const publicUrl = cataloguePublicUrl(slug)
      await setDocument('catalogues', id, {
        type: 'personal',
        title: source.title,
        category: source.category,
        description: source.description || '',
        pdfUrl: source.pdfUrl,
        pdfFileName: source.pdfFileName,
        pdfUploadedAt: source.pdfUploadedAt || new Date().toISOString(),
        pdfUploadedBy: source.pdfUploadedBy,
        excelUrl: source.excelUrl,
        excelFileName: source.excelFileName,
        excelUploadedAt: source.excelUploadedAt || null,
        excelUploadedBy: source.excelUploadedBy,
        priceData: source.priceData,
        slug,
        publicUrl,
        isActive: true,
        viewCount: 0,
        clientId: client.id,
        clientName: client.name,
        createdBy: user.id,
        createdByName: user.name,
      })
      return publicUrl
    },
    [user],
  )

  return {
    catalogues: filtered,
    allCatalogues: catalogues,
    loading,
    createCatalogue,
    updateExcel,
    toggleActive,
    deleteCatalogue,
    attachToClient,
  }
}

export async function incrementCatalogueView(id: string) {
  await updateDoc(doc(db, 'catalogues', id), {
    viewCount: increment(1),
  })
}
