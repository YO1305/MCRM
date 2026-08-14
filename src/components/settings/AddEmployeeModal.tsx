import { useMemo, useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  CONFIGURABLE_SECTIONS,
  SECTION_LABELS,
  defaultConfigurableSections,
  type AppSection,
} from '@/constants/access'
import { POSITION_LABELS } from '@/constants/positions'
import { adminCreateUser } from '@/firebase/callable'
import type { Position, Role } from '@/types/user.types'

interface AddEmployeeModalProps {
  onClose: () => void
  onCreated?: (userId: string) => void
}

export function AddEmployeeModal({ onClose, onCreated }: AddEmployeeModalProps) {
  const [name, setName] = useState('')
  const [position, setPosition] = useState<Position>('leads_manager_2')
  const [role, setRole] = useState<Role>('employee')
  const [withLogin, setWithLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [useCustomMenu, setUseCustomMenu] = useState(true)
  const defaults = useMemo(() => defaultConfigurableSections(position), [position])
  const [sections, setSections] = useState<AppSection[]>(defaults)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function applyPosition(next: Position) {
    setPosition(next)
    if (!useCustomMenu) {
      setSections(defaultConfigurableSections(next))
    }
  }

  function toggleSection(section: AppSection) {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Укажите имя')
      return
    }
    if (withLogin) {
      if (!email.trim()) {
        setError('Укажите email (логин) или отключите вход')
        return
      }
      if (password.length < 6) {
        setError('Пароль минимум 6 символов')
        return
      }
      if (password !== password2) {
        setError('Пароли не совпадают')
        return
      }
    }

    setBusy(true)
    try {
      const result = await adminCreateUser({
        name: name.trim(),
        position,
        role,
        withLogin,
        email: email.trim() || undefined,
        password: withLogin ? password : undefined,
        useCustomMenu,
        enabledSections: useCustomMenu ? sections : undefined,
      })
      onCreated?.(result.userId)
      onClose()
    } catch (err: unknown) {
      console.error(err)
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : ''
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : ''
      if (code === 'NO_SERVICE_ACCOUNT' || message.includes('SERVICE_ACCOUNT')) {
        setError(
          'Нужен ключ Firebase Admin: Console → Project settings → Service accounts → Generate new private key. Вставьте JSON в Vercel → Environment Variable FIREBASE_SERVICE_ACCOUNT_JSON и сделайте Redeploy.',
        )
      } else if (message.includes('занят') || code.includes('already')) {
        setError('Такой email уже занят')
      } else {
        setError(message.replace(/^Firebase:\s*/i, '') || 'Не удалось добавить сотрудника')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} role="presentation" />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-surface px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-text">Добавить в команду</h2>
            <p className="text-xs text-muted">
              Имя, должность, вход (по желанию) и доступ к разделам
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-background hover:text-text"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 p-4 sm:p-5">
          <Input
            label="Имя *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Как в CRM"
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Должность</label>
              <select
                value={position}
                onChange={(e) => applyPosition(e.target.value as Position)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
              >
                {(Object.keys(POSITION_LABELS) as Position[]).map((key) => (
                  <option key={key} value={key}>
                    {POSITION_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text">Роль</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="rounded-lg border border-gray-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-secondary"
              >
                <option value="employee">Сотрудник</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>

          <section className="space-y-3 rounded-xl border border-secondary/25 bg-secondary/5 p-3">
            <label className="flex items-start gap-2 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={withLogin}
                onChange={(e) => setWithLogin(e.target.checked)}
              />
              <span>
                <span className="font-medium">Дать вход в CRM</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Если выключено — человек в команде (задачи, списки), но войти не сможет.
                  Логин можно включить позже.
                </span>
              </span>
            </label>
            {withLogin && (
              <div className="space-y-3">
                <Input
                  label="Email (логин) *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  required={withLogin}
                />
                <Input
                  label="Пароль *"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  autoComplete="new-password"
                  required={withLogin}
                />
                <Input
                  label="Повтор пароля *"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  autoComplete="new-password"
                  required={withLogin}
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">Доступ к разделам</h3>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={useCustomMenu}
                  onChange={(e) => {
                    const on = e.target.checked
                    setUseCustomMenu(on)
                    if (!on) setSections(defaultConfigurableSections(position))
                  }}
                />
                Выбрать вручную
              </label>
            </div>
            <p className="text-xs text-muted">
              {useCustomMenu
                ? 'Отметьте только нужные разделы — остальное в меню не появится.'
                : 'По должности (дефолт). Включите «Выбрать вручную», чтобы ограничить меню.'}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONFIGURABLE_SECTIONS.map((section) => {
                const active = sections.includes(section)
                return (
                  <button
                    key={section}
                    type="button"
                    disabled={!useCustomMenu}
                    onClick={() => toggleSection(section)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm disabled:opacity-50 ${
                      active
                        ? 'border-secondary bg-secondary/10'
                        : 'border-gray-200 bg-background'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        active
                          ? 'border-secondary bg-secondary text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {SECTION_LABELS[section]}
                  </button>
                )
              })}
            </div>
          </section>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Создаём...' : 'Добавить'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Отмена
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
