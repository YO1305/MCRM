import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  BarChart3,
  MoreHorizontal,
  FileText,
  BookUser,
  Palette,
  BookOpen,
  Store,
  Tag,
  Megaphone,
  Wallet,
  FolderKanban,
  ListTodo,
  LineChart,
  FileWarning,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRole } from '@/hooks/useRole'
import type { AppSection } from '@/constants/access'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  section: AppSection
  end?: boolean
}

const ALL_ITEMS: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard, section: 'dashboard', end: true },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare, section: 'tasks' },
  { to: '/reports', label: 'Отчёты', icon: FileText, section: 'reports' },
  { to: '/crm', label: 'CRM', icon: Users, section: 'crm' },
  { to: '/contacts', label: 'База', icon: BookUser, section: 'contacts' },
  { to: '/kpi', label: 'KPI', icon: BarChart3, section: 'kpi' },
  { to: '/design', label: 'Дизайн', icon: Palette, section: 'design' },
  { to: '/catalogue', label: 'Каталог', icon: BookOpen, section: 'catalogue' },
  { to: '/showroom', label: 'Шоурум', icon: Store, section: 'showroom' },
  { to: '/labels', label: 'Бирки', icon: Tag, section: 'labels' },
  { to: '/smm', label: 'СММ', icon: Megaphone, section: 'smm' },
  { to: '/smm-payments', label: 'Оплата', icon: Wallet, section: 'smm_payments' },
  { to: '/projects', label: 'Проекты', icon: FolderKanban, section: 'projects' },
  { to: '/subtasks', label: 'Подзадачи', icon: ListTodo, section: 'milestones' },
  { to: '/analytics', label: 'Аналитика', icon: LineChart, section: 'analytics' },
  { to: '/requests', label: 'Заявки', icon: FileWarning, section: 'requests' },
  { to: '/settings', label: 'Настройки', icon: Settings, section: 'settings' },
]

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const { canAccess } = useRole()

  const visible = useMemo(
    () => ALL_ITEMS.filter((item) => canAccess(item.section)),
    [canAccess],
  )

  const primary = visible.slice(0, 4)
  const moreItems = visible.slice(4)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {moreOpen && moreItems.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 border-t border-gray-100 bg-surface p-2 shadow-lg">
          {moreItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-4 py-3 text-sm font-medium ${
                  isActive ? 'bg-primary/10 text-primary' : 'text-text hover:bg-background'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      <div className="flex h-16 items-center justify-around">
        {primary.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          )
        })}
        {moreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
              moreOpen ? 'text-primary' : 'text-muted'
            }`}
          >
            <MoreHorizontal size={20} />
            Ещё
          </button>
        )}
      </div>
    </nav>
  )
}
