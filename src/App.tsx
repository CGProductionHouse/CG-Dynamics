import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { RequireStaff } from './components/guards/RequireStaff'
import { RequireAdmin } from './components/guards/RequireAdmin'
import { RequireManager } from './components/guards/RequireManager'
import { RequireClient } from './components/guards/RequireClient'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AdminLayout from './pages/admin/AdminLayout'
import ClientPerformancePage from './pages/admin/ClientPerformancePage'
import CgHubPage from './pages/admin/CgHubPage'
import ClientsList from './pages/admin/ClientsList'
import ImportMetaCsv from './pages/admin/ImportMetaCsv'
import ImportsManagement from './pages/admin/ImportsManagement'
import ImportHub from './pages/admin/ImportHub'
import UsersHub from './pages/admin/UsersHub'
import NewReport from './pages/admin/NewReport'
import ReportsManagement from './pages/admin/ReportsManagement'
import ManualMetricsAdmin from './pages/admin/ManualMetricsAdmin'
import PublishedPreview from './pages/admin/PublishedPreview'
import IntegrationsPage from './pages/admin/IntegrationsPage'
import MetaIntegrationPage from './pages/admin/MetaIntegrationPage'
import GoogleAdsIntegrationPage from './pages/admin/GoogleAdsIntegrationPage'
import AssistantPage from './pages/admin/AssistantPage'
import PlannerPage from './pages/admin/PlannerPage'
import PackageMasterPage from './pages/admin/PackageMasterPage'
import ClientSchedulePage from './pages/admin/ClientSchedulePage'
import ClientContentCalendarPage from './pages/admin/ClientContentCalendarPage'
import PlannerImportPage from './pages/admin/PlannerImportPage'
import ImportHealthPage from './pages/admin/ImportHealthPage'
import CompanyCalendarPage from './pages/admin/CompanyCalendarPage'
import MicrosoftImportPage from './pages/admin/MicrosoftImportPage'
import MarketingLibraryPage from './pages/admin/MarketingLibraryPage'
import ContentWorkflowPage from './pages/admin/ContentWorkflowPage'
import MyWorkPage from './pages/admin/MyWorkPage'
import Dashboard from './pages/client/Dashboard'

function HomeRedirect() {
  const { user, profile, profileError, loading, isPasswordRecovery } = useAuth()
  if (loading) return <div className="min-h-screen bg-brand-bg" />
  if (isPasswordRecovery) return <Navigate to="/reset-password" replace />
  if (!user) return <Navigate to="/login" replace />
  if (profileError) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          Could not load your profile: {profileError}
        </p>
      </div>
    )
  }
  if (!profile) return <div className="min-h-screen bg-brand-bg" />
  if (user.invited_at && profile.role === 'client' && !profile.client_id) {
    return <Navigate to="/signup" replace />
  }
  if (profile.role === 'client') return <Navigate to="/dashboard" replace />
  return <Navigate to="/admin/cg-hub" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Staff routes */}
          <Route element={<RequireStaff />}>
            <Route element={<AdminLayout />}>
              {/* Read access for all staff (admin + team) */}
              <Route path="/admin" element={<Navigate to="/admin/cg-hub" replace />} />
              <Route path="/admin/client-performance" element={<ClientPerformancePage />} />
              <Route path="/admin/cg-hub" element={<CgHubPage />} />
              <Route path="/admin/my-work" element={<MyWorkPage />} />
              <Route path="/admin/my-day" element={<Navigate to="/admin/my-work?tab=my-day" replace />} />
              <Route path="/admin/command-centre" element={<Navigate to="/admin/my-work?tab=daily-tasks" replace />} />
              <Route path="/admin/planner" element={<PlannerPage />} />
              <Route path="/admin/package-master" element={<PackageMasterPage />} />
              <Route path="/admin/client-schedule" element={<ClientSchedulePage />} />
              <Route path="/admin/content-workflow" element={<ContentWorkflowPage />} />
              <Route path="/admin/client-calendar" element={<ClientContentCalendarPage />} />
              <Route path="/admin/monthly-planner" element={<Navigate to="/admin/client-schedule?view=calendar" replace />} />
              <Route path="/admin/master-schedule" element={<Navigate to="/admin/client-schedule?view=year" replace />} />
              <Route path="/admin/clients" element={<ClientsList />} />
              <Route path="/admin/reports" element={<ReportsManagement />} />
              <Route path="/admin/assistant" element={<AssistantPage />} />
              <Route path="/admin/client-dashboard" element={<PublishedPreview />} />
              <Route path="/admin/published" element={<PublishedPreview />} />
              <Route path="/admin/integrations" element={<IntegrationsPage />} />
              <Route path="/admin/integrations/meta" element={<MetaIntegrationPage />} />
              <Route path="/admin/cg-calendar" element={<CompanyCalendarPage />} />
              <Route path="/admin/company-calendar" element={<Navigate to="/admin/cg-calendar" replace />} />

              {/* Consolidated Import workspace (CSV import is admin-gated inside
                  the hub; manual summaries + history are staff read-only). */}
              <Route path="/admin/import" element={<ImportHub />} />
              {/* Legacy deep links kept working. */}
              <Route path="/admin/imports" element={<ImportsManagement />} />
              <Route path="/admin/manual-metrics" element={<ManualMetricsAdmin />} />

              {/* Manager/admin operational write routes nested inside AdminLayout */}
              <Route element={<RequireManager />}>
                <Route path="/admin/integrations/google-ads" element={<GoogleAdsIntegrationPage />} />
                <Route path="/admin/import-csv" element={<ImportMetaCsv />} />
                <Route path="/admin/reports/new" element={<NewReport />} />
                <Route path="/admin/reports/:reportId/edit" element={<NewReport />} />
                <Route path="/admin/planner-import" element={<PlannerImportPage />} />
              </Route>

              {/* Admin-only security/setup routes nested inside AdminLayout */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin/users" element={<UsersHub />} />
                <Route path="/admin/team" element={<UsersHub />} />
                <Route path="/admin/invites" element={<Navigate to="/admin/team?tab=invites" replace />} />
                <Route path="/admin/import-health" element={<ImportHealthPage />} />
                <Route path="/admin/microsoft-import" element={<MicrosoftImportPage />} />
                <Route path="/admin/marketing-library" element={<MarketingLibraryPage />} />
              </Route>
            </Route>
          </Route>

          {/* Client routes */}
          <Route element={<RequireClient />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
