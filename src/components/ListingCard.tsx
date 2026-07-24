import { Link } from 'react-router-dom'
import { formatPrice, type Listing } from '../lib/types'

export default function ListingCard({ l }: { l: Listing }) {
  return (
    <Link to={`/l/${l.id}`} className="card group hover:border-accent transition-colors">
      <div className="aspect-[4/3] bg-surface2 overflow-hidden">
        {l.photos[0] ? (
          <img
            src={l.photos[0]}
            alt={l.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-muted">⚙</div>
        )}
      </div>
      <div className="p-3">
        <p className="font-bold text-accent">{formatPrice(l.price)}</p>
        <p className="text-sm leading-snug line-clamp-2 mt-0.5">{l.title}</p>
        <p className="text-xs text-muted mt-1.5 flex items-center gap-1">
          <span>{l.city}</span>
          <span>·</span>
          <span>{l.condition === 'new' ? 'новый' : 'б/у'}</span>
        </p>
      </div>
    </Link>
  )
}
