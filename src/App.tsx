import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { PrivateRoute } from '@/components/layout/PrivateRoute'
import { SectionRoute } from '@/components/layout/SectionRoute'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Tasks } from '@/pages/Tasks'
import { CRM } from '@/pages/CRM'
import { Contacts } from '@/pages/Contacts'
import { KPI } from '@/pages/KPI'
import { DesignRequests } from '@/pages/DesignRequests'
import { Showroom } from '@/pages/Showroom'
import { Labels } from '@/pages/Labels'
import { Smm } from '@/pages/Smm'
import { SmmPayments } from '@/pages/SmmPayments'
import { Projects } from '@/pages/Projects'
import { Subtasks } from '@/pages/Subtasks'
import { Analytics } from '@/pages/Analytics'
import { Reports } from '@/pages/Reports'
import { Requests } from '@/pages/Requests'
import { Settings } from '@/pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

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
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
