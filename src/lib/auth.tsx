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
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function useAuth() {
  return useContext(Ctx)
}

/** Создаёт строку профиля при первом входе (в т.ч. после Google-OAuth) */
async function ensureProfile(uid: string, email: string, name?: string) {
  const { data } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle()
  if (!data) {
    await supabase.from('profiles').insert({
      id: uid,
      email,
      displayName: name || email.split('@')[0],
      role: 'user',
    })
  }
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
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ? { uid: session.user.id, email: session.user.email || '' } : null
      setUser(u)
      // после OAuth-редиректа гарантируем профиль
      if (event === 'SIGNED_IN' && session?.user) {
        await ensureProfile(
          session.user.id,
          session.user.email || '',
          (session.user.user_metadata?.full_name as string) || undefined,
        ).catch(() => {})
      }
      loadProfile(u?.uid || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthCtx = {
    user,
    profile,
    loading,
    /**
     * Отправка кода: сначала своя edge-функция (Brevo, без лимитов встроенной почты),
     * при её недоступности/отсутствии ключа — встроенная почта Supabase.
     */
    async sendCode(email) {
      const clean = email.trim().toLowerCase()
      let fallback = false
      try {
        const { data, error } = await supabase.functions.invoke('otp-mailer', { body: { email: clean } })
        if (error) fallback = true
        else if (data?.error === 'too_often' || data?.error === 'daily_limit') throw new Error('too_often')
        else if (data?.error) fallback = true
        else if (data?.fallback) fallback = true
      } catch (e) {
        if ((e as Error).message === 'too_often') throw e
        fallback = true
      }
      if (fallback) {
        const { error } = await supabase.auth.signInWithOtp({
          email: clean,
          options: { shouldCreateUser: true },
        })
        if (error) throw new Error(error.message)
      }
    },
    async verifyCode(email, code) {
      const clean = email.trim().toLowerCase()
      const { data, error } = await supabase.auth.verifyOtp({
        email: clean,
        token: code.trim(),
        type: 'email',
      })
      if (error || !data.user) throw new Error(error?.message || 'verify failed')
      await ensureProfile(data.user.id, clean)
      await loadProfile(data.user.id)
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw new Error(error.message)
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
