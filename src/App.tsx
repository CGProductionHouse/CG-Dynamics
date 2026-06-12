import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { RequireStaff } from './components/guards/RequireStaff'
import { RequireAdmin } from './components/guards/RequireAdmin'
import { RequireClient } from './components/guards/RequireClient'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import AdminLayout from './pages/admin/AdminLayout'
import ClientsList from './pages/admin/ClientsList'
import UsersAdmin from './pages/admin/UsersAdmin'
import InvitesAdmin from './pages/admin/InvitesAdmin'
import ImportMetaCsv from './pages/admin/ImportMetaCsv'
import ImportsManagement from './pages/admin/ImportsManagement'
import NewReport from './pages/admin/NewReport'
import ReportsManagement from './pages/admin/ReportsManagement'
import ManualMetricsAdmin from './pages/admin/ManualMetricsAdmin'
import PublishedPreview from './pages/admin/PublishedPreview'
import Dashboard from './pages/client/Dashboard'

function HomeRedirect() {
  const { user, profile, profileError, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-brand-bg" />
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
  if (profile.role === 'client') return <Navigate to="/dashboard" replace />
  return <Navigate to="/admin" replace />
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
              <Route path="/admin" element={<ClientsList />} />
              <Route path="/admin/imports" element={<ImportsManagement />} />
              <Route path="/admin/reports" element={<ReportsManagement />} />
              <Route path="/admin/manual-metrics" element={<ManualMetricsAdmin />} />
              <Route path="/admin/published" element={<PublishedPreview />} />

              {/* Admin-only write routes nested inside AdminLayout */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin/import" element={<ImportMetaCsv />} />
                <Route path="/admin/reports/new" element={<NewReport />} />
                <Route path="/admin/reports/:reportId/edit" element={<NewReport />} />
                <Route path="/admin/users" element={<UsersAdmin />} />
                <Route path="/admin/invites" element={<InvitesAdmin />} />
              </Route>
            </Route>
          </Route>

          {/* Client routes */}
          <Route element={<RequireClient />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
