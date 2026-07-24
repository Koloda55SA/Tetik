import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard'
import Icon from '../components/Icons'
import { fetchListings } from '../lib/db'
import { CATEGORIES, POPULAR_CARS, type Listing } from '../lib/types'

export default function Home() {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [fresh, setFresh] = useState<Listing[] | null>(null)

  useEffect(() => {
    fetchListings({}, 12).then(setFresh).catch(() => setFresh([]))
  }, [])

  return (
    <div className="space-y-9 md:space-y-12">
      {/* ======= Hero ======= */}
      <section className="relative -mx-4 overflow-hidden md:mx-0 md:rounded-[var(--r-xl)]">
        <img src="/heroes/hero-main.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
        <div className="relative px-5 py-12 md:px-12 md:py-20">
          <div className="max-w-xl">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/90 backdrop-blur">
              <Icon name="pin" size={13} />
              Кыргызстан · Бишкек · Ош
            </span>
            <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-tight text-white md:text-[40px]">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 md:text-base">{t('home.heroSub')}</p>
            <form
              className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lift"
              onSubmit={(e) => {
                e.preventDefault()
                nav(`/bazar?q=${encodeURIComponent(q)}`)
              }}
            >
              <Icon name="search" size={20} className="ml-2.5 shrink-0 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('home.searchPlaceholder')}
              type="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
                className="h-10 w-full bg-transparent text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
              <button className="btn-primary !h-10 shrink-0 !rounded-xl !px-4 text-sm md:!px-6">
                {t('bazar.search')}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ======= Категории ======= */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">{t('home.categories')}</h2>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={`/bazar?category=${c.slug}`}
              className="group relative aspect-square w-[31%] shrink-0 snap-start overflow-hidden rounded-2xl md:w-auto"
            >
              <img
                src={c.img}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <p className="absolute inset-x-2.5 bottom-2.5 text-[13px] font-bold leading-tight text-white md:text-sm">
                {i18n.language === 'ky' ? c.ky : c.ru}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ======= Найди по своей машине (SEO-хаб) ======= */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Найди по своей машине</h2>
          <Link to="/cars" className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:text-accent-hover">
            {t('nav.cars')}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {POPULAR_CARS.slice(0, 14).map((c) => (
            <Link key={c.slug} to={`/cars/${c.slug}`} className="chip shrink-0">
              {c.brand} {c.model}
            </Link>
          ))}
        </div>
      </section>

      {/* ======= Свежие объявления ======= */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">{t('home.fresh')}</h2>
          <Link to="/bazar" className="inline-flex items-center gap-1 text-sm font-bold text-accent hover:text-accent-hover">
            {t('home.allListings')}
            <Icon name="arrowRight" size={16} />
          </Link>
        </div>
        {fresh === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : fresh.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
            {fresh.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center text-sm text-muted">{t('bazar.empty')}</div>
        )}
      </section>

      {/* ======= Разделы-промо ======= */}
      <section className="grid gap-4 md:grid-cols-2">
        <Link to="/chats" className="card card-hover group relative overflow-hidden">
          <img src="/heroes/bazar-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/20" />
          <div className="relative flex min-h-[150px] flex-col justify-end p-5 md:p-6">
            <p className="flex items-center gap-2 text-lg font-extrabold text-white">
              <Icon name="chat" size={20} />
              {t('nav.chats')}
            </p>
            <p className="mt-1 max-w-sm text-sm text-white/70">{t('home.promoChats')}</p>
          </div>
        </Link>
        <Link to="/stores" className="card card-hover group relative overflow-hidden">
          <img src="/heroes/stores-banner.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/20" />
          <div className="relative flex min-h-[150px] flex-col justify-end p-5 md:p-6">
            <p className="flex items-center gap-2 text-lg font-extrabold text-white">
              <Icon name="badgeCheck" size={20} />
              {t('store.title')}
            </p>
            <p className="mt-1 max-w-sm text-sm text-white/70">{t('home.promoStores')}</p>
          </div>
        </Link>
      </section>
    </div>
  )
}
