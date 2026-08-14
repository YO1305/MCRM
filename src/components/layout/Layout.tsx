import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { TemplateMaterializer } from './TemplateMaterializer'
import { DevMaterializer } from './DevMaterializer'
import { SmmPaymentReminder } from './SmmPaymentReminder'
import { ClientVisitReminder } from './ClientVisitReminder'
import { AppUpdateBanner } from './AppUpdateBanner'
import { CrmConfigBootstrap } from './CrmConfigBootstrap'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-full bg-background">
      <CrmConfigBootstrap />
      <TemplateMaterializer />
      <DevMaterializer />
      <SmmPaymentReminder />
      <ClientVisitReminder />
      <AppUpdateBanner />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 pb-24 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
