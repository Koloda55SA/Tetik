import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ListingCard from '../components/ListingCard'
import { fetchListings, type ListingFilters } from '../lib/db'
import { BRANDS, CATEGORIES, CITIES, type Listing } from '../lib/types'

export default function Bazar() {
  const { t, i18n } = useTranslation()
  const [sp, setSp] = useSearchParams()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const filters: ListingFilters = useMemo(
    () => ({
      q: sp.get('q') || undefined,
      category: sp.get('category') || undefined,
      brand: sp.get('brand') || undefined,
      city: sp.get('city') || undefined,
      condition: sp.get('condition') || undefined,
      minPrice: sp.get('min') ? Number(sp.get('min')) : undefined,
      maxPrice: sp.get('max') ? Number(sp.get('max')) : undefined,
    }),
    [sp],
  )

  useEffect(() => {
    setLoading(true)
    fetchListings(filters)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [filters])

  function set(key: string, val: string) {
    const next = new URLSearchParams(sp)
    if (val) next.set(key, val)
    else next.delete(key)
    setSp(next, { replace: true })
  }

  return (
    <div>
      <h1 className="font-display font-bold text-xl mb-4">{t('bazar.title')}</h1>

      {/* Фильтры */}
      <div className="card p-3 mb-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <input
          className="input col-span-2"
          placeholder={t('home.searchPlaceholder')}
          defaultValue={sp.get('q') || ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') set('q', (e.target as HTMLInputElement).value)
          }}
        />
        <select className="input" value={sp.get('category') || ''} onChange={(e) => set('category', e.target.value)}>
          <option value="">{t('bazar.category')}: {t('bazar.all')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>{i18n.language === 'ky' ? c.ky : c.ru}</option>
          ))}
        </select>
        <select className="input" value={sp.get('brand') || ''} onChange={(e) => set('brand', e.target.value)}>
          <option value="">{t('bazar.brand')}: {t('bazar.all')}</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select className="input" value={sp.get('city') || ''} onChange={(e) => set('city', e.target.value)}>
          <option value="">{t('bazar.city')}: {t('bazar.all')}</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="input" value={sp.get('condition') || ''} onChange={(e) => set('condition', e.target.value)}>
          <option value="">{t('bazar.condition')}: {t('bazar.all')}</option>
          <option value="new">{t('bazar.new')}</option>
          <option value="used">{t('bazar.used')}</option>
        </select>
        <div className="col-span-2 md:col-span-3 flex gap-2">
          <input
            className="input" type="number" placeholder={`${t('bazar.price')} ${t('bazar.from')}`}
            defaultValue={sp.get('min') || ''}
            onBlur={(e) => set('min', e.target.value)}
          />
          <input
            className="input" type="number" placeholder={t('bazar.to')}
            defaultValue={sp.get('max') || ''}
            onBlur={(e) => set('max', e.target.value)}
          />
        </div>
        <button className="btn-ghost text-sm md:col-span-1" onClick={() => setSp(new URLSearchParams(), { replace: true })}>
          {t('bazar.reset')}
        </button>
      </div>

      {/* Результаты */}
      {loading ? (
        <div className="card p-8 text-center text-muted">{t('common.loading')}</div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">{t('bazar.empty')}</div>
      ) : (
        <>
          <p className="text-sm text-muted mb-2">{t('bazar.found', { count: items.length })}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
