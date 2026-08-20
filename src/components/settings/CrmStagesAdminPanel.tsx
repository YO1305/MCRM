import { useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { db } from '@/firebase/config'
import { updateDocument } from '@/firebase/firestore'
import { useClientStages, applyCloseKind, closeKindOf } from '@/hooks/useClientStages'
import { slugifyOption } from '@/constants/optionLists'
import type { CrmStageOption, StageCloseKind, StageKpiBucket } from '@/constants/clientStages'
import { stageOptionIsClosed } from '@/constants/clientStages'

const KPI_BUCKET_LABELS: Record<StageKpiBucket, string> = {
  none: 'Не в KPI',
  lead: 'KPI · Лид',
  deal: 'KPI · Сделка',
}

const CLOSE_KIND_LABELS: Record<StageCloseKind, string> = {
  none: 'В воронке',
  rejected: 'Архив · Отказ',
  failed: 'Архив · Провалено',
  abandoned: 'Архив · Заброшено',
}

export function CrmStagesAdminPanel() {
  const { stages, saveStages, canEdit, loading } = useClientStages()
  const [draft, setDraft] = useState<CrmStageOption[]>([])
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [clearingKpi, setClearingKpi] = useState(false)

  if (!canEdit) return null

  function startEdit() {
    setDraft(
      [...stages]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ ...s })),
    )
    setEditing(true)
    setMsg('')
  }

  function move(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...d]
      const j = idx + dir
      if (j < 0 || j >= next.length) return d
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next.map((s, i) => ({ ...s, order: (i + 1) * 10 }))
    })
  }

  function addStage() {
    const label = newLabel.trim()
    if (!label) return
    let value = slugifyOption(label)
    if (draft.some((s) => s.value === value)) {
      value = `${value}_${Date.now().toString(36)}`
    }
    setDraft((d) => [
      ...d,
      {
        value,
        label,
        order: (d.length + 1) * 10,
        active: true,
        countsAsKpiLead: false,
        kpiBucket: 'none',
        isRejected: false,
        isFailed: false,
        isAbandoned: false,
        builtin: false,
      },
    ])
    setNewLabel('')
  }

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      const ordered = draft.map((s, i) => ({ ...s, order: (i + 1) * 10 }))
      await saveStages(ordered)
      setEditing(false)
      setMsg('Этапы воронки сохранены')
    } catch (err) {
      console.error(err)
      setMsg(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setBusy(false)
    }
  }

  async function clearKpiBadges() {
    if (
      !confirm(
        'Сбросить старые отметки KPI на карточках?\n\nЖурнал KPI за прошлые месяцы останется. Новые лиды с этапов больше не пишутся.',
      )
    ) {
      return
    }
    setClearingKpi(true)
    setMsg('')
    try {
      const snap = await getDocs(
        query(collection(db, 'clients'), where('kpiLeadCounted', '==', true)),
      )
      await Promise.all(
        snap.docs.map((d) =>
          updateDocument('clients', d.id, {
            kpiLeadCounted: false,
            kpiLeadMonth: null,
          }),
        ),
      )
      setMsg(`Сброшено отметок KPI: ${snap.size}`)
    } catch (err) {
      console.error(err)
      setMsg(err instanceof Error ? err.message : 'Не удалось сбросить KPI')
    } finally {
      setClearingKpi(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Этапы воронки CRM</h2>
          <p className="mt-1 text-xs text-muted">
            Этапы воронки. «Лид KPI» с перехода по этапам больше не считается — активность
            смотрит Groq (Настройки → ИИ Помощник → Активность лидов). Не забудьте нажать
            «Сохранить».
          </p>
        </div>
        {!editing ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={startEdit}>
              Настроить
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={clearingKpi}
              onClick={() => void clearKpiBadges()}
            >
              {clearingKpi ? '...' : 'Сбросить отметки KPI'}
            </Button>
          </div>
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
        <ul className="space-y-1.5">
          {[...stages]
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <li
                key={s.value}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm"
              >
                <span className="font-medium text-text">{s.label}</span>
                {!s.active && <Badge variant="default">Выкл</Badge>}
                {s.isRejected && <Badge variant="danger">Отказ</Badge>}
                {s.isFailed && <Badge variant="danger">Провалено</Badge>}
                {s.isAbandoned && <Badge variant="warning">Заброшено</Badge>}
                {s.kpiBucket === 'deal' && <Badge variant="success">Сделка KPI</Badge>}
                {stageOptionIsClosed(s) && <Badge variant="default">Архив</Badge>}
              </li>
            ))}
        </ul>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-2">
            {draft.map((s, idx) => (
              <li
                key={s.value}
                className="space-y-2 rounded-xl border border-gray-100 bg-background px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted hover:bg-surface"
                      onClick={() => move(idx, -1)}
                      aria-label="Выше"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted hover:bg-surface"
                      onClick={() => move(idx, 1)}
                      aria-label="Ниже"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    value={s.label}
                    onChange={(e) => {
                      const label = e.target.value
                      setDraft((d) =>
                        d.map((x, i) => (i === idx ? { ...x, label } : x)),
                      )
                    }}
                    className="min-w-0 flex-1 rounded-md border border-gray-200 bg-surface px-2 py-1.5 text-sm"
                  />
                  {!s.builtin && (
                    <button
                      type="button"
                      className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-danger"
                      onClick={() => setDraft((d) => d.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={s.active}
                      onChange={(e) => {
                        const active = e.target.checked
                        setDraft((d) =>
                          d.map((x, i) => (i === idx ? { ...x, active } : x)),
                        )
                      }}
                    />
                    Активен
                  </label>
                  <select
                    value={closeKindOf(s)}
                    onChange={(e) => {
                      const kind = e.target.value as StageCloseKind
                      setDraft((d) =>
                        d.map((x, i) => (i === idx ? applyCloseKind(x, kind) : x)),
                      )
                    }}
                    className="rounded-md border border-gray-200 bg-surface px-2 py-1 text-xs"
                  >
                    {(Object.keys(CLOSE_KIND_LABELS) as StageCloseKind[]).map((k) => (
                      <option key={k} value={k}>
                        {CLOSE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={s.kpiBucket}
                    onChange={(e) => {
                      const kpiBucket = e.target.value as StageKpiBucket
                      setDraft((d) =>
                        d.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                kpiBucket,
                                countsAsKpiLead:
                                  kpiBucket === 'lead'
                                    ? true
                                    : kpiBucket === 'none'
                                      ? false
                                      : x.countsAsKpiLead,
                              }
                            : x,
                        ),
                      )
                    }}
                    className="rounded-md border border-gray-200 bg-surface px-2 py-1 text-xs"
                  >
                    {(Object.keys(KPI_BUCKET_LABELS) as StageKpiBucket[]).map((k) => (
                      <option key={k} value={k}>
                        {KPI_BUCKET_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono text-[10px] opacity-60">{s.value}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-gray-200 p-3">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Новый этап: например «Образцы отправлены»"
              className="min-w-[200px] flex-1"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!newLabel.trim()}
              onClick={addStage}
            >
              <Plus className="h-3.5 w-3.5" />
              Добавить этап
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
