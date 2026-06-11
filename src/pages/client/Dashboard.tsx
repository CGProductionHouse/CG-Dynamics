import { useAuth } from '../../contexts/AuthContext'

export default function Dashboard() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center px-4 text-center">
      <div className="bg-brand-surface border border-brand-muted rounded-2xl p-10 max-w-md w-full shadow-[0_0_40px_rgba(45,212,191,0.08)]">
        <h1 className="text-2xl font-bold text-brand-accent mb-2">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-brand-primary text-sm mb-8">
          {profile?.client_id
            ? 'Your reports will appear here once published by your account manager.'
            : 'Your account is pending setup. Contact your account manager to get access.'}
        </p>
        <button
          onClick={signOut}
          className="text-sm text-brand-primary hover:text-brand-accent transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
