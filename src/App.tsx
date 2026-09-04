import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { PrivateRoute } from '@/components/layout/PrivateRoute'
import { SectionRoute } from '@/components/layout/SectionRoute'
import { Login } from '@/pages/Login'

const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Tasks = lazy(() => import('@/pages/Tasks').then((m) => ({ default: m.Tasks })))
const CRM = lazy(() => import('@/pages/CRM').then((m) => ({ default: m.CRM })))
const Contacts = lazy(() => import('@/pages/Contacts').then((m) => ({ default: m.Contacts })))
const KPI = lazy(() => import('@/pages/KPI').then((m) => ({ default: m.KPI })))
const DesignRequests = lazy(() =>
  import('@/pages/DesignRequests').then((m) => ({ default: m.DesignRequests })),
)
const Showroom = lazy(() => import('@/pages/Showroom').then((m) => ({ default: m.Showroom })))
const Labels = lazy(() => import('@/pages/Labels').then((m) => ({ default: m.Labels })))
const Smm = lazy(() => import('@/pages/Smm').then((m) => ({ default: m.Smm })))
const SmmPayments = lazy(() =>
  import('@/pages/SmmPayments').then((m) => ({ default: m.SmmPayments })),
)
const Projects = lazy(() => import('@/pages/Projects').then((m) => ({ default: m.Projects })))
const Subtasks = lazy(() => import('@/pages/Subtasks').then((m) => ({ default: m.Subtasks })))
const Analytics = lazy(() => import('@/pages/Analytics').then((m) => ({ default: m.Analytics })))
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })))
const Requests = lazy(() => import('@/pages/Requests').then((m) => ({ default: m.Requests })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))
const AiSettings = lazy(() =>
  import('@/pages/settings/AiSettings').then((m) => ({ default: m.AiSettings })),
)
const Catalogue = lazy(() => import('@/pages/Catalogue').then((m) => ({ default: m.Catalogue })))
const PublicCatalogue = lazy(() =>
  import('@/pages/PublicCatalogue').then((m) => ({ default: m.PublicCatalogue })),
)
const PublicAnalytics = lazy(() =>
  import('@/pages/PublicAnalytics').then((m) => ({ default: m.PublicAnalytics })),
)

function PageFallback() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/c/:slug" element={<PublicCatalogue />} />
            <Route path="/a/:id" element={<PublicAnalytics />} />

            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route element={<SectionRoute section="dashboard" />}>
                  <Route path="/" element={<Dashboard />} />
                </Route>

                <Route element={<SectionRoute section="tasks" />}>
                  <Route path="/tasks" element={<Tasks />} />
                </Route>

                <Route element={<SectionRoute section="reports" />}>
                  <Route path="/reports" element={<Reports />} />
                </Route>

                <Route element={<SectionRoute section="crm" />}>
                  <Route path="/crm" element={<CRM />} />
                </Route>

                <Route element={<SectionRoute section="contacts" />}>
                  <Route path="/contacts" element={<Contacts />} />
                </Route>

                <Route element={<SectionRoute section="kpi" />}>
                  <Route path="/kpi" element={<KPI />} />
                </Route>

                <Route element={<SectionRoute section="design" />}>
                  <Route path="/design" element={<DesignRequests />} />
                </Route>

                <Route element={<SectionRoute section="catalogue" />}>
                  <Route path="/catalogue" element={<Catalogue />} />
                </Route>

                <Route element={<SectionRoute section="showroom" />}>
                  <Route path="/showroom" element={<Showroom />} />
                </Route>

                <Route element={<SectionRoute section="labels" />}>
                  <Route path="/labels" element={<Labels />} />
                </Route>

                <Route element={<SectionRoute section="smm" />}>
                  <Route path="/smm" element={<Smm />} />
                </Route>

                <Route element={<SectionRoute section="smm_payments" />}>
                  <Route path="/smm-payments" element={<SmmPayments />} />
                </Route>

                <Route element={<SectionRoute section="projects" />}>
                  <Route path="/projects" element={<Projects />} />
                </Route>

                <Route element={<SectionRoute section="milestones" />}>
                  <Route path="/subtasks" element={<Subtasks />} />
                  <Route path="/development" element={<Navigate to="/subtasks" replace />} />
                  <Route path="/milestones" element={<Navigate to="/subtasks" replace />} />
                </Route>

                <Route element={<SectionRoute section="analytics" />}>
                  <Route path="/analytics" element={<Analytics />} />
                </Route>

                <Route element={<SectionRoute section="requests" />}>
                  <Route path="/requests" element={<Requests />} />
                </Route>

                <Route element={<SectionRoute section="settings" />}>
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/ai" element={<AiSettings />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
