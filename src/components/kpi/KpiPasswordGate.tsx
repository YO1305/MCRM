import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { KPI_GATE_PASSWORD, KPI_UNLOCK_KEY } from '@/constants/kpiGate'

export function isKpiUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KPI_UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function KpiPasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  function submit() {
    if (value.trim() === KPI_GATE_PASSWORD) {
      try {
        sessionStorage.setItem(KPI_UNLOCK_KEY, '1')
      } catch {
        /* ignore */
      }
      onUnlock()
      return
    }
    setError('Неверный пароль')
  }

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-8">
      <h1 className="text-2xl font-bold text-text">KPI</h1>
      <p className="text-sm text-muted">Раздел закрыт. Введите пароль, чтобы открыть расчёты зарплаты.</p>
      <Input
        label="Пароль"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        error={error}
      />
      <Button type="button" onClick={submit}>
        Открыть
      </Button>
    </div>
  )
}
