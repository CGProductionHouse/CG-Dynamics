import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { RequireStaff } from './components/guards/RequireStaff'
import { RequireAdmin } from './components/guards/RequireAdmin'
import { RequireManager } from './components/guards/RequireManager'
import { RequireClient } from './components/guards/RequireClient'
import AdminLayout from './pages/admin/AdminLayout'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const ClientPerformancePage = lazy(() => import('./pages/admin/ClientPerformancePage'))
const CgHubPage = lazy(() => import('./pages/admin/CgHubPage'))
const ClientsList = lazy(() => import('./pages/admin/ClientsList'))
const ImportMetaCsv = lazy(() => import('./pages/admin/ImportMetaCsv'))
const ImportsManagement = lazy(() => import('./pages/admin/ImportsManagement'))
const ImportHub = lazy(() => import('./pages/admin/ImportHub'))
const UsersHub = lazy(() => import('./pages/admin/UsersHub'))
const NewReport = lazy(() => import('./pages/admin/NewReport'))
const ReportsManagement = lazy(() => import('./pages/admin/ReportsManagement'))
const ManualMetricsAdmin = lazy(() => import('./pages/admin/ManualMetricsAdmin'))
const ContentReviewsPage = lazy(() => import('./pages/admin/ContentReviewsPage'))
const ContentOperationsPage = lazy(() => import('./pages/admin/ContentOperationsPage'))
const PublishedPreview = lazy(() => import('./pages/admin/PublishedPreview'))
const IntegrationsPage = lazy(() => import('./pages/admin/IntegrationsPage'))
const MetaIntegrationPage = lazy(() => import('./pages/admin/MetaIntegrationPage'))
const GoogleAdsIntegrationPage = lazy(() => import('./pages/admin/GoogleAdsIntegrationPage'))
const AssistantPage = lazy(() => import('./pages/admin/AssistantPage'))
const PackageMasterPage = lazy(() => import('./pages/admin/PackageMasterPage'))
const ClientSchedulePage = lazy(() => import('./pages/admin/ClientSchedulePage'))
const ClientContentCalendarPage = lazy(() => import('./pages/admin/ClientContentCalendarPage'))
const PlannerImportPage = lazy(() => import('./pages/admin/PlannerImportPage'))
const ImportHealthPage = lazy(() => import('./pages/admin/ImportHealthPage'))
const AiUsageHealthPage = lazy(() => import('./pages/admin/AiUsageHealthPage'))
const CompanyCalendarPage = lazy(() => import('./pages/admin/CompanyCalendarPage'))
const MicrosoftImportPage = lazy(() => import('./pages/admin/MicrosoftImportPage'))
const MarketingLibraryPage = lazy(() => import('./pages/admin/MarketingLibraryPage'))
const MarketingAiDepartmentPage = lazy(() => import('./pages/admin/MarketingAiDepartmentPage'))
const MarketingWorkspacePage = lazy(() => import('./pages/admin/MarketingWorkspacePage'))
const SystemHubPage = lazy(() => import('./pages/admin/SystemHubPage'))
const SkillCardReviewPage = lazy(() => import('./pages/admin/SkillCardReviewPage'))
const ContentWorkflowPage = lazy(() => import('./pages/admin/ContentWorkflowPage'))
const MyWorkPage = lazy(() => import('./pages/admin/MyWorkPage'))
const CommandCentrePage = lazy(() => import('./pages/admin/CommandCentrePage'))
const OpsHubPage = lazy(() => import('./pages/admin/OpsHubPage'))
const Dashboard = lazy(() => import('./pages/client/Dashboard'))
const ClientPortalHome = lazy(() => import('./pages/client/ClientPortalHome'))
const ClientCampaignsPage = lazy(() => import('./pages/client/ClientCampaignsPage'))
const ClientPortalCalendarPage = lazy(() => import('./pages/client/ClientContentCalendarPage'))
const ClientContentGuidesPage = lazy(() => import('./pages/client/ClientContentGuidesPage'))
const ClientStrategyPage = lazy(() => import('./pages/client/ClientStrategyPage'))
const WelcomeToCgPage = lazy(() => import('./features/client-onboarding/WelcomeToCgPage'))
const ClientSetupPage = lazy(() => import('./features/client-onboarding/ClientSetupPage'))
const InternalOnboardingPage = lazy(() => import('./features/client-onboarding/InternalOnboardingPage'))

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
  if (profile.role === 'client') return <Navigate to="/client" replace />
  return <Navigate to="/admin/cg-hub" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-brand-bg" aria-label="Opening CG Dynamics" />}>
          <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/welcome" element={<WelcomeToCgPage />} />

          {/* Staff routes */}
          <Route element={<RequireStaff />}>
            <Route element={<AdminLayout />}>
              {/* Read access for all staff (admin + team) */}
              <Route path="/admin" element={<Navigate to="/admin/cg-hub" replace />} />
              <Route path="/admin/client-performance" element={<ClientPerformancePage />} />
              <Route path="/admin/cg-hub" element={<CgHubPage />} />
              <Route path="/admin/ops-hub" element={<OpsHubPage />} />
              <Route path="/admin/work" element={<MyWorkPage />} />
              <Route path="/admin/my-work" element={<MyWorkPage />} />
              <Route path="/admin/my-day" element={<Navigate to="/admin/work?tab=my-day" replace />} />
              <Route path="/admin/command-centre" element={<CommandCentrePage />} />
              <Route path="/admin/planner" element={<Navigate to="/admin/work?tab=board" replace />} />
              <Route path="/admin/package-master" element={<PackageMasterPage />} />
              <Route path="/admin/client-schedule" element={<ClientSchedulePage />} />
              <Route path="/admin/content-reviews" element={<ContentReviewsPage />} />
              <Route path="/admin/content-ops" element={<ContentOperationsPage />} />
              <Route path="/admin/content" element={<ContentWorkflowPage defaultTab="overview" />} />
              <Route path="/admin/content-workflow" element={<ContentWorkflowPage defaultTab="guidelines" />} />
              <Route path="/admin/full-content-guide" element={<ContentWorkflowPage defaultTab="guidelines" />} />
              <Route path="/admin/client-calendar" element={<ClientContentCalendarPage />} />
              <Route path="/admin/monthly-planner" element={<Navigate to="/admin/client-schedule?view=calendar" replace />} />
              <Route path="/admin/master-schedule" element={<Navigate to="/admin/client-schedule?view=year" replace />} />
              <Route path="/admin/clients" element={<ClientsList />} />
              <Route path="/admin/reports" element={<ReportsManagement />} />
              <Route path="/admin/assistant" element={<AssistantPage />} />
              <Route path="/admin/client-dashboard" element={<PublishedPreview />} />
              <Route path="/admin/published" element={<PublishedPreview />} />
              <Route path="/admin/content-guide-preview" element={<ClientContentGuidesPage preview />} />
              <Route path="/admin/cg-calendar" element={<CompanyCalendarPage />} />
              <Route path="/admin/company-calendar" element={<Navigate to="/admin/cg-calendar" replace />} />
              {/* Marketing/Knowledge workspace — staff may search approved shared
                  knowledge; sources/review/registration sections are admin-scoped
                  in-page and by RLS. */}
              <Route path="/admin/marketing" element={<MarketingWorkspacePage />} />

              {/* Consolidated Import workspace (CSV import is admin-gated inside
                  the hub; manual summaries + history are staff read-only). */}
              <Route path="/admin/import" element={<ImportHub />} />
              {/* Legacy deep links kept working. */}
              <Route path="/admin/imports" element={<ImportsManagement />} />
              <Route path="/admin/manual-metrics" element={<ManualMetricsAdmin />} />

              {/* Manager/admin operational write routes nested inside AdminLayout */}
              <Route element={<RequireManager />}>
                <Route path="/admin/integrations" element={<IntegrationsPage />} />
                <Route path="/admin/integrations/meta" element={<MetaIntegrationPage />} />
                <Route path="/admin/integrations/google-ads" element={<GoogleAdsIntegrationPage />} />
                <Route path="/admin/import-csv" element={<ImportMetaCsv />} />
                <Route path="/admin/reports/new" element={<NewReport />} />
                <Route path="/admin/reports/:reportId/edit" element={<NewReport />} />
                <Route path="/admin/planner-import" element={<PlannerImportPage />} />
                {/* Marketing AI is a manager-usable workspace: managers and
                    admins may run specialists against approved knowledge. Source
                    administration, review and card governance stay admin-only
                    (their own routes below and the admin-scoped workspace
                    sections). */}
                <Route path="/admin/marketing-ai" element={<MarketingAiDepartmentPage />} />
                <Route path="/admin/client-onboarding" element={<InternalOnboardingPage />} />
              </Route>

              {/* Admin-only security/setup routes nested inside AdminLayout */}
              <Route element={<RequireAdmin />}>
                {/* System — grouped admin diagnostics (health tools), out of
                    daily navigation. */}
                <Route path="/admin/system" element={<SystemHubPage />} />
                <Route path="/admin/users" element={<UsersHub />} />
                <Route path="/admin/team" element={<UsersHub />} />
                <Route path="/admin/invites" element={<Navigate to="/admin/users?tab=invites" replace />} />
                <Route path="/admin/import-health" element={<ImportHealthPage />} />
                <Route path="/admin/ai-health" element={<AiUsageHealthPage />} />
                <Route path="/admin/microsoft-import" element={<MicrosoftImportPage />} />
                <Route path="/admin/marketing-library" element={<MarketingLibraryPage />} />
                <Route path="/admin/skill-card-review" element={<SkillCardReviewPage />} />
              </Route>
            </Route>
          </Route>

          {/* Client routes */}
          <Route element={<RequireClient />}>
            <Route path="/client" element={<ClientPortalHome />} />
            <Route path="/client/performance" element={<Dashboard />} />
            <Route path="/client/campaigns" element={<ClientCampaignsPage />} />
            <Route path="/client/content-calendar" element={<ClientPortalCalendarPage />} />
            <Route path="/client/approvals" element={<ContentReviewsPage clientView />} />
            <Route path="/client/content-guides" element={<ClientContentGuidesPage />} />
            <Route path="/client/strategy" element={<ClientStrategyPage />} />
            <Route path="/client/setup" element={<ClientSetupPage />} />
            <Route path="/dashboard" element={<Navigate to="/client" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
