import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User, AuthError, PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getProfile, type Profile } from '../lib/db/profiles'
import { acceptInvite, validatePendingInvite } from '../lib/db/invites'

type AuthContextError = AuthError | PostgrestError | Error

interface AuthContextType {
  user: User | null
  profile: Profile | null
  profileError: string | null
  loading: boolean
  // True from the moment a Supabase password-recovery link is opened until the
  // password is updated (or the user signs out). While true, routing forces
  // the user to /reset-password instead of /admin or /dashboard.
  isPasswordRecovery: boolean
  endPasswordRecovery: () => void
  signIn: (email: string, password: string) => Promise<{ error: AuthContextError | null; role: string | null; pendingInviteSetup: boolean }>
  completeInvite: (password: string, fullName?: string) => Promise<{ error: AuthContextError | null; role: string | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

function appOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

const RECOVERY_KEY = 'cg_password_recovery'

// A recovery link (implicit flow) lands with #type=recovery in the URL hash.
function urlHasRecovery() {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash ?? ''
  const search = window.location.search ?? ''
  return hash.includes('type=recovery') || new URLSearchParams(search).get('type') === 'recovery'
}

function readRecoveryFlag() {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1'
  } catch {
    return false
  }
}

function persistRecoveryFlag(value: boolean) {
  try {
    if (value) sessionStorage.setItem(RECOVERY_KEY, '1')
    else sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // ignore storage failures
  }
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => readRecoveryFlag() || urlHasRecovery())
  const authRequestRef = useRef(0)
  // Tracks the currently-resolved user id and whether the first session lookup
  // has completed. Used to keep background auth events (token refresh on tab
  // focus, etc.) from re-gating the whole app behind the loading screen, which
  // would unmount the routed tree and wipe in-progress work.
  const userIdRef = useRef<string | null>(null)
  const initialResolvedRef = useRef(false)

  function markRecovery(value: boolean) {
    persistRecoveryFlag(value)
    setIsPasswordRecovery(value)
  }

  function endPasswordRecovery() {
    markRecovery(false)
  }

  async function fetchProfile(userId: string) {
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

    // `silent` updates user/profile without flipping the global loading flag,
    // so the routed tree (and any in-progress admin work) is never unmounted.
    async function applyUser(nextUser: User | null, options: { silent?: boolean } = {}) {
      if (!mounted) return
      const requestId = ++authRequestRef.current
      if (!options.silent) setLoading(true)
      setUser(nextUser)
      userIdRef.current = nextUser?.id ?? null
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
        if (mounted && requestId === authRequestRef.current) {
          setLoading(false)
          initialResolvedRef.current = true
        }
      }
    }

    void supabase.auth.getSession()
      .then(({ data }) => applyUser(data.session?.user ?? null))
      .catch(error => {
        if (!mounted) return
        setProfile(null)
        setProfileError(error instanceof Error ? error.message : 'Could not load your session.')
        setLoading(false)
        initialResolvedRef.current = true
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') markRecovery(true)
      const nextUser = session?.user ?? null

      // Background event for the SAME signed-in user (token refresh, tab focus,
      // USER_UPDATED). The Supabase client already manages the refreshed token
      // internally, so we just keep our user object fresh WITHOUT re-fetching
      // the profile or toggling loading — this is the key to not losing work.
      if (initialResolvedRef.current && nextUser?.id && nextUser.id === userIdRef.current) {
        setUser(nextUser)
        return
      }

      // A genuine change (sign in, sign out, different user). After the first
      // load, apply it silently so the app does not flash the loading screen
      // and unmount the current page.
      setTimeout(() => {
        void applyUser(nextUser, { silent: initialResolvedRef.current })
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) return { error, role: null, pendingInviteSetup: false }

    // A normal password sign-in ends any lingering recovery mode so the user
    // is not bounced back to /reset-password.
    markRecovery(false)

    // Load profile immediately so the caller can navigate by role without
    // waiting for the onAuthStateChange callback to fire.
    const requestId = ++authRequestRef.current
    setLoading(true)
    setUser(data.user)
    userIdRef.current = data.user.id
    try {
      const { profile: profileData, error: profileLoadError } = await fetchProfile(data.user.id)
      if (requestId === authRequestRef.current) {
        setProfile(profileData)
        setProfileError(profileLoadError?.message ?? null)
        setLoading(false)
        initialResolvedRef.current = true
      }
      return {
        error: profileLoadError,
        role: profileData?.role ?? null,
        pendingInviteSetup: Boolean(data.user.invited_at && profileData?.role === 'client' && !profileData.client_id),
      }
    } catch (error) {
      const profileLoadError = error instanceof Error
        ? error
        : new Error('Could not load your profile after sign in.')
      if (requestId === authRequestRef.current) {
        setProfile(null)
        setProfileError(profileLoadError.message)
        setLoading(false)
      }
      return { error: profileLoadError, role: null, pendingInviteSetup: false }
    }
  }

  async function completeInvite(password: string, fullName?: string) {
    const { error: validationError } = await validatePendingInvite()
    if (validationError) return { error: validationError, role: null }

    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password,
      data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
    })
    if (updateError) return { error: updateError, role: null }

    const { data: inviteData, error: inviteError } = await acceptInvite(fullName)
    if (inviteError || !inviteData) {
      return { error: inviteError ?? new Error('Could not complete this invitation.'), role: null }
    }

    const invitedUser = updateData.user
    const { data: profileData, error: profileLoadError } = await getProfile(invitedUser.id)
    if (profileLoadError || !profileData) {
      return { error: profileLoadError ?? new Error('Could not load your new profile.'), role: null }
    }

    setUser(invitedUser)
    userIdRef.current = invitedUser.id
    setProfile(profileData)
    setProfileError(null)
    setLoading(false)
    initialResolvedRef.current = true
    return { error: null, role: inviteData.role }
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

  async function signOut() {
    const requestId = ++authRequestRef.current
    setLoading(true)
    markRecovery(false)
    await supabase.auth.signOut()
    if (requestId !== authRequestRef.current) return
    setUser(null)
    setProfile(null)
    setProfileError(null)
    setLoading(false)
    userIdRef.current = null
  }

  return (
    <AuthContext.Provider value={{ user, profile, profileError, loading, isPasswordRecovery, endPasswordRecovery, signIn, completeInvite, resetPasswordForEmail, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- colocated with the provider by the existing auth API.
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
