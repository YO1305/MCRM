import type { InputHTMLAttributes } from 'react'
import type { CertificateFlags } from '@/types/kpiDeptPayroll.types'

export function NumField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-text">
      {label}
      <input
        type="number"
        step="any"
        className="rounded-lg border border-gray-200 bg-surface px-3 py-2 text-sm font-normal outline-none focus:border-secondary"
        {...props}
      />
    </label>
  )
}

export function Money({ value }: { value: number }) {
  const n = Number.isFinite(value) ? value : 0
  return (
    <span className="tabular-nums font-semibold text-text">
      {n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}
      <span className="ml-1 text-xs font-normal text-muted">тыс сум</span>
    </span>
  )
}

export function CertChecks({
  value,
  onChange,
}: {
  value: CertificateFlags
  onChange: (next: CertificateFlags) => void
}) {
  const items: { key: keyof CertificateFlags; label: string }[] = [
    { key: 'iso', label: 'ISO (300)' },
    { key: 'betterWork', label: 'Better Work (2 000)' },
    { key: 'oekoFabric', label: 'Oeko Tex ткань (2 000)' },
    { key: 'oekoGp', label: 'Oeko Tex ГП (2 000)' },
    { key: 'bsci', label: 'BSCI (3 000)' },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((item) => (
        <label key={item.key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value[item.key]}
            onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
          />
          {item.label}
        </label>
      ))}
    </div>
  )
}
