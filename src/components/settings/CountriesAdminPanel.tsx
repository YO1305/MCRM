import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useCountriesList } from '@/hooks/useCountries'
import type { CountryOption } from '@/constants/leadProducts'

export function CountriesAdminPanel() {
  const { countries, saveCountries, canEdit, loading } = useCountriesList()
  const [draft, setDraft] = useState<CountryOption[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newEurope, setNewEurope] = useState(false)

  if (!canEdit) return null

  function startEdit() {
    setDraft(countries.map((c) => ({ ...c })))
    setEditing(true)
    setMsg('')
  }

  function addCountry() {
    const code = newCode.trim().toUpperCase()
    const name = newName.trim()
    if (!code || !name) return
    if (draft.some((c) => c.code === code)) {
      setMsg('Такой код уже есть')
      return
    }
    setDraft((d) => [...d, { code, name, europe: newEurope, builtin: false }])
    setNewCode('')
    setNewName('')
    setNewEurope(false)
    setMsg('')
  }

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      await saveCountries(draft)
      setEditing(false)
      setMsg('Страны сохранены')
    } catch (err) {
      console.error(err)
      setMsg(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Страны (CRM / база)</h2>
          <p className="mt-1 text-xs text-muted">
            Добавьте Азербайджан и любые другие. Галочка «Европа» — лид пойдёт в KPI
            «Европа».
          </p>
        </div>
        {!editing ? (
          <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
            Редактировать
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
              {busy ? '...' : 'Сохранить'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Отмена
            </Button>
          </div>
        )}
      </div>

      {msg && <p className="text-sm text-muted">{msg}</p>}
      {loading && <p className="text-sm text-muted">Загрузка...</p>}

      {!editing ? (
        <p className="text-sm text-muted">В списке: {countries.length} стран</p>
      ) : (
        <div className="space-y-2">
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {draft.map((c, idx) => (
              <li
                key={c.code}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2"
              >
                <span className="w-12 text-xs font-mono text-muted">{c.code}</span>
                <input
                  value={c.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setDraft((d) => d.map((x, i) => (i === idx ? { ...x, name } : x)))
                  }}
                  className="min-w-0 flex-1 rounded-md border border-gray-200 bg-surface px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={c.europe}
                    onChange={(e) => {
                      const europe = e.target.checked
                      setDraft((d) => d.map((x, i) => (i === idx ? { ...x, europe } : x)))
                    }}
                  />
                  Европа
                </label>
                {!c.builtin && (
                  <button
                    type="button"
                    className="rounded p-1 text-muted hover:bg-red-50 hover:text-danger"
                    onClick={() => setDraft((d) => d.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="grid gap-2 rounded-xl border border-dashed border-gray-200 p-3 sm:grid-cols-[0.6fr_1.2fr_auto_auto]">
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="Код: AZ"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Название: Азербайджан"
            />
            <label className="flex items-center gap-1 self-center text-xs text-muted">
              <input
                type="checkbox"
                checked={newEurope}
                onChange={(e) => setNewEurope(e.target.checked)}
              />
              Европа
            </label>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!newCode.trim() || !newName.trim()}
              onClick={addCountry}
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
