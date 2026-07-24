import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { UserProfile } from './types'

/** Минимальный пользователь приложения (uid = auth.users.id) */
export interface AppUser {
  uid: string
  email: string
}

interface AuthCtx {
  user: AppUser | null
  profile: UserProfile | null
  loading: boolean
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function useAuth() {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(uid: string | null) {
    if (!uid) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as UserProfile) || null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ? { uid: session.user.id, email: session.user.email || '' } : null
      setUser(u)
      loadProfile(u?.uid || null).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? { uid: session.user.id, email: session.user.email || '' } : null
      setUser(u)
      loadProfile(u?.uid || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  /** Создаёт строку профиля при первом входе */
  async function ensureProfile(uid: string, email: string) {
    const { data } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle()
    if (!data) {
      await supabase.from('profiles').insert({
        id: uid,
        email,
        displayName: email.split('@')[0],
        role: 'user',
      })
    }
  }

  const value: AuthCtx = {
    user,
    profile,
    loading,
    async sendCode(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      })
      if (error) throw new Error(error.message)
    },
    async verifyCode(email, code) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email',
      })
      if (error || !data.user) throw new Error(error?.message || 'verify failed')
      await ensureProfile(data.user.id, email.trim().toLowerCase())
      await loadProfile(data.user.id)
    },
    async signOut() {
      await supabase.auth.signOut()
    },
    async refreshProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      await loadProfile(session?.user?.id || null)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
