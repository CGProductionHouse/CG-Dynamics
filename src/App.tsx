import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/AuthContext'
import { RequireStaff } from './components/guards/RequireStaff'
import { RequireAdmin } from './components/guards/RequireAdmin'
import { RequireClient } from './components/guards/RequireClient'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AdminLayout from './pages/admin/AdminLayout'
import ClientsList from './pages/admin/ClientsList'
import UsersAdmin from './pages/admin/UsersAdmin'
import Dashboard from './pages/client/Dashboard'

function HomeRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-brand-bg" />
  if (!user) return <Navigate to="/login" replace />
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

          {/* Staff routes */}
          <Route element={<RequireStaff />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<ClientsList />} />

              {/* Admin-only routes nested inside AdminLayout */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin/users" element={<UsersAdmin />} />
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
