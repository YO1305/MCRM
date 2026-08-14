import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { Contact } from '@/types/contact.types'
import { countryName } from '@/constants/leadProducts'

interface ContactPickerProps {
  contacts: Contact[]
  onPick: (contact: Contact) => void
}

export function ContactPicker({ contacts, onPick }: ContactPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return contacts
      .filter((c) => {
        const hay = `${c.name} ${c.phone} ${c.company} ${c.email}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 8)
  }, [contacts, query])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label className="text-sm font-medium text-text">Из базы клиентов</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Найти по имени или телефону..."
          className="w-full rounded-lg border border-gray-200 bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-surface shadow-lg">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2.5 text-left text-sm hover:bg-background"
                onClick={() => {
                  onPick(c)
                  setQuery('')
                  setOpen(false)
                }}
              >
                <span className="font-medium text-text">{c.name}</span>
                <span className="text-xs text-muted">
                  {c.phone}
                  {c.company ? ` · ${c.company}` : ''}
                  {c.country ? ` · ${countryName(c.country)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">
        Если клиент уже в базе — выберите его. Новый лид тоже попадёт в базу.
      </p>
    </div>
  )
}
