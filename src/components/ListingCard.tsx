import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatPrice, type Listing } from '../lib/types'
import { timeAgo } from '../lib/format'
import { useAuth } from '../lib/auth'
import { useFavs } from '../lib/favs'
import Icon from './Icons'

export default function ListingCard({ l }: { l: Listing }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { has, toggle } = useFavs()
  const nav = useNavigate()
  const fav = l.id ? has(l.id) : false

  function onHeart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!l.id) return
    if (!user) {
      nav('/login')
      return
    }
    toggle(l.id)
  }

  return (
    <Link to={`/l/${l.id}`} className="card card-hover group block overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface2">
        {l.photos[0] ? (
          <img
            src={l.photos[0]}
            alt={l.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted">
            <Icon name="camera" size={32} strokeWidth={1.5} />
          </div>
        )}
        {l.condition === 'new' && <span className="badge-new absolute left-2.5 top-2.5">{t('bazar.new')}</span>}
        <button
          onClick={onHeart}
          aria-label={t('fav.title')}
          className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full transition-all active:scale-90 ${
            fav ? 'bg-accent text-white' : 'bg-black/45 text-white backdrop-blur-sm hover:bg-black/60'
          }`}
        >
          <Icon name="heart" size={17} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="p-3">
        <p className="text-[17px] font-extrabold tracking-tight">{formatPrice(l.price)}</p>
        <p className="mt-1 line-clamp-2 min-h-[2.5em] text-[13.5px] leading-snug text-ink/80">{l.title}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
          <Icon name="pin" size={13} />
          {l.city}
          <span className="px-0.5">·</span>
          {timeAgo(l.bumpedAt)}
        </p>
      </div>
    </Link>
  )
}

export function ListingCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3] !rounded-none" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-5 w-24 !rounded-md" />
        <div className="skeleton h-4 w-full !rounded-md" />
        <div className="skeleton h-3 w-28 !rounded-md" />
      </div>
    </div>
  )
}
