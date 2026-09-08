import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { RequireStaff } from './components/guards/RequireStaff'
import { RequireAdmin } from './components/guards/RequireAdmin'
import { RequireManager } from './components/guards/RequireManager'
import { RequireClient } from './components/guards/RequireClient'
import AdminLayout from './pages/admin/AdminLayout'
import { RouteLoadBoundary } from './components/RouteLoadBoundary'
import { lazyRoute } from './lib/lazyRoute'

const LandingPage = lazyRoute(() => import('./pages/LandingPage'))
const Login = lazyRoute(() => import('./pages/Login'))
const Signup = lazyRoute(() => import('./pages/Signup'))
const ForgotPassword = lazyRoute(() => import('./pages/ForgotPassword'))
const ResetPassword = lazyRoute(() => import('./pages/ResetPassword'))
const PrivacyPolicyPage = lazyRoute(() => import('./pages/LegalPage').then(module => ({ default: module.PrivacyPolicyPage })))
const TermsOfServicePage = lazyRoute(() => import('./pages/LegalPage').then(module => ({ default: module.TermsOfServicePage })))
const ClientPerformancePage = lazyRoute(() => import('./pages/admin/ClientPerformancePage'))
const CgHubPage = lazyRoute(() => import('./pages/admin/CgHubPage'))
const ClientsList = lazyRoute(() => import('./pages/admin/ClientsList'))
const ImportMetaCsv = lazyRoute(() => import('./pages/admin/ImportMetaCsv'))
const ImportsManagement = lazyRoute(() => import('./pages/admin/ImportsManagement'))
const ImportHub = lazyRoute(() => import('./pages/admin/ImportHub'))
const UsersHub = lazyRoute(() => import('./pages/admin/UsersHub'))
const NewReport = lazyRoute(() => import('./pages/admin/NewReport'))
const ReportsManagement = lazyRoute(() => import('./pages/admin/ReportsManagement'))
const ManualMetricsAdmin = lazyRoute(() => import('./pages/admin/ManualMetricsAdmin'))
const ContentReviewsPage = lazyRoute(() => import('./pages/admin/ContentReviewsPage'))
const ContentOperationsPage = lazyRoute(() => import('./pages/admin/ContentOperationsPage'))
const PublishedPreview = lazyRoute(() => import('./pages/admin/PublishedPreview'))
const IntegrationsPage = lazyRoute(() => import('./pages/admin/IntegrationsPage'))
const MetaIntegrationPage = lazyRoute(() => import('./pages/admin/MetaIntegrationPage'))
const GoogleAdsIntegrationPage = lazyRoute(() => import('./pages/admin/GoogleAdsIntegrationPage'))
const TikTokIntegrationPage = lazyRoute(() => import('./pages/admin/TikTokIntegrationPage'))
const AssistantPage = lazyRoute(() => import('./pages/admin/AssistantPage'))
const MyAssistantPage = lazyRoute(() => import('./pages/admin/MyAssistantPage'))
const PackageMasterPage = lazyRoute(() => import('./pages/admin/PackageMasterPage'))
const ClientSchedulePage = lazyRoute(() => import('./pages/admin/ClientSchedulePage'))
const ClientContentCalendarPage = lazyRoute(() => import('./pages/admin/ClientContentCalendarPage'))
const PlannerImportPage = lazyRoute(() => import('./pages/admin/PlannerImportPage'))
const ImportHealthPage = lazyRoute(() => import('./pages/admin/ImportHealthPage'))
const AiUsageHealthPage = lazyRoute(() => import('./pages/admin/AiUsageHealthPage'))
const CompanyCalendarPage = lazyRoute(() => import('./pages/admin/CompanyCalendarPage'))
const MicrosoftImportPage = lazyRoute(() => import('./pages/admin/MicrosoftImportPage'))
const MarketingLibraryPage = lazyRoute(() => import('./pages/admin/MarketingLibraryPage'))
const MarketingAiDepartmentPage = lazyRoute(() => import('./pages/admin/MarketingAiDepartmentPage'))
const MarketingWorkspacePage = lazyRoute(() => import('./pages/admin/MarketingWorkspacePage'))
const SystemHubPage = lazyRoute(() => import('./pages/admin/SystemHubPage'))
const SkillCardReviewPage = lazyRoute(() => import('./pages/admin/SkillCardReviewPage'))
const ContentWorkflowPage = lazyRoute(() => import('./pages/admin/ContentWorkflowPage'))
const MyWorkPage = lazyRoute(() => import('./pages/admin/MyWorkPage'))
const CommandCentrePage = lazyRoute(() => import('./pages/admin/CommandCentrePage'))
const OpsHubPage = lazyRoute(() => import('./pages/admin/OpsHubPage'))
const Dashboard = lazyRoute(() => import('./pages/client/Dashboard'))
const ClientPortalHome = lazyRoute(() => import('./pages/client/ClientPortalHome'))
const ClientCampaignsPage = lazyRoute(() => import('./pages/client/ClientCampaignsPage'))
const ClientPortalCalendarPage = lazyRoute(() => import('./pages/client/ClientContentCalendarPage'))
const ClientContentGuidesPage = lazyRoute(() => import('./pages/client/ClientContentGuidesPage'))
const ClientStrategyPage = lazyRoute(() => import('./pages/client/ClientStrategyPage'))
const WelcomeToCgPage = lazyRoute(() => import('./features/client-onboarding/WelcomeToCgPage'))
const ClientSetupPage = lazyRoute(() => import('./features/client-onboarding/ClientSetupPage'))
const InternalOnboardingPage = lazyRoute(() => import('./features/client-onboarding/InternalOnboardingPage'))

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
        <RouteLoadBoundary>
          <Suspense fallback={<div className="min-h-screen bg-brand-bg" aria-label="Opening CG Dynamics" />}>
            <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
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
              <Route path="/admin/my-assistant" element={<MyAssistantPage />} />
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
                <Route path="/admin/integrations/tiktok" element={<TikTokIntegrationPage />} />
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
        </RouteLoadBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
