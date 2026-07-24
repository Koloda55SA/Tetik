import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { createOrder, getStoreBySlug, listProducts } from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import { formatPrice, waLink, type Product, type Store } from '../lib/types'
import Icon from '../components/Icons'
import { useTitle } from '../lib/useTitle'

export default function StorePage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [ordering, setOrdering] = useState<Product | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  useTitle(store?.name || undefined)

  useEffect(() => {
    if (!slug) return
    getStoreBySlug(slug)
      .then(async (s) => {
        setStore(s)
        if (s?.id) setProducts(await listProducts(s.id))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="skeleton h-64 w-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="card p-10 text-center">
        <Icon name="store" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
        <p className="mt-3 text-sm text-muted">{t('store.empty')}</p>
      </div>
    )
  }

  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user) return nav('/login')
    if (!ordering || !store) return
    const fd = new FormData(e.currentTarget)
    await createOrder({
      storeId: store.id!,
      storeName: store.name,
      buyerUid: user.uid,
      buyerName: profile?.displayName || 'Покупатель',
      phone: String(fd.get('phone') || ''),
      comment: String(fd.get('comment') || ''),
      items: [{ productId: ordering.id!, name: ordering.name, price: ordering.price, qty: 1 }],
      total: ordering.price,
    })
    setOrdering(null)
    setDone(true)
    setTimeout(() => setDone(false), 4000)
  }

  const logoInitial = store.name.slice(0, 1).toUpperCase()
  const logoBg = avatarHue(store.name)
  const logoColor = avatarInk(store.name)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Шапка магазина */}
      <div className="card overflow-hidden">
        <div className="h-40 overflow-hidden bg-surface2">
          {store.cover && (
            <img src={store.cover} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start gap-4 -mt-10">
            <div
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border-4 border-surface text-2xl font-bold"
              style={store.logo ? {} : { background: logoBg, color: logoColor }}
            >
              {store.logo ? (
                <img src={store.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                logoInitial
              )}
            </div>
            <div className="min-w-0 flex-1 pt-8">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-extrabold">
                {store.name}
                {store.verified && (
                  <span className="badge-verified inline-flex items-center gap-1">
                    <Icon name="badgeCheck" size={12} />
                    {t('store.verified')}
                  </span>
                )}
              </h1>
              {store.desc && (
                <p className="mt-1 text-sm text-muted">{store.desc}</p>
              )}
              {(store.city || store.address) && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted">
                  <Icon name="pin" size={13} />
                  {store.city}
                  {store.address ? ` · ${store.address}` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <a href={`tel:${store.phone}`} className="btn-primary flex-1">
              <Icon name="phone" size={17} />
              {t('listing.call')}
            </a>
            <a
              href={waLink(
                store.whatsapp || store.phone,
                `Здравствуйте! Пишу из Tetik, магазин ${store.name}`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn flex-1 bg-[#25D366] text-white hover:opacity-90"
            >
              <Icon name="whatsapp" size={17} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Успешный заказ */}
      {done && (
        <div className="card p-4 flex items-center gap-2">
          <Icon name="check" size={16} className="text-ok" />
          <p className="text-sm font-semibold text-ok">{t('store.orderOk')}</p>
        </div>
      )}

      {/* Товары */}
      <div>
        <h2 className="section-title mb-4">
          {t('store.products')}
          {products.length > 0 && (
            <span className="ml-2 text-base font-semibold text-muted">({products.length})</span>
          )}
        </h2>

        {products.length === 0 ? (
          <div className="card p-10 text-center">
            <Icon name="tag" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
            <p className="mt-3 text-sm text-muted">{t('store.empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {products.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="aspect-square overflow-hidden bg-surface2">
                  {p.photos[0] && (
                    <img
                      src={p.photos[0]}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <p className="text-[15px] font-extrabold tracking-tight">{formatPrice(p.price)}</p>
                  <p className="line-clamp-2 text-[13.5px] leading-snug">{p.name}</p>
                  {p.inStock ? (
                    <span className="badge-success">{t('store.inStock')}</span>
                  ) : (
                    <span className="text-xs text-muted">{t('store.outStock')}</span>
                  )}
                  <button
                    className="btn-primary !h-9 w-full text-sm"
                    onClick={() => setOrdering(p)}
                  >
                    {t('store.order')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модалка заказа */}
      {ordering && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
          onClick={() => setOrdering(null)}
        >
          <form
            onSubmit={submitOrder}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-t-3xl bg-surface p-6 md:rounded-3xl"
          >
            <h3 className="font-bold text-[17px]">
              {t('store.orderTitle', { name: store.name })}
            </h3>

            {/* Товар */}
            <div className="card p-3 flex items-center gap-3">
              {ordering.photos[0] && (
                <img
                  src={ordering.photos[0]}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold line-clamp-1">{ordering.name}</p>
                <p className="text-sm font-bold text-accent">{formatPrice(ordering.price)}</p>
              </div>
            </div>

            <input
              name="phone"
              required
              type="tel"
              className="input"
              placeholder={`${t('listing.phoneLabel')} *`}
              defaultValue={profile?.phone || ''}
            />
            <textarea
              name="comment"
              rows={2}
              className="input"
              placeholder={t('store.orderComment')}
            />

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => setOrdering(null)}
              >
                {t('common.cancel')}
              </button>
              <button className="btn-primary flex-1">{t('store.orderSend')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
