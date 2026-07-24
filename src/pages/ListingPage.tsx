import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { ensureDmChat, getListing } from '../lib/db'
import { CATEGORIES, formatPrice, waLink, type Listing } from '../lib/types'
import { avatarHue, avatarInk, timeAgo } from '../lib/format'
import Icon from '../components/Icons'

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

  if (!l) {
    return (
      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-4 md:col-span-3">
          <div className="skeleton aspect-[4/3] w-full" />
          <div className="skeleton h-32 w-full" />
        </div>
        <div className="space-y-4 md:col-span-2">
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      </div>
    )
  }

  const cat = CATEGORIES.find((c) => c.slug === l.category)

  async function openChat() {
    if (!user) return nav('/login')
    const chatId = await ensureDmChat(
      { uid: user.uid, name: profile?.displayName || 'Покупатель' },
      { uid: l!.sellerId, name: l!.sellerName },
    )
    nav(`/chats/${chatId}`)
  }

  const sellerInitial = l.sellerName.slice(0, 1).toUpperCase()
  const sellerBg = avatarHue(l.sellerName)
  const sellerColor = avatarInk(l.sellerName)

  return (
    <div className="space-y-3">
      {/* Кнопка назад */}
      <button
        onClick={() => nav(-1)}
        className="icon-btn -ml-1 inline-flex items-center gap-1 !w-auto !rounded-xl px-3 text-sm font-semibold"
      >
        <Icon name="chevronLeft" size={18} />
        {t('common.back')}
      </button>

      <div className="grid gap-4 md:grid-cols-5">
        {/* Левая колонка */}
        <div className="space-y-4 md:col-span-3">
          {/* Галерея */}
          <div className="card overflow-hidden">
            <div className="relative aspect-[4/3] overflow-hidden bg-surface2">
              {l.photos[photo] ? (
                <img
                  src={l.photos[photo]}
                  alt={l.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted">
                  <Icon name="camera" size={36} strokeWidth={1.5} />
                </div>
              )}
            </div>
            {l.photos.length > 1 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto p-2">
                {l.photos.map((p, i) => (
                  <button
                    key={p}
                    onClick={() => setPhoto(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                      i === photo ? 'border-accent' : 'border-transparent'
                    }`}
                  >
                    <img src={p} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Описание */}
          <div className="card p-5">
            <h2 className="mb-2 font-bold">{t('listing.descLabel')}</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{l.desc || '—'}</p>
          </div>
        </div>

        {/* Правая колонка */}
        <div className="md:col-span-2">
          <div className="sticky top-20 space-y-4">
            {/* Цена и характеристики */}
            <div className="card p-5">
              {l.status === 'sold' && (
                <span className="badge mb-3 bg-surface2 text-muted">{t('listing.sold')}</span>
              )}
              <p className="text-[26px] font-extrabold tracking-tight text-accent">{formatPrice(l.price)}</p>
              <h1 className="mt-1 text-[15px] font-semibold leading-snug">{l.title}</h1>

              {/* Чипы-характеристики */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cat && (
                  <span className="chip !h-8 cursor-default text-xs">
                    {i18n.language === 'ky' ? cat.ky : cat.ru}
                  </span>
                )}
                <span className="chip !h-8 cursor-default text-xs">{l.brand} {l.model}</span>
                {l.year && <span className="chip !h-8 cursor-default text-xs">{l.year}</span>}
                <span className="chip !h-8 cursor-default text-xs">
                  {l.condition === 'new' ? t('bazar.new') : t('bazar.used')}
                </span>
              </div>

              {/* Метрики */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Icon name="eye" size={13} />
                  {t('listing.views', { count: l.views })}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="clock" size={13} />
                  {timeAgo(l.bumpedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Icon name="pin" size={13} />
                  {l.city}
                </span>
              </div>
            </div>

            {/* Продавец */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-bold"
                  style={{ background: sellerBg, color: sellerColor }}
                >
                  {sellerInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted">{t('listing.seller')}</p>
                  <p className="font-bold leading-tight">{l.sellerName}</p>
                </div>
              </div>

              <a href={`tel:${l.phone}`} className="btn-primary w-full">
                <Icon name="phone" size={17} />
                {t('listing.call')}
              </a>

              <a
                href={waLink(l.whatsapp || l.phone, `Здравствуйте! По объявлению: ${l.title} (tetik)`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn w-full bg-[#25D366] text-white hover:opacity-90"
              >
                <Icon name="whatsapp" size={17} />
                {t('listing.whatsapp')}
              </a>

              {user?.uid !== l.sellerId && (
                <button onClick={openChat} className="btn-ghost w-full">
                  <Icon name="chat" size={17} />
                  {t('listing.write')}
                </button>
              )}

              {/* Жалоба */}
              <div className="pt-1 text-center">
                <button className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors">
                  <Icon name="flag" size={13} />
                  Пожаловаться
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
