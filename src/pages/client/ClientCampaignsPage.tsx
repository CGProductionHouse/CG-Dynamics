import { Navigate } from 'react-router-dom'

/**
 * Legacy compatibility only. Campaign reporting now lives inside Performance so
 * published-report, provider and client-isolation truth is loaded exactly once.
 */
export default function ClientCampaignsPage() {
  return <Navigate to="/client/performance?tab=google" replace />
}
