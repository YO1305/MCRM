import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useCatalogueContacts } from '@/hooks/useCatalogueContacts'
import type { CataloguePublicContacts } from '@/types/catalogue.types'

export function CatalogueContactsCard() {
  const { contacts, loading, saveContacts } = useCatalogueContacts()
  const [form, setForm] = useState<CataloguePublicContacts>(contacts)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(contacts)
  }, [contacts])

  function set<K extends keyof CataloguePublicContacts>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function submit() {
    setError('')
    setBusy(true)
    try {
      await saveContacts(form)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-text">Контакты на странице клиента</h2>
      <p className="mt-1 text-sm text-muted">
        Эти данные видны на публичной ссылке каталога. Можно править здесь или в Firebase:
        коллекция <code className="text-xs">catalogue_settings</code>, документ{' '}
        <code className="text-xs">contacts</code>.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted">Загрузка…</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="Компания"
            value={form.companyName}
            onChange={(e) => set('companyName', e.target.value)}
          />
          <Input
            label="Телефон"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', e.target.value)}
            placeholder="+998..."
          />
          <Input
            label="Telegram"
            value={form.telegram}
            onChange={(e) => set('telegram', e.target.value)}
            placeholder="@bahmal или ссылка"
          />
          <Input
            label="Instagram"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input
            label="Сайт"
            value={form.website}
            onChange={(e) => set('website', e.target.value)}
          />
          <Input
            label="Адрес"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {saved && <p className="mt-2 text-sm text-emerald-700">Сохранено. На публичной странице уже новые контакты.</p>}

      <div className="mt-3">
        <Button type="button" disabled={busy || loading} onClick={() => void submit()}>
          {busy ? 'Сохранение…' : 'Сохранить контакты'}
        </Button>
      </div>
    </Card>
  )
}
