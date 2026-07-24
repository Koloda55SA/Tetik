import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchByCar } from '../lib/db'
import {
  CATEGORIES,
  POPULAR_CARS,
  POPULAR_PARTS,
  SEO_CITIES,
  carBySlug,
  type Listing,
} from '../lib/types'
import ListingCard from '../components/ListingCard'
import Icon from '../components/Icons'
import { useTitle } from '../lib/useTitle'

/** SEO-страница: «Запчасти на Toyota Camry в Бишкеке» */
export default function CarPage() {
  const { slug } = useParams()
  const [sp, setSp] = useSearchParams()
  const { t, i18n } = useTranslation()
  const city = sp.get('city') || ''
  const car = slug ? carBySlug(slug) : undefined
  const [items, setItems] = useState<Listing[] | null>(null)

  const heading = car
    ? `Запчасти на ${car.brand} ${car.model}${city ? ` в ${city}` : ' в Кыргызстане'}`
    : 'Запчасти'

  useTitle(car ? `${heading} — купить, цены · Tetik` : undefined)

  useEffect(() => {
    if (!car) return
    setItems(null)
    fetchByCar(car.brand, car.model, city || undefined)
      .then(setItems)
      .catch(() => setItems([]))
  }, [car?.slug, city])

  // структурированные данные для Google
  useEffect(() => {
    if (!car) return
    const products = (items || []).slice(0, 20).map((l, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: l.title,
        image: l.photos?.[0],
        offers: {
          '@type': 'Offer',
          price: l.price,
          priceCurrency: 'KGS',
          availability: 'https://schema.org/InStock',
          url: `https://tetik.radev.digital/l/${l.id}`,
        },
      },
    }))
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tetik', item: 'https://tetik.radev.digital/' },
            { '@type': 'ListItem', position: 2, name: 'Запчасти по моделям', item: 'https://tetik.radev.digital/cars' },
            { '@type': 'ListItem', position: 3, name: `${car.brand} ${car.model}` },
          ],
        },
        ...(products.length ? [{ '@type': 'ItemList', name: heading, itemListElement: products }] : []),
      ],
    }
    const el = document.createElement('script')
    el.type = 'application/ld+json'
    el.textContent = JSON.stringify(ld)
    document.head.appendChild(el)
    const desc = document.querySelector('meta[name="description"]')
    const prev = desc?.getAttribute('content') || ''
    desc?.setAttribute(
      'content',
      `${heading}: ${items?.length || 0} объявлений от продавцов и магазинов. Новые и б/у детали, цены в сомах, доставка по КР. Tetik — запчасти Кыргызстана.`,
    )
    return () => {
      el.remove()
      if (desc && prev) desc.setAttribute('content', prev)
    }
  }, [car?.slug, items, heading])

  const related = useMemo(
    () => POPULAR_CARS.filter((c) => c.brand === car?.brand && c.slug !== car?.slug).slice(0, 6),
    [car?.slug],
  )

  if (!car) {
    return (
      <div className="card p-10 text-center">
        <Icon name="search" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
        <p className="mt-3 text-sm text-muted">Модель не найдена</p>
        <Link to="/cars" className="btn-primary mt-5 inline-flex">
          Все модели
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Хлебные крошки */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link to="/" className="hover:text-ink">
          Tetik
        </Link>
        <span>/</span>
        <Link to="/cars" className="hover:text-ink">
          По моделям
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink">
          {car.brand} {car.model}
        </span>
      </nav>

      <header className="space-y-3">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-3xl">{heading}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          {car.brand} {car.model} — одна из самых распространённых машин в Кыргызстане, поэтому детали
          на неё есть почти всегда. Ниже — актуальные объявления от частных продавцов, авторазборов и
          официальных магазинов: новые и б/у, оригинал и аналоги. Цены в сомах, связь напрямую по
          телефону или WhatsApp.
        </p>
      </header>

      {/* Фильтр по городу */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSp({})}
          className={`chip shrink-0 ${!city ? 'chip-active' : ''}`}
        >
          Вся страна
        </button>
        {SEO_CITIES.map((c) => (
          <button
            key={c}
            onClick={() => setSp({ city: c })}
            className={`chip shrink-0 ${city === c ? 'chip-active' : ''}`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Объявления */}
      {items === null ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[4/5] w-full" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <>
          <p className="text-sm text-muted">
            Найдено объявлений: <span className="font-bold text-ink">{items.length}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {items.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        </>
      ) : (
        <div className="card p-8 text-center">
          <Icon name="search" size={34} strokeWidth={1.5} className="mx-auto text-muted" />
          <p className="mt-3 font-bold">
            Пока нет объявлений на {car.brand} {car.model}
            {city ? ` в ${city}` : ''}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Спросите в группах — продавцы отвечают быстро. Или выложите своё объявление: если у вас
            есть деталь на эту машину, её ищут прямо сейчас.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/chats" className="btn-primary">
              <Icon name="chat" size={16} />
              Спросить в группе
            </Link>
            <Link to="/new" className="btn-outline">
              <Icon name="plus" size={16} />
              {t('nav.sell')}
            </Link>
          </div>
        </div>
      )}

      {/* Категории для этой машины — перелинковка */}
      <section>
        <h2 className="section-title mb-3">Категории запчастей</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to={`/bazar?brand=${encodeURIComponent(car.brand)}&category=${c.slug}`}
              className="chip"
            >
              {i18n.language === 'ky' ? c.ky : c.ru}
            </Link>
          ))}
        </div>
      </section>

      {/* Частые запросы */}
      <section>
        <h2 className="section-title mb-3">
          Что чаще всего ищут на {car.brand} {car.model}
        </h2>
        <div className="flex flex-wrap gap-2">
          {POPULAR_PARTS.map((p) => (
            <Link
              key={p}
              to={`/bazar?q=${encodeURIComponent(`${p} ${car.model}`)}`}
              className="chip"
            >
              {p}
            </Link>
          ))}
        </div>
      </section>

      {/* Другие модели этой марки */}
      {related.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Другие модели {car.brand}</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((c) => (
              <Link key={c.slug} to={`/cars/${c.slug}`} className="chip">
                {c.model}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Города */}
      <section>
        <h2 className="section-title mb-3">
          {car.brand} {car.model} по городам
        </h2>
        <div className="flex flex-wrap gap-2">
          {SEO_CITIES.map((c) => (
            <Link key={c} to={`/cars/${car.slug}?city=${encodeURIComponent(c)}`} className="chip">
              Запчасти в {c}
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
