import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { createOrder, getStoreBySlug, listProducts } from '../lib/db'
import { formatPrice, waLink, type Product, type Store } from '../lib/types'

export default function StorePage() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [store, setStore] = useState<Store | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [ordering, setOrdering] = useState<Product | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!slug) return
    getStoreBySlug(slug).then(async (s) => {
      setStore(s)
      if (s?.id) setProducts(await listProducts(s.id))
    }).catch(() => {})
  }, [slug])

  if (!store) return <div className="card p-8 text-center text-muted">{t('common.loading')}</div>

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

  return (
    <div className="max-w-3xl mx-auto">
      {/* Шапка магазина */}
      <div className="card overflow-hidden mb-4">
        <div className="h-36 bg-surface2">
          {store.cover && <img src={store.cover} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="p-4 flex items-start gap-4 -mt-9">
          <div className="w-20 h-20 rounded-card bg-surface border-2 border-line overflow-hidden shrink-0 flex items-center justify-center font-display font-bold text-2xl text-accent">
            {store.logo ? <img src={store.logo} alt="" className="w-full h-full object-cover" /> : store.name.slice(0, 1)}
          </div>
          <div className="pt-10 min-w-0 flex-1">
            <h1 className="font-display font-bold text-xl flex items-center gap-2">
              {store.name}
              {store.verified && <span className="chip chip-active text-xs">✔ {t('store.verified')}</span>}
            </h1>
            <p className="text-sm text-muted mt-1">{store.desc}</p>
            <p className="text-xs text-muted mt-2">
              {store.city}{store.address ? ` · ${store.address}` : ''}
            </p>
          </div>
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <a href={`tel:${store.phone}`} className="btn-primary flex-1">📞 {t('listing.call')}</a>
          <a href={waLink(store.whatsapp || store.phone, `Здравствуйте! Пишу из Tetik, магазин ${store.name}`)} target="_blank" rel="noopener noreferrer" className="btn flex-1 bg-[#25D366] text-white hover:opacity-90">
            WhatsApp
          </a>
        </div>
      </div>

      {done && <div className="card p-3 mb-4 text-ok font-semibold text-sm">✓ {t('store.orderOk')}</div>}

      {/* Товары */}
      <h2 className="font-bold mb-3">{t('store.products')} ({products.length})</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {products.map((p) => (
          <div key={p.id} className="card">
            <div className="aspect-square bg-surface2 overflow-hidden">
              {p.photos[0] && <img src={p.photos[0]} alt={p.name} loading="lazy" className="w-full h-full object-cover" />}
            </div>
            <div className="p-3">
              <p className="font-bold text-accent text-sm">{formatPrice(p.price)}</p>
              <p className="text-sm line-clamp-2 mt-0.5">{p.name}</p>
              <p className={`text-xs mt-1 ${p.inStock ? 'text-ok' : 'text-muted'}`}>
                {p.inStock ? t('store.inStock') : t('store.outStock')}
              </p>
              <button className="btn-primary w-full mt-2 !py-1.5 text-sm" onClick={() => setOrdering(p)}>
                {t('store.order')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Модалка заказа */}
      {ordering && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setOrdering(null)}>
          <form
            onSubmit={submitOrder}
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-t-card md:rounded-card w-full max-w-md p-5 space-y-3"
          >
            <h3 className="font-bold">{t('store.orderTitle', { name: store.name })}</h3>
            <div className="card p-3 flex items-center gap-3">
              {ordering.photos[0] && <img src={ordering.photos[0]} alt="" className="w-12 h-12 rounded-btn object-cover" />}
              <div>
                <p className="text-sm font-semibold">{ordering.name}</p>
                <p className="text-sm text-accent font-bold">{formatPrice(ordering.price)}</p>
              </div>
            </div>
            <input name="phone" required type="tel" className="input" placeholder={t('listing.phoneLabel') + ' *'} defaultValue={profile?.phone || ''} />
            <textarea name="comment" rows={2} className="input" placeholder={t('store.orderComment')} />
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setOrdering(null)}>{t('common.cancel')}</button>
              <button className="btn-primary flex-1">{t('store.orderSend')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
