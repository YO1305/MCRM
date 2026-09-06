import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ShopPeriod, ShopPeriodMode } from '@/types/shop.types'

const MODES: { id: ShopPeriodMode; label: string }[] = [
  { id: 'day', label: 'День' },
  { id: 'month', label: 'Месяц' },
  { id: 'range', label: 'Период' },
]

interface ShopPeriodBarProps {
  period: ShopPeriod
  onChange: (next: ShopPeriod) => void
}

export function ShopPeriodBar({ period, onChange }: ShopPeriodBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex rounded-lg border border-gray-200 p-0.5">
        {MODES.map((mode) => (
          <Button
            key={mode.id}
            type="button"
            size="sm"
            variant={period.mode === mode.id ? 'primary' : 'ghost'}
            onClick={() => onChange({ ...period, mode: mode.id })}
          >
            {mode.label}
          </Button>
        ))}
      </div>
      {period.mode === 'day' && (
        <Input
          type="date"
          label="Дата"
          name="shop-day"
          value={period.day}
          onChange={(e) => onChange({ ...period, day: e.target.value })}
        />
      )}
      {period.mode === 'month' && (
        <Input
          type="month"
          label="Месяц"
          name="shop-month"
          value={period.month}
          onChange={(e) => onChange({ ...period, month: e.target.value })}
        />
      )}
      {period.mode === 'range' && (
        <>
          <Input
            type="date"
            label="С"
            name="shop-from"
            value={period.from}
            onChange={(e) => onChange({ ...period, from: e.target.value })}
          />
          <Input
            type="date"
            label="По"
            name="shop-to"
            value={period.to}
            onChange={(e) => onChange({ ...period, to: e.target.value })}
          />
        </>
      )}
    </div>
  )
}
