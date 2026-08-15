import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Eye, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useUsers } from '@/hooks/useUsers'
import { useNotifications } from '@/hooks/useNotifications'
import { POSITION_LABELS } from '@/constants/positions'
import { Button } from '@/components/ui/Button'

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, realUser, viewAsUser, isRealAdmin, setViewAsUser, signOut } = useAuth()
  const { users } = useUsers(isRealAdmin)
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [cabinetOpen, setCabinetOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const cabinetRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const team = useMemo(
    () => users.filter((u) => u.id !== realUser?.id && u.role !== 'admin'),
    [users, realUser?.id],
  )

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
      if (!cabinetRef.current?.contains(e.target as Node)) setCabinetOpen(false)
    }
    if (open || cabinetOpen) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open, cabinetOpen])

  function pickCabinet(id: string) {
    if (id === '' || id === realUser?.id) {
      setViewAsUser(null)
      setCabinetOpen(false)
      navigate('/')
      return
    }
    const employee = users.find((u) => u.id === id)
    if (employee) {
      setViewAsUser(employee)
      setCabinetOpen(false)
      navigate('/')
    }
  }

  return (
    <div className="shrink-0">
      {viewAsUser && (
        <div className="flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-white lg:px-6">
          <p className="min-w-0 truncate font-medium">
            Смотрите кабинет: {viewAsUser.name}
            <span className="ml-1 font-normal opacity-90">
              · {POSITION_LABELS[viewAsUser.position]}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              setViewAsUser(null)
              navigate('/')
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30"
          >
            <X className="h-3.5 w-3.5" />
            Мой кабинет
          </button>
        </div>
      )}

      <header className="flex h-16 items-center justify-between border-b border-gray-100 bg-surface px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-background lg:hidden"
            onClick={onMenuClick}
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-text">{user?.name}</p>
            <p className="truncate text-xs text-muted">
              {user ? POSITION_LABELS[user.position] : ''}
              {viewAsUser ? ' · просмотр' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isRealAdmin && (
            <div className="relative" ref={cabinetRef}>
              <button
                type="button"
                onClick={() => setCabinetOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium sm:text-sm ${
                  viewAsUser
                    ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'text-muted hover:bg-background hover:text-text'
                }`}
                aria-label="Кабинет сотрудника"
              >
                <Eye size={16} />
                <span className="hidden sm:inline">
                  {viewAsUser ? 'Сменить' : 'Кабинет'}
                </span>
              </button>

              {cabinetOpen && (
                <div className="absolute right-0 z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-100 bg-surface shadow-xl">
                  <div className="border-b border-gray-100 px-3 py-2">
                    <p className="text-sm font-semibold text-text">Смотреть как</p>
                    <p className="text-[11px] text-muted">
                      Меню и данные как у сотрудника
                    </p>
                  </div>
                  <ul className="max-h-72 overflow-y-auto py-1">
                    <li>
                      <button
                        type="button"
                        onClick={() => pickCabinet('')}
                        className={`flex w-full flex-col px-3 py-2.5 text-left text-sm hover:bg-background ${
                          !viewAsUser ? 'bg-secondary/5 font-medium text-secondary' : 'text-text'
                        }`}
                      >
                        Мой кабинет (админ)
                        {realUser && (
                          <span className="text-xs font-normal text-muted">{realUser.name}</span>
                        )}
                      </button>
                    </li>
                    {team.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => pickCabinet(u.id)}
                          className={`flex w-full flex-col px-3 py-2.5 text-left text-sm hover:bg-background ${
                            viewAsUser?.id === u.id
                              ? 'bg-amber-50 font-medium text-amber-900'
                              : 'text-text'
                          }`}
                        >
                          {u.name}
                          <span className="text-xs font-normal text-muted">
                            {POSITION_LABELS[u.position]}
                          </span>
                        </button>
                      </li>
                    ))}
                    {team.length === 0 && (
                      <li className="px-3 py-4 text-center text-xs text-muted">
                        Нет сотрудников в списке
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="relative rounded-lg p-2 text-muted hover:bg-background hover:text-text"
              aria-label="Уведомления"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-100 bg-surface shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                  <p className="text-sm font-semibold text-text">Уведомления</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      className="text-xs text-secondary hover:underline"
                    >
                      Прочитать все
                    </button>
                  )}
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <li className="px-3 py-6 text-center text-sm text-muted">Пока пусто</li>
                  ) : (
                    notifications.slice(0, 30).map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void markRead(n.id)
                            setOpen(false)
                            if (n.type === 'smm_payment_reminder' || n.link?.includes('smm-payments')) {
                              navigate(n.link || '/smm-payments')
                            } else if (
                              n.type === 'client_visit' ||
                              n.type?.startsWith('lead_') ||
                              n.link?.includes('/crm')
                            ) {
                              navigate(n.link || '/crm')
                            } else if (n.type?.startsWith('dev_')) {
                              navigate('/subtasks')
                            } else if (n.taskId) {
                              navigate('/tasks')
                            }
                          }}
                          className={`w-full px-3 py-2.5 text-left hover:bg-background ${
                            n.type === 'client_visit' && !n.read
                              ? 'bg-amber-50'
                              : n.read
                                ? ''
                                : 'bg-secondary/5'
                          }`}
                        >
                          <p
                            className={`font-medium text-text ${
                              n.type === 'client_visit' ? 'text-base' : 'text-sm'
                            }`}
                          >
                            {n.title}
                          </p>
                          <p
                            className={`mt-0.5 text-muted ${
                              n.type === 'client_visit' ? 'text-sm' : 'line-clamp-2 text-xs'
                            }`}
                          >
                            {n.body}
                          </p>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut size={16} />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </header>
    </div>
  )
}
