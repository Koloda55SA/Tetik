import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { countByModels } from '../lib/db'
import { POPULAR_CARS, POPULAR_PARTS, SEO_CITIES } from '../lib/types'
import Icon from '../components/Icons'
import { useTitle } from '../lib/useTitle'

/** Витрина всех моделей — хаб для поисковиков и людей */
export default function Cars() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  useTitle('Запчасти по моделям машин — Кыргызстан · Tetik')

  useEffect(() => {
    countByModels().then(setCounts).catch(() => {})
  }, [])

  const brands = Array.from(new Set(POPULAR_CARS.map((c) => c.brand)))

  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-3xl">
          Запчасти по моделям машин
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Самые распространённые машины Кыргызстана — выберите свою и смотрите только подходящие
          детали. Toyota Camry, Honda Fit, Daewoo Nexia, Mercedes и другие: новые и б/у запчасти от
          продавцов, авторазборов и магазинов Бишкека, Оша и всей страны.
        </p>
      </header>

      {brands.map((brand) => {
        const models = POPULAR_CARS.filter((c) => c.brand === brand)
        return (
          <section key={brand}>
            <h2 className="section-title mb-3">{brand}</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {models.map((c) => {
                const n = counts[`${c.brand}|${c.model}`.toLowerCase()] || 0
                return (
                  <Link
                    key={c.slug}
                    to={`/cars/${c.slug}`}
                    className="card card-hover flex items-center justify-between gap-2 p-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{c.model}</span>
                      <span className="text-xs text-muted">
                        {n > 0 ? `${n} объявлений` : 'смотреть'}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} className="shrink-0 text-muted" />
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}

      <section>
        <h2 className="section-title mb-3">Популярные запросы</h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_PARTS.map((p) => (
            <Link key={p} to={`/bazar?q=${encodeURIComponent(p)}`} className="chip">
              {p}
            </Link>
          ))}
          {SEO_CITIES.map((c) => (
            <Link key={c} to={`/bazar?city=${encodeURIComponent(c)}`} className="chip">
              Запчасти {c}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
