import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CRM crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-lg font-bold text-text">CRM не смогла открыться</h1>
        <p className="max-w-md text-sm text-muted">
          Обновите страницу. Если снова белый экран — откройте в режиме инкогнито или очистите
          кэш сайта.
        </p>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={() => window.location.reload()}
        >
          Обновить
        </button>
      </div>
    )
  }
}
