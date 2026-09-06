import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  BarChart3,
  Palette,
  BookOpen,
  Store,
  Tag,
  Megaphone,
  Wallet,
  FolderKanban,
  ListTodo,
  LineChart,
  FileText,
  Settings,
  FileWarning,
  BookUser,
  ShoppingBag,
  X,
} from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useAiTasks } from '@/hooks/useAiTasks'
import type { AppSection } from '@/constants/access'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  section: AppSection
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Дашборд', icon: LayoutDashboard, section: 'dashboard' },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare, section: 'tasks' },
  { to: '/reports', label: 'Отчёты', icon: FileText, section: 'reports' },
  { to: '/crm', label: 'CRM', icon: Users, section: 'crm' },
  { to: '/contacts', label: 'База', icon: BookUser, section: 'contacts' },
  { to: '/kpi', label: 'KPI', icon: BarChart3, section: 'kpi' },
  { to: '/design', label: 'Дизайн', icon: Palette, section: 'design' },
  { to: '/catalogue', label: 'Каталог и КП', icon: BookOpen, section: 'catalogue' },
  { to: '/shops', label: 'Магазины', icon: ShoppingBag, section: 'shops' },
  { to: '/showroom', label: 'Шоурум', icon: Store, section: 'showroom' },
  { to: '/labels', label: 'Печать бирок', icon: Tag, section: 'labels' },
  { to: '/smm', label: 'Контроль СММ', icon: Megaphone, section: 'smm' },
  { to: '/smm-payments', label: 'SMM оплата', icon: Wallet, section: 'smm_payments' },
  { to: '/projects', label: 'Проекты', icon: FolderKanban, section: 'projects' },
  { to: '/subtasks', label: 'Подзадачи', icon: ListTodo, section: 'milestones' },
  { to: '/analytics', label: 'Аналитика', icon: LineChart, section: 'analytics' },
  { to: '/requests', label: 'Заявки', icon: FileWarning, section: 'requests' },
  { to: '/settings', label: 'Настройки', icon: Settings, section: 'settings' },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { canAccess } = useRole()
  const { pendingCount } = useAiTasks()
  const visibleItems = NAV_ITEMS.filter((item) => canAccess(item.section))

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Закрыть меню"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-primary text-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <div>
            <p className="text-lg font-bold tracking-wide">BAHMAL</p>
            <p className="text-xs text-white/60">CRM · Marketing</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {item.to === '/tasks' && pendingCount > 0 && (
                <span className="rounded-md bg-violet-400/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
