import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { countryName, isEuropeanCountry } from '@/constants/leadProducts'
import { useCountriesList } from '@/hooks/useCountries'

interface CountrySelectProps {
  value: string
  onChange: (code: string) => void
  label?: string
  required?: boolean
  showEuropeHint?: boolean
}

export function CountrySelect({
  value,
  onChange,
  label = 'Страна',
  required,
  showEuropeHint = true,
}: CountrySelectProps) {
  const { countries } = useCountriesList()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.europe && 'европа'.includes(q)),
    )
  }, [query, countries])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  function pick(code: string) {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  const selectedLabel = countryName(value)

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      <label className="text-sm font-medium text-text">
        {label}
        {required ? ' *' : ''}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-left text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        >
          <span className={value ? 'text-text' : 'text-muted'}>
            {value ? (
              <>
                {selectedLabel}
                {isEuropeanCountry(value) ? (
                  <span className="text-muted"> · Европа</span>
                ) : null}
              </>
            ) : (
              'Выберите страну'
            )}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-surface shadow-lg">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск: Азербайджан, AZ..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">Ничего не найдено</li>
              ) : (
                filtered.map((c) => {
                  const active = c.code === value
                  return (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => pick(c.code)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                          active
                            ? 'bg-secondary/10 font-medium text-secondary'
                            : 'text-text hover:bg-background'
                        }`}
                      >
                        <span>{c.name}</span>
                        {c.europe && (
                          <span className="text-[11px] text-muted">Европа</span>
                        )}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        )}
      </div>
      {showEuropeHint && isEuropeanCountry(value) && (
        <p className="text-xs text-secondary">KPI: лид пойдёт в категорию «Европа»</p>
      )}
    </div>
  )
}
