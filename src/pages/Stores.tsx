import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listStores } from '../lib/db'
import type { Store } from '../lib/types'

export default function Stores() {
  const { t } = useTranslation()
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listStores().then(setStores).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <section className="relative rounded-card overflow-hidden mb-6 min-h-[180px] flex items-end">
        <img src="/heroes/stores-banner.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <h1 className="relative font-display font-black text-2xl text-white p-5">{t('store.title')}</h1>
      </section>

      {loading ? (
        <div className="card p-8 text-center text-muted">{t('common.loading')}</div>
      ) : stores.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">{t('store.empty')}</div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {stores.map((s) => (
            <Link key={s.id} to={`/s/${s.slug}`} className="card group hover:border-accent transition-colors">
              <div className="h-28 bg-surface2 overflow-hidden">
                {s.cover && <img src={s.cover} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="p-3.5 flex items-center gap-3 -mt-7">
                <div className="w-14 h-14 rounded-card bg-surface border border-line overflow-hidden shrink-0 flex items-center justify-center font-display font-bold text-accent">
                  {s.logo ? <img src={s.logo} alt="" className="w-full h-full object-cover" /> : s.name.slice(0, 1)}
                </div>
                <div className="min-w-0 pt-6">
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    {s.name}
                    {s.verified && <span className="text-accent" title={t('store.verified')}>✔</span>}
                  </p>
                  <p className="text-xs text-muted">{s.city}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
