import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile, type Profile } from '../lib/db/profiles'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; role: string | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // INITIAL_SESSION fires immediately with the current session (or null).
    // Subsequent SIGNED_IN / SIGNED_OUT events keep state in sync.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          const { data } = await getProfile(u.id)
          setProfile(data)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { error, role: null }

    // Load profile immediately so the caller can navigate by role without
    // waiting for the onAuthStateChange callback to fire.
    const { data: profileData } = await getProfile(data.user.id)
    setUser(data.user)
    setProfile(profileData)
    return { error: null, role: profileData?.role ?? 'client' }
  }

  async function signUp(email: string, password: string, fullName?: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
