import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { fetchFavoriteListings } from '../lib/db'
import { useTitle } from '../lib/useTitle'
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard'
import Icon from '../components/Icons'
import type { Listing } from '../lib/types'

export default function Favorites() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  useTitle(t('fav.title'))

  useEffect(() => {
    if (!user) return
    setLoading(true)
    fetchFavoriteListings(user.uid)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className="card p-10 text-center">
        <Icon name="heart" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
        <p className="mt-3 text-sm text-muted">{t('fav.empty')}</p>
        <Link to="/login" className="btn-primary mt-5 inline-flex">
          {t('auth.login')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="section-title">{t('fav.title')}</h1>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <Icon name="heart" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
          <p className="mt-3 text-sm text-muted">{t('fav.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {items.map((l) => (
            <ListingCard key={l.id} l={l} />
          ))}
        </div>
      )}
    </div>
  )
}
