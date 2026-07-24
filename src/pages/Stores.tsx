import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listStores } from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import type { Store } from '../lib/types'
import Icon from '../components/Icons'

export default function Stores() {
  const { t } = useTranslation()
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listStores()
      .then(setStores)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* Хиро-баннер */}
      <section className="relative -mx-4 overflow-hidden md:mx-0 md:rounded-[var(--r-xl)]">
        <img
          src="/heroes/stores-banner.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative flex min-h-[180px] items-end p-5 md:p-8">
          <h1 className="font-display text-2xl font-black text-white md:text-3xl">
            {t('store.title')}
          </h1>
        </div>
      </section>

      {/* Список магазинов */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-52 w-full" />
          ))}
        </div>
      ) : stores.length === 0 ? (
        <div className="card p-10 text-center">
          <Icon name="store" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
          <p className="mt-3 text-sm text-muted">{t('store.empty')}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {stores.map((s) => {
            const initial = s.name.slice(0, 1).toUpperCase()
            const bg = avatarHue(s.name)
            const color = avatarInk(s.name)
            return (
              <Link
                key={s.id}
                to={`/s/${s.slug}`}
                className="card card-hover overflow-hidden"
              >
                {/* Обложка */}
                <div className="h-28 overflow-hidden bg-surface2">
                  {s.cover && (
                    <img
                      src={s.cover}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>

                {/* Логотип + имя */}
                <div className="px-4 pb-4">
                  <div
                    className="flex h-14 w-14 -mt-7 shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-surface text-[18px] font-bold"
                    style={s.logo ? {} : { background: bg, color }}
                  >
                    {s.logo ? (
                      <img src={s.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="flex items-center gap-1.5 font-bold leading-tight">
                      {s.name}
                      {s.verified && (
                        <span className="badge-verified inline-flex items-center gap-0.5">
                          <Icon name="badgeCheck" size={11} />
                          {t('store.verified')}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                      <Icon name="pin" size={12} />
                      {s.city}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
