import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function Login() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading || submitting) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-primary via-primary to-secondary p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signIn(email.trim(), password)
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: string }).code)
          : ''

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Неверный email или пароль')
      } else if (code === 'auth/user-not-found') {
        setError('Пользователь не найден')
      } else if (code === 'auth/invalid-email') {
        setError('Некорректный email')
      } else if (code === 'auth/too-many-requests') {
        setError('Слишком много попыток. Попробуйте позже')
      } else if (code === 'auth/unauthorized-domain') {
        setError('Домен не разрешён в Firebase Auth')
      } else if (code === 'auth/network-request-failed') {
        setError('Нет связи с сервером. Проверьте интернет и попробуйте снова')
      } else {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message: string }).message)
            : ''
        setError(message || 'Ошибка входа. Проверьте данные и настройки Firebase')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-primary via-primary to-secondary p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">BAHMAL</h1>
          <p className="mt-1 text-sm text-muted">CRM · Отдел маркетинга</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@bahmal.uz"
            required
          />
          <Input
            label="Пароль"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</div>
          )}

          <Button type="submit" fullWidth disabled={submitting} size="lg">
            {submitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>
      </div>
    </div>
  )
}
