import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ListingCard from '../components/ListingCard'
import { fetchListings } from '../lib/db'
import { CATEGORIES, type Listing } from '../lib/types'

export default function Home() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [fresh, setFresh] = useState<Listing[]>([])

  useEffect(() => {
    fetchListings({}, 12).then(setFresh).catch(() => {})
  }, [])

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative rounded-card overflow-hidden -mx-4 md:mx-0 min-h-[300px] md:min-h-[360px] flex items-end md:rounded-card">
        <img src="/heroes/hero-main.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="relative p-5 md:p-10 max-w-xl text-white">
          <h1 className="font-display font-black text-2xl md:text-4xl leading-tight">{t('home.heroTitle')}</h1>
          <p className="mt-2 text-white/85 text-sm md:text-base">{t('home.heroSub')}</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              nav(`/bazar?q=${encodeURIComponent(q)}`)
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className="input bg-white/95 text-neutral-900 placeholder:text-neutral-500 border-transparent"
            />
            <button className="btn-primary shrink-0">{t('bazar.search')}</button>
          </form>
        </div>
      </section>

      {/* Категории */}
      <section>
        <h2 className="font-display font-bold text-lg mb-3">{t('home.categories')}</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} to={`/bazar?category=${c.slug}`} className="card group">
              <div className="aspect-square overflow-hidden">
                <img src={c.img} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <p className="p-2 text-xs md:text-sm font-semibold text-center leading-tight">
                {i18n.language === 'ky' ? c.ky : c.ru}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Свежие объявления */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg">{t('home.fresh')}</h2>
          <Link to="/bazar" className="text-sm font-semibold text-accent">
            {t('home.allListings')} →
          </Link>
        </div>
        {fresh.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {fresh.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center text-muted text-sm">{t('bazar.empty')}</div>
        )}
      </section>
    </div>
  )
}
