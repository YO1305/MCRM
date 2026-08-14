import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/types/user.types'
import type { ClientInput, ClientSource, ProductKind } from '@/types/client.types'
import type { ClientStage } from '@/constants/clientStages'
import { useClientStages } from '@/hooks/useClientStages'
import { POSITION_LABELS } from '@/constants/positions'
import { addDaysISO, todayISO } from '@/utils/dates'
import {
  FABRIC_TYPES,
  GP_TYPES,
  PRODUCT_KIND_LABELS,
} from '@/constants/leadProducts'
import { CountrySelect } from '@/components/crm/CountrySelect'
import { ContactPicker } from '@/components/crm/ContactPicker'
import { EditableOptionSelect } from '@/components/admin/EditableOptionSelect'
import { useContacts } from '@/hooks/useContacts'
import { useOptionList } from '@/hooks/useOptionList'
import { useRole } from '@/hooks/useRole'
import type { Contact } from '@/types/contact.types'

interface QuickClientFormProps {
  users: User[]
  usersLoading?: boolean
  compact?: boolean
  onSubmit: (input: ClientInput, assignee: { id: string; name: string }) => Promise<void>
}

function toggleInList(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key]
}

export function QuickClientForm({
  users,
  usersLoading,
  compact,
  onSubmit,
}: QuickClientFormProps) {
  const { user, isAdmin } = useAuth()
  const { canAccess } = useRole()
  const { contacts } = useContacts(canAccess('contacts') || isAdmin)
  const sourceList = useOptionList('client_source')
  const { pipeline } = useClientStages()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState<ClientStage>('contact')
  const [source, setSource] = useState<ClientSource>('instagram')
  const [exhibitionName, setExhibitionName] = useState('')
  const [exhibitionDate, setExhibitionDate] = useState('')
  const [country, setCountry] = useState('UZ')
  const [products, setProducts] = useState<ProductKind[]>(['fabric'])
  const [fabricTypes, setFabricTypes] = useState<string[]>([])
  const [gpTypes, setGpTypes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [nextContactDate, setNextContactDate] = useState(addDaysISO(todayISO(), 1))
  const [dealAmount, setDealAmount] = useState('')
  const [assigneeId, setAssigneeId] = useState(user?.id || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const assignable = useMemo(() => {
    if (isAdmin) return users
    return users.filter((u) => u.id === user?.id)
  }, [isAdmin, users, user?.id])

  function toggleProduct(kind: ProductKind) {
    setProducts((prev) => {
      if (prev.includes(kind)) {
        const next = prev.filter((p) => p !== kind)
        if (kind === 'fabric') setFabricTypes([])
        if (kind === 'finished') setGpTypes([])
        return next
      }
      return [...prev, kind]
    })
  }

  function applyContact(c: Contact) {
    setName(c.name)
    setPhone(c.phone)
    setCompany(c.company || '')
    setEmail(c.email || '')
    if (c.country) setCountry(c.country)
    if (c.notes) setNotes(c.notes)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Введите имя клиента')
      return
    }
    if (!phone.trim()) {
      setError('Введите телефон')
      return
    }
    if (!country) {
      setError('Выберите страну')
      return
    }
    if (!products.length) {
      setError('Отметьте продукцию: ткань и/или ГП')
      return
    }
    if (products.includes('fabric') && fabricTypes.length === 0) {
      setError('Укажите, какой тканью интересуются')
      return
    }
    if (products.includes('finished') && gpTypes.length === 0) {
      setError('Укажите, каким ГП интересуются')
      return
    }
    if (sourceList.requiresExhibition(source) && !exhibitionName.trim()) {
      setError('Укажите название выставки')
      return
    }
    const assignee = assignable.find((u) => u.id === assigneeId) || assignable[0]
    if (!assignee) {
      setError('Выберите менеджера')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const showEx = sourceList.requiresExhibition(source)
      await onSubmit(
        {
          name: name.trim(),
          phone: phone.trim(),
          company,
          email,
          stage,
          source,
          exhibitionName: showEx ? exhibitionName.trim() : '',
          exhibitionDate: showEx ? exhibitionDate || null : null,
          country,
          products,
          fabricTypes: products.includes('fabric') ? fabricTypes : [],
          gpTypes: products.includes('finished') ? gpTypes : [],
          notes,
          nextContactDate: nextContactDate || null,
          dealAmount: dealAmount ? Number(dealAmount) : null,
        },
        { id: assignee.id, name: assignee.name },
      )
      setName('')
      setPhone('')
      setCompany('')
      setEmail('')
      setStage('contact')
      setSource('instagram')
      setExhibitionName('')
      setExhibitionDate('')
      setCountry('UZ')
      setProducts(['fabric'])
      setFabricTypes([])
      setGpTypes([])
      setNotes('')
      setNextContactDate(addDaysISO(todayISO(), 1))
      setDealAmount('')
    } catch (err) {
      console.error(err)
      setError('Не удалось создать клиента')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        compact
          ? 'space-y-4'
          : 'space-y-4 rounded-xl border border-gray-100 bg-surface p-4 shadow-sm sm:p-5'
      }
    >
      {!compact && (
        <div>
          <h2 className="text-base font-semibold text-text">Новый клиент</h2>
          <p className="mt-0.5 text-xs text-muted">Имя, телефон → этап → менеджер</p>
        </div>
      )}

      {(canAccess('contacts') || isAdmin) && contacts.length > 0 && (
        <ContactPicker contacts={contacts} onPick={applyContact} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Имя / контакт"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя клиента"
          required
        />
        <Input
          label="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+998 ..."
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Компания"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Необязательно"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Необязательно"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Этап</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as ClientStage)}
            className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
          >
            {pipeline.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <CountrySelect value={country} onChange={setCountry} required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Продукция *</label>
        <p className="text-xs text-muted">Можно отметить оба варианта</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRODUCT_KIND_LABELS) as ProductKind[]).map((kind) => {
            const active = products.includes(kind)
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleProduct(kind)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  active
                    ? 'border-secondary bg-secondary/10 text-secondary'
                    : 'border-gray-200 bg-background text-text hover:border-gray-300'
                }`}
              >
                {active ? '✓ ' : ''}
                {PRODUCT_KIND_LABELS[kind]}
              </button>
            )
          })}
        </div>
      </div>

      {products.includes('fabric') && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text">Какая ткань *</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FABRIC_TYPES).map(([key, label]) => {
              const active = fabricTypes.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFabricTypes((prev) => toggleInList(prev, key))}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                    active
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-gray-200 text-muted hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {products.includes('finished') && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text">Какое ГП *</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(GP_TYPES).map(([key, label]) => {
              const active = gpTypes.includes(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setGpTypes((prev) => toggleInList(prev, key))}
                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                    active
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-gray-200 text-muted hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <EditableOptionSelect
          listId="client_source"
          label="Источник"
          value={source}
          onChange={(v) => {
            setSource(v)
            if (!sourceList.requiresExhibition(v)) {
              setExhibitionName('')
              setExhibitionDate('')
            }
          }}
        />
        <Input
          label="Следующий контакт"
          type="date"
          value={nextContactDate}
          onChange={(e) => setNextContactDate(e.target.value)}
        />
      </div>

      {sourceList.requiresExhibition(source) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Название выставки *"
            value={exhibitionName}
            onChange={(e) => setExhibitionName(e.target.value)}
            placeholder="Например: Textile Expo 2026"
          />
          <Input
            label="Дата выставки"
            type="date"
            value={exhibitionDate}
            onChange={(e) => setExhibitionDate(e.target.value)}
          />
        </div>
      )}

      <Input
        label="Сумма сделки (сум)"
        type="number"
        min={0}
        value={dealAmount}
        onChange={(e) => setDealAmount(e.target.value)}
        placeholder="Необязательно"
      />

      <div className="space-y-2">
        <label className="text-sm font-medium text-text">Менеджер</label>
        {usersLoading && assignable.length === 0 ? (
          <p className="text-xs text-muted">Загрузка...</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {assignable.map((u) => {
              const active = assigneeId === u.id || (!assigneeId && u.id === user?.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setAssigneeId(u.id)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
                    active
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-200 bg-background hover:border-gray-300'
                  }`}
                >
                  <span className="block truncate font-medium text-text">{u.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {POSITION_LABELS[u.position]}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Textarea
        label="Заметки"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Комментарий к лиду..."
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={submitting} fullWidth size="lg">
        {submitting ? 'Сохраняем...' : 'Добавить клиента'}
      </Button>
    </form>
  )
}
