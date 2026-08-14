import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || props.name

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-muted focus:border-secondary focus:ring-2 focus:ring-secondary/20 ${error ? 'border-danger' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
