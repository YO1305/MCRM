import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useDepartments } from '@/hooks/useDepartments'
import type { Department, DepartmentType } from '@/types/department.types'

const FIXED: { type: DepartmentType; name: string }[] = [
  { type: 'fabric', name: 'Ткань' },
  { type: 'finished', name: 'ГП' },
]

export function DepartmentsManager() {
  const {
    departments,
    loading,
    createDepartment,
    updateDepartment,
    addMember,
    removeMember,
  } = useDepartments()
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const seeding = useRef(false)

  // Ensure two departments: Ткань + ГП (fix type if created with wrong type)
  useEffect(() => {
    if (loading || seeding.current) return

    const work: Array<() => Promise<void>> = []

    for (const item of FIXED) {
      const byType = departments.find((d) => d.type === item.type)
      if (byType) {
        if (byType.name !== item.name) {
          work.push(() => updateDepartment(byType.id, { name: item.name }))
        }
        continue
      }

      const byName = departments.find(
        (d) => d.name.trim().toLowerCase() === item.name.toLowerCase(),
      )
      if (byName) {
        work.push(() => updateDepartment(byName.id, { type: item.type, name: item.name }))
        continue
      }

      work.push(() =>
        createDepartment({ name: item.name, type: item.type, members: [] }).then(() => undefined),
      )
    }

    if (work.length === 0) return
    seeding.current = true
    void (async () => {
      try {
        for (const fn of work) await fn()
      } finally {
        seeding.current = false
      }
    })()
  }, [loading, departments, createDepartment, updateDepartment])

  const fabric = useMemo(
    () => departments.find((d) => d.type === 'fabric') || null,
    [departments],
  )
  const finished = useMemo(
    () => departments.find((d) => d.type === 'finished') || null,
    [departments],
  )

  const rows: { key: DepartmentType; title: string; dept: Department | null }[] = [
    { key: 'fabric', title: 'Ткань', dept: fabric },
    { key: 'finished', title: 'ГП', dept: finished },
  ]

  async function handleAdd(dept: Department) {
    const name = (drafts[dept.id] || '').trim()
    if (!name) return
    setBusy(true)
    try {
      await addMember(dept.id, {
        id: `mgr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
      })
      setDrafts((prev) => ({ ...prev, [dept.id]: '' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">Отделы продаж</h2>
        <p className="mt-1 text-xs text-muted">
          Два отдела — Ткань и ГП. Впишите ФИО и нажмите «+» (телефон не нужен).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Загрузка...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map(({ key, title, dept }) => (
            <div
              key={key}
              className="space-y-3 rounded-xl border border-gray-100 bg-background p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold text-text">{title}</h3>
                <span className="text-xs text-muted">
                  {dept ? (dept.members || []).length : 0} чел.
                </span>
              </div>

              {!dept ? (
                <p className="text-xs text-muted">Создаём отдел...</p>
              ) : (
                <>
                  <ul className="max-h-56 space-y-1.5 overflow-y-auto">
                    {(dept.members || []).length === 0 ? (
                      <li className="text-xs text-muted">Пока никого нет — добавьте ФИО</li>
                    ) : (
                      (dept.members || []).map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-2 text-sm"
                        >
                          <span className="font-medium text-text">{m.name}</span>
                          <button
                            type="button"
                            onClick={() => void removeMember(dept.id, m.id)}
                            className="text-xs text-muted hover:text-danger"
                          >
                            Убрать
                          </button>
                        </li>
                      ))
                    )}
                  </ul>

                  <div className="flex gap-2">
                    <Input
                      value={drafts[dept.id] || ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [dept.id]: e.target.value }))
                      }
                      placeholder="ФИО"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleAdd(dept)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || !(drafts[dept.id] || '').trim()}
                      onClick={() => void handleAdd(dept)}
                    >
                      +
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
