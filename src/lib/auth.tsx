import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithCustomToken, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, ENGINE_URL } from './firebase'
import type { UserProfile } from './types'

interface AuthCtx {
  user: User | null
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

async function engine(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `engine ${res.status}`)
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(u: User | null) {
    if (!u) {
      setProfile(null)
      return
    }
    const snap = await getDoc(doc(db, 'users', u.uid))
    if (snap.exists()) setProfile(snap.data() as UserProfile)
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      await loadProfile(u).catch(() => {})
      setLoading(false)
    })
  }, [])

  const value: AuthCtx = {
    user,
    profile,
    loading,
    async sendCode(email) {
      await engine('/auth/send-code', { email: email.trim().toLowerCase() })
    },
    async verifyCode(email, code) {
      const { token } = await engine('/auth/verify', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      })
      const cred = await signInWithCustomToken(auth, token)
      // создаём/обновляем профиль при первом входе
      const ref = doc(db, 'users', cred.user.uid)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, {
          uid: cred.user.uid,
          email: email.trim().toLowerCase(),
          displayName: email.split('@')[0],
          role: 'user',
          createdAt: serverTimestamp(),
        })
      }
      await loadProfile(cred.user)
    },
    async signOut() {
      await fbSignOut(auth)
    },
    async refreshProfile() {
      await loadProfile(auth.currentUser)
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
