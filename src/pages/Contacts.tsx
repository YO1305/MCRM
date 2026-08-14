import { useMemo, useRef, useState } from 'react'
import { Download, Plus, Search, Upload, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useContacts } from '@/hooks/useContacts'
import { useOptionList } from '@/hooks/useOptionList'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Badge } from '@/components/ui/Badge'
import { CountrySelect } from '@/components/crm/CountrySelect'
import { EditableOptionSelect } from '@/components/admin/EditableOptionSelect'
import { countryName } from '@/constants/leadProducts'
import {
  downloadContactsTemplate,
  exportContactsToExcel,
  parseContactsCsv,
} from '@/utils/exportContacts'
import type {
  Contact,
  ContactRelation,
  ContactStatus,
} from '@/types/contact.types'

type StatusFilter = 'all' | ContactStatus
type RelationFilter = 'all' | ContactRelation

export function Contacts() {
  const { canAccess } = useRole()
  const enabled = canAccess('contacts')
  const {
    contacts,
    loading,
    error,
    createContact,
    updateContact,
    deleteContact,
    importRows,
  } = useContacts(enabled)

  const statusList = useOptionList('contact_status')
  const relationList = useOptionList('contact_relation')
  const sourceList = useOptionList('contact_source')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [relationFilter, setRelationFilter] = useState<RelationFilter>('all')
  const [editing, setEditing] = useState<Contact | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('UZ')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<ContactStatus>('passive')
  const [relation, setRelation] = useState<ContactRelation>('contact')
  const [source, setSource] = useState('instagram')
  const [exhibitionName, setExhibitionName] = useState('')
  const [exhibitionDate, setExhibitionDate] = useState('')
  const [buysWhat, setBuysWhat] = useState('')
  const [busy, setBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const showExhibition = sourceList.requiresExhibition(source)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      if (statusFilter !== 'all' && (c.status || 'active') !== statusFilter) return false
      if (relationFilter !== 'all' && (c.relation || 'contact') !== relationFilter) {
        return false
      }
      if (!q) return true
      const hay =
        `${c.name} ${c.phone} ${c.company} ${c.email} ${c.notes} ${c.buysWhat} ${c.source || ''} ${c.exhibitionName || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [contacts, search, statusFilter, relationFilter])

  const stats = useMemo(() => {
    return {
      total: contacts.length,
      active: contacts.filter((c) => (c.status || 'active') === 'active').length,
      passive: contacts.filter((c) => c.status === 'passive').length,
      partners: contacts.filter((c) => c.relation === 'partner').length,
      contactsOnly: contacts.filter((c) => (c.relation || 'contact') === 'contact').length,
    }
  }, [contacts])

  function openCreate() {
    setEditing(null)
    setCreating(true)
    setName('')
    setPhone('')
    setCompany('')
    setEmail('')
    setCountry('UZ')
    setNotes('')
    setStatus('passive')
    setRelation('contact')
    setSource('instagram')
    setExhibitionName('')
    setExhibitionDate('')
    setBuysWhat('')
  }

  function openEdit(c: Contact) {
    setCreating(false)
    setEditing(c)
    setName(c.name)
    setPhone(c.phone)
    setCompany(c.company || '')
    setEmail(c.email || '')
    setCountry(c.country || 'UZ')
    setNotes(c.notes || '')
    setStatus(c.status || 'active')
    setRelation(c.relation || 'contact')
    setSource(c.source || 'instagram')
    setExhibitionName(c.exhibitionName || '')
    setExhibitionDate(c.exhibitionDate || '')
    setBuysWhat(c.buysWhat || '')
  }

  function closeForm() {
    setCreating(false)
    setEditing(null)
  }

  async function handleSave() {
    if (!name.trim() || !phone.trim()) return
    if (!source) {
      alert('Укажите источник')
      return
    }
    if (showExhibition && !exhibitionName.trim()) {
      alert('Укажите название выставки')
      return
    }
    setBusy(true)
    try {
      const payload = {
        name,
        phone,
        company,
        email,
        country,
        notes,
        status,
        relation,
        source,
        exhibitionName: showExhibition ? exhibitionName : '',
        exhibitionDate: showExhibition ? exhibitionDate || null : null,
        buysWhat,
      }
      if (editing) {
        await updateContact(editing.id, payload)
      } else {
        await createContact(payload)
      }
      closeForm()
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport(file: File) {
    setImportMsg('')
    const text = await file.text()
    const { rows, errors } = parseContactsCsv(text)
    if (errors.length && rows.length === 0) {
      setImportMsg(errors.slice(0, 5).join('\n'))
      return
    }
    setBusy(true)
    try {
      const result = await importRows(rows)
      setImportMsg(
        `Импорт: +${result.created} новых, обновлено ${result.updated}` +
          (errors.length ? `\nПропущено: ${errors.length}` : ''),
      )
    } catch (err) {
      console.error(err)
      setImportMsg('Ошибка импорта')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (!enabled) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text">База клиентов</h1>
        <p className="text-sm text-muted">Нет доступа</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">База клиентов</h1>
          <p className="mt-1 text-sm text-muted">
            Контакты, потенциальные и партнёры. Работа в CRM → статус «Актив»
            автоматически.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Контакт
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatChip label="Всего" value={stats.total} />
        <StatChip label="Актив" value={stats.active} tone="success" />
        <StatChip label="Пассив" value={stats.passive} />
        <StatChip label="Контакты" value={stats.contactsOnly} />
        <StatChip label="Партнёры" value={stats.partners} tone="info" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => downloadContactsTemplate()}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Шаблон Excel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => exportContactsToExcel(contacts)}
          disabled={contacts.length === 0}
        >
          <Download className="h-3.5 w-3.5" />
          Экспорт
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload className="h-3.5 w-3.5" />
          Импорт
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleImport(file)
          }}
        />
      </div>

      {importMsg && (
        <div className="whitespace-pre-wrap rounded-lg bg-secondary/10 px-3 py-2 text-sm text-secondary">
          {importMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            statusFilter === 'all'
              ? 'bg-primary text-white'
              : 'bg-surface text-muted shadow-sm'
          }`}
        >
          Все статусы
        </button>
        {statusList.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setStatusFilter(o.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              statusFilter === o.value
                ? 'bg-primary text-white'
                : 'bg-surface text-muted shadow-sm'
            }`}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRelationFilter('all')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            relationFilter === 'all'
              ? 'bg-secondary text-white'
              : 'bg-surface text-muted shadow-sm'
          }`}
        >
          Все типы
        </button>
        {relationList.options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setRelationFilter(o.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              relationFilter === o.value
                ? 'bg-secondary text-white'
                : 'bg-surface text-muted shadow-sm'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-[13px] h-4 w-4 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: имя, телефон, компания, источник, что покупает..."
          className="w-full rounded-lg border border-gray-200 bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
      </div>

      {(creating || editing) && (
        <Card className="space-y-3">
          <h2 className="text-base font-semibold text-text">
            {editing ? 'Редактировать контакт' : 'Новый контакт'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Имя *" value={name} onChange={(e) => setName(e.target.value)} />
            <Input
              label="Телефон *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 ..."
            />
            <Input
              label="Компания"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Input
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <CountrySelect value={country} onChange={setCountry} showEuropeHint={false} />
          <div className="grid gap-3 sm:grid-cols-2">
            <EditableOptionSelect
              listId="contact_status"
              label="Статус"
              value={status}
              onChange={setStatus}
            />
            <EditableOptionSelect
              listId="contact_relation"
              label="Тип"
              value={relation}
              onChange={setRelation}
            />
          </div>
          <EditableOptionSelect
            listId="contact_source"
            label="Источник *"
            value={source}
            onChange={(v) => {
              setSource(v)
              if (!sourceList.requiresExhibition(v)) {
                setExhibitionName('')
                setExhibitionDate('')
              }
            }}
          />
          {showExhibition && (
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
          <Textarea
            label="Что покупает"
            value={buysWhat}
            onChange={(e) => setBuysWhat(e.target.value)}
            placeholder="Например: сатин, постельное бельё, полотенца..."
          />
          <Textarea
            label="Заметки"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !name.trim() || !phone.trim()}
              onClick={() => void handleSave()}
            >
              {busy ? '...' : 'Сохранить'}
            </Button>
            <Button type="button" variant="ghost" onClick={closeForm}>
              Отмена
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Ничего не найдено. Добавьте контакты вручную, импортом или через лиды CRM.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-muted">
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Источник</th>
                <th className="px-4 py-3 font-medium">Что покупает</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const st = c.status || 'active'
                const rel = c.relation || 'contact'
                const srcLabel = sourceList.labelOf(c.source)
                const exhibitionExtra =
                  c.exhibitionName &&
                  `${c.exhibitionName}${c.exhibitionDate ? ` (${c.exhibitionDate})` : ''}`
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-background/80">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-text hover:text-secondary"
                        onClick={() => openEdit(c)}
                      >
                        {c.name}
                      </button>
                      <p className="text-xs text-muted">
                        {c.company || countryName(c.country)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text">{c.phone}</td>
                    <td className="px-4 py-3">
                      <Badge variant={st === 'active' ? 'success' : 'default'}>
                        {statusList.labelOf(st)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={rel === 'partner' ? 'info' : 'default'}>
                        {relationList.labelOf(rel)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <span className="block">{srcLabel}</span>
                      {exhibitionExtra && (
                        <span className="block text-[11px] opacity-80">{exhibitionExtra}</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted">
                      {c.buysWhat || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-danger"
                        aria-label="Удалить"
                        onClick={() => {
                          if (confirm(`Удалить «${c.name}» из базы?`)) {
                            void deleteContact(c.id)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-muted">Показано: {filtered.length}</p>
        </Card>
      )}
    </div>
  )
}

function StatChip({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'info'
}) {
  const tones = {
    default: 'bg-surface text-text',
    success: 'bg-emerald-50 text-emerald-800',
    info: 'bg-secondary/10 text-secondary',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
    </div>
  )
}
