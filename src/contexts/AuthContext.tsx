import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, AuthError, PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile, type Profile } from '../lib/db/profiles'
import { claimInvite } from '../lib/db/invites'

type AuthContextError = AuthError | PostgrestError | Error

interface AuthContextType {
  user: User | null
  profile: Profile | null
  profileError: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthContextError | null; role: string | null }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null; alreadyRegistered: boolean }>
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>
  resendConfirmation: (email: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

function appOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const authRequestRef = useRef(0)

  async function fetchProfile(userId: string) {
    // Auto-link any pending client invite for this account before we read
    // the profile, so an invited user lands on their dashboard immediately.
    // Safe no-op if there is no invite (or the phase-3f migration is unrun).
    await claimInvite().catch(() => {})
    const { data, error } = await getProfile(userId)
    if (error) {
      return { profile: null, error }
    }
    if (!data) {
      const missingProfileError = new Error('No profile was found for this account.')
      return { profile: null, error: missingProfileError }
    }
    return { profile: data, error: null }
  }

  useEffect(() => {
    let mounted = true

    async function applyUser(nextUser: User | null) {
      if (!mounted) return
      const requestId = ++authRequestRef.current
      setLoading(true)
      setUser(nextUser)
      try {
        if (nextUser) {
          const { profile: profileData, error } = await fetchProfile(nextUser.id)
          if (!mounted || requestId !== authRequestRef.current) return
          setProfile(profileData)
          setProfileError(error?.message ?? null)
        } else {
          if (!mounted || requestId !== authRequestRef.current) return
          setProfile(null)
          setProfileError(null)
        }
      } catch (error) {
        if (!mounted || requestId !== authRequestRef.current) return
        setProfile(null)
        setProfileError(error instanceof Error ? error.message : 'Could not load your profile.')
      } finally {
        if (mounted && requestId === authRequestRef.current) setLoading(false)
      }
    }

    void supabase.auth.getSession()
      .then(({ data }) => applyUser(data.session?.user ?? null))
      .catch(error => {
        if (!mounted) return
        setProfile(null)
        setProfileError(error instanceof Error ? error.message : 'Could not load your session.')
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        void applyUser(session?.user ?? null)
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { error, role: null }

    // Load profile immediately so the caller can navigate by role without
    // waiting for the onAuthStateChange callback to fire.
    const requestId = ++authRequestRef.current
    setLoading(true)
    setUser(data.user)
    try {
      const { profile: profileData, error: profileLoadError } = await fetchProfile(data.user.id)
      if (requestId === authRequestRef.current) {
        setProfile(profileData)
        setProfileError(profileLoadError?.message ?? null)
        setLoading(false)
      }
      return { error: profileLoadError, role: profileData?.role ?? null }
    } catch (error) {
      const profileLoadError = error instanceof Error
        ? error
        : new Error('Could not load your profile after sign in.')
      if (requestId === authRequestRef.current) {
        setProfile(null)
        setProfileError(profileLoadError.message)
        setLoading(false)
      }
      return { error: profileLoadError, role: null }
    }
  }

  async function signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${appOrigin()}/login`,
      },
    })
    // With email confirmations enabled, signing up an existing address returns
    // an obfuscated user with no identities (and no error) so we don't leak
    // which emails exist. Treat that as "already registered".
    const alreadyRegistered = !error && !!data.user && (data.user.identities?.length ?? 0) === 0
    return { error, alreadyRegistered }
  }

  async function resetPasswordForEmail(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appOrigin()}/reset-password`,
    })
    return { error }
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    return { error }
  }

  async function resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${appOrigin()}/login` },
    })
    return { error }
  }

  async function signOut() {
    const requestId = ++authRequestRef.current
    setLoading(true)
    await supabase.auth.signOut()
    if (requestId !== authRequestRef.current) return
    setUser(null)
    setProfile(null)
    setProfileError(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, profile, profileError, loading, signIn, signUp, resetPasswordForEmail, updatePassword, resendConfirmation, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
