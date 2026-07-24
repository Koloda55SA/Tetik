import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { ensureDmChat, getListing } from '../lib/db'
import { CATEGORIES, formatPrice, waLink, type Listing } from '../lib/types'

export default function ListingPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [l, setL] = useState<Listing | null>(null)
  const [photo, setPhoto] = useState(0)

  useEffect(() => {
    if (id) getListing(id).then(setL).catch(() => {})
  }, [id])

  if (!l) return <div className="card p-8 text-center text-muted">{t('common.loading')}</div>

  const cat = CATEGORIES.find((c) => c.slug === l.category)

  async function openChat() {
    if (!user) return nav('/login')
    const chatId = await ensureDmChat(
      { uid: user.uid, name: profile?.displayName || 'Покупатель' },
      { uid: l!.sellerId, name: l!.sellerName },
    )
    nav(`/chats/${chatId}`)
  }

  return (
    <div className="grid md:grid-cols-5 gap-4">
      {/* Фото */}
      <div className="md:col-span-3">
        <div className="card">
          <div className="aspect-[4/3] bg-surface2">
            {l.photos[photo] ? (
              <img src={l.photos[photo]} alt={l.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl text-muted">⚙</div>
            )}
          </div>
          {l.photos.length > 1 && (
            <div className="flex gap-2 p-2 overflow-x-auto">
              {l.photos.map((p, i) => (
                <button key={p} onClick={() => setPhoto(i)} className={`w-16 h-16 rounded-btn overflow-hidden border-2 shrink-0 ${i === photo ? 'border-accent' : 'border-transparent'}`}>
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 mt-4">
          <h2 className="font-bold mb-2">{t('listing.descLabel')}</h2>
          <p className="text-sm whitespace-pre-wrap">{l.desc || '—'}</p>
        </div>
      </div>

      {/* Инфо */}
      <div className="md:col-span-2 space-y-4">
        <div className="card p-4">
          {l.status === 'sold' && <span className="chip bg-danger text-white mb-2">{t('listing.sold')}</span>}
          <h1 className="font-bold text-lg leading-snug">{l.title}</h1>
          <p className="font-display font-bold text-2xl text-accent mt-2">{formatPrice(l.price)}</p>
          <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
            {cat && (
              <Link to={`/bazar?category=${cat.slug}`} className="chip">{i18n.language === 'ky' ? cat.ky : cat.ru}</Link>
            )}
            <span className="chip">{l.brand} {l.model}</span>
            {l.year && <span className="chip">{l.year}</span>}
            <span className="chip">{l.condition === 'new' ? t('bazar.new') : t('bazar.used')}</span>
            <span className="chip">{l.city}</span>
          </div>
          <p className="text-xs text-muted mt-3">{t('listing.views', { count: l.views })}</p>
        </div>

        <div className="card p-4 space-y-2">
          <p className="text-sm text-muted">{t('listing.seller')}: <span className="text-ink font-semibold">{l.sellerName}</span></p>
          <a href={`tel:${l.phone}`} className="btn-primary w-full">📞 {t('listing.call')}</a>
          <a href={waLink(l.whatsapp || l.phone, `Здравствуйте! По объявлению: ${l.title} (tetik)`)} target="_blank" rel="noopener noreferrer" className="btn w-full bg-[#25D366] text-white hover:opacity-90">
            {t('listing.whatsapp')}
          </a>
          {user?.uid !== l.sellerId && (
            <button onClick={openChat} className="btn-ghost w-full">💬 {t('listing.write')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
