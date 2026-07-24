import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ListingCard, { ListingCardSkeleton } from '../components/ListingCard'
import Icon from '../components/Icons'
import { fetchListings, type ListingFilters } from '../lib/db'
import { BRANDS, CATEGORIES, CITIES, type Listing } from '../lib/types'

export default function Bazar() {
  const { t, i18n } = useTranslation()
  const [sp, setSp] = useSearchParams()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [q, setQ] = useState(sp.get('q') || '')

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

  function onSearch(e: FormEvent) {
    e.preventDefault()
    set('q', q)
  }

  function reset() {
    setQ('')
    setSp(new URLSearchParams(), { replace: true })
  }

  const activeCategory = sp.get('category') || ''

  return (
    <div className="space-y-4">
      {/* Строка поиска */}
      <form onSubmit={onSearch} className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('home.searchPlaceholder')}
          className="input h-11 pl-10 pr-4"
        />
      </form>

      {/* Лента категорий + кнопка фильтров */}
      <div className="no-scrollbar -mx-4 flex snap-x items-center gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        <button
          className={`chip ${activeCategory === '' ? 'chip-active' : ''}`}
          onClick={() => set('category', '')}
        >
          {t('bazar.all')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            className={`chip snap-start ${activeCategory === c.slug ? 'chip-active' : ''}`}
            onClick={() => set('category', activeCategory === c.slug ? '' : c.slug)}
          >
            {i18n.language === 'ky' ? c.ky : c.ru}
          </button>
        ))}
        <button
          className={`chip shrink-0 snap-start ${showFilters ? 'chip-active' : ''}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Icon name="sliders" size={15} />
          {t('bazar.filters')}
        </button>
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('bazar.brand')}</label>
              <select
                className="input"
                value={sp.get('brand') || ''}
                onChange={(e) => set('brand', e.target.value)}
              >
                <option value="">{t('bazar.all')}</option>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('bazar.city')}</label>
              <select
                className="input"
                value={sp.get('city') || ''}
                onChange={(e) => set('city', e.target.value)}
              >
                <option value="">{t('bazar.all')}</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('bazar.condition')}</label>
              <select
                className="input"
                value={sp.get('condition') || ''}
                onChange={(e) => set('condition', e.target.value)}
              >
                <option value="">{t('bazar.all')}</option>
                <option value="new">{t('bazar.new')}</option>
                <option value="used">{t('bazar.used')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t('bazar.price')}</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  type="number"
                  placeholder={t('bazar.from')}
                  defaultValue={sp.get('min') || ''}
                  onBlur={(e) => set('min', e.target.value)}
                />
                <input
                  className="input"
                  type="number"
                  placeholder={t('bazar.to')}
                  defaultValue={sp.get('max') || ''}
                  onBlur={(e) => set('max', e.target.value)}
                />
              </div>
            </div>
          </div>
          <button className="btn-ghost" onClick={reset}>
            <Icon name="x" size={16} />
            {t('bazar.reset')}
          </button>
        </div>
      )}

      {/* Результаты */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <Icon name="search" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
          <p className="mt-3 text-sm text-muted">{t('bazar.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('bazar.found', { count: items.length })}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
            {items.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
