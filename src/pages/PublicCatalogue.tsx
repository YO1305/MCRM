import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { where } from 'firebase/firestore'
import { queryCollection } from '@/firebase/firestore'
import { incrementCatalogueView } from '@/hooks/useCatalogues'
import { useCatalogueContacts } from '@/hooks/useCatalogueContacts'
import { PdfViewer } from '@/components/catalogue/PdfViewer'
import { PriceTable } from '@/components/catalogue/PriceTable'
import { DEFAULT_CATALOGUE_CONTACTS, type Catalogue } from '@/types/catalogue.types'

function formatUpdated(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string' && value.length >= 10) {
    return new Date(value).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  const seconds = (value as { seconds?: number }).seconds
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }
  return ''
}

export function PublicCatalogue() {
  const { slug } = useParams()
  const [item, setItem] = useState<Catalogue | null | undefined>(undefined)
  const { contacts } = useCatalogueContacts()
  const phone = contacts.phone || DEFAULT_CATALOGUE_CONTACTS.phone

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!slug) {
        setItem(null)
        return
      }
      try {
        const rows = await queryCollection<Catalogue>('catalogues', [
          where('slug', '==', slug),
        ])
        const found = rows[0] || null
        if (!cancelled) setItem(found)
        if (found?.isActive) {
          try {
            await incrementCatalogueView(found.id)
          } catch {
            await fetch('/api/catalogue-view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ slug }),
            }).catch(() => undefined)
          }
        }
      } catch {
        if (!cancelled) setItem(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (item === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500">
        Загрузка…
      </div>
    )
  }

  if (!item || !item.isActive) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-lg font-semibold text-gray-900">Эта ссылка деактивирована</p>
        <p className="mt-2 text-sm text-gray-500">По вопросам свяжитесь с нами:</p>
        <p className="mt-1 font-medium text-gray-800">{phone}</p>
      </div>
    )
  }

  const updated = formatUpdated(item.excelUploadedAt || item.updatedAt || item.createdAt)

  return (
    <div className="min-h-screen bg-[#faf8f5] text-gray-900">
      <header className="border-b border-gray-200 bg-white px-4 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          {contacts.companyName || 'Bahmal Home'}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{item.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {item.type === 'personal' ? 'Коммерческое предложение' : 'Каталог'}
        </p>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {item.pdfUrl && <PdfViewer url={item.pdfUrl} title={item.title} />}

        <section>
          <h2 className="mb-4 text-center text-lg font-semibold tracking-wide">Прайс-лист</h2>
          <PriceTable rows={item.priceData} />
        </section>

        <footer className="space-y-1 pb-10 text-center text-sm text-gray-500">
          {updated && <p>Обновлено: {updated}</p>}
          <p className="font-medium text-gray-800">По вопросам: {phone}</p>
          {contacts.whatsapp && <p>WhatsApp: {contacts.whatsapp}</p>}
          {contacts.telegram && <p>Telegram: {contacts.telegram}</p>}
          {contacts.instagram && <p>Instagram: {contacts.instagram}</p>}
          {contacts.email && <p>{contacts.email}</p>}
          {contacts.website && <p>{contacts.website}</p>}
          {contacts.address && <p>{contacts.address}</p>}
        </footer>
      </main>
    </div>
  )
}
