import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { fetchFavoriteIds, setFavorite } from './db'

interface FavCtx {
  ids: Set<string>
  has: (id: string) => boolean
  /** true — переключил; false — нужен вход */
  toggle: (id: string) => boolean
}

const Ctx = createContext<FavCtx>({ ids: new Set(), has: () => false, toggle: () => false })

export function useFavs() {
  return useContext(Ctx)
}

export function FavProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return
    }
    fetchFavoriteIds(user.uid).then((list) => setIds(new Set(list))).catch(() => {})
  }, [user?.uid])

  const value: FavCtx = {
    ids,
    has: (id) => ids.has(id),
    toggle: (id) => {
      if (!user) return false
      const on = !ids.has(id)
      setIds((prev) => {
        const next = new Set(prev)
        if (on) next.add(id)
        else next.delete(id)
        return next
      })
      setFavorite(user.uid, id, on).catch(() => {})
      return true
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
