import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { bumpListing, myListings, setListingStatus, deleteListing, updateProfile } from '../lib/db'
import { setLang } from '../lib/i18n'
import { avatarHue, avatarInk } from '../lib/format'
import { formatPrice, CITIES, type Listing } from '../lib/types'
import Icon from '../components/Icons'
import { useFormDraft } from '../lib/useDraft'

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { user, profile, signOut, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Listing[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) nav('/login')
    else myListings(user.uid).then(setItems).catch(() => {})
  }, [user])

  if (!user) return null

  const email = profile?.email || user.email || ''
  const displayName = profile?.displayName || 'Пользователь'
  const avatarBg = avatarHue(email)
  const avatarColor = avatarInk(email)
  const isDark = document.documentElement.dataset.theme === 'dark'

  const draft = useFormDraft('profile')

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await updateProfile(user!.uid, {
      displayName: String(fd.get('name') || '').trim() || 'Пользователь',
      city: String(fd.get('city') || ''),
      phone: String(fd.get('phone') || '').trim(),
    })
    await refreshProfile()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function toggleTheme() {
    const html = document.documentElement
    const next = html.dataset.theme === 'dark' ? '' : 'dark'
    if (next) html.dataset.theme = next
    else delete html.dataset.theme
    localStorage.setItem('tetik-theme', next || 'light')
  }

  async function doLogout() {
    await signOut()
    nav('/')
  }

  async function bump(id: string) {
    await bumpListing(id)
    setItems(await myListings(user!.uid))
  }

  async function markSold(id: string) {
    await setListingStatus(id, 'sold')
    setItems(await myListings(user!.uid))
  }

  async function doDelete(id: string) {
    if (!confirm('Удалить объявление?')) return
    await deleteListing(id)
    setItems(await myListings(user!.uid))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="grid h-14 w-14 place-items-center rounded-full text-xl font-bold"
            style={{ background: avatarBg, color: avatarColor }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-xl font-extrabold">{displayName}</p>
            <p className="text-sm text-muted">{email}</p>
          </div>
        </div>
        <button onClick={doLogout} className="icon-btn" title={t('auth.logout')}>
          <Icon name="logout" size={20} />
        </button>
      </div>

      {/* Настройки */}
      <form ref={draft.ref} onSubmit={saveProfile} className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('profile.name')}</label>
            <input
              name="name"
              className="input"
              defaultValue={profile?.displayName || ''}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">{t('profile.phone')}</label>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input"
              defaultValue={profile?.phone || ''}
              placeholder="+996 ..."
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">{t('profile.city')}</label>
          <select name="city" className="input" defaultValue={profile?.city || ''}>
            <option value="">{t('bazar.all')}</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary">
            {saved ? (
              <><Icon name="check" size={16} />{t('profile.saved')}</>
            ) : (
              t('profile.save')
            )}
          </button>

          {/* Язык */}
          <button
            type="button"
            className="chip"
            onClick={() => setLang(i18n.language === 'ru' ? 'ky' : 'ru')}
          >
            <Icon name="globe" size={15} />
            {i18n.language.toUpperCase()}
          </button>

          {/* Тема */}
          <button type="button" className="chip" onClick={toggleTheme}>
            <Icon name={isDark ? 'sun' : 'moon'} size={15} />
            {t('profile.theme')}
          </button>
        </div>
      </form>

      {/* Мои объявления */}
      <section>
        <h2 className="section-title mb-4">
          {t('profile.myListings')}
          {items.length > 0 && (
            <span className="ml-2 text-base font-semibold text-muted">({items.length})</span>
          )}
        </h2>

        {items.length === 0 ? (
          <div className="card p-10 text-center">
            <Icon name="tag" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
            <p className="mt-3 text-sm text-muted">{t('bazar.empty')}</p>
            <Link to="/new" className="btn-primary mt-5 inline-flex">
              {t('nav.sell')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((l) => (
              <div key={l.id} className="card p-3 flex items-center gap-3">
                {/* Фото */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface2">
                  {l.photos[0] ? (
                    <img src={l.photos[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-muted">
                      <Icon name="camera" size={18} strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                {/* Инфо */}
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/l/${l.id}`}
                    className="line-clamp-1 font-semibold hover:text-accent transition-colors"
                  >
                    {l.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold">{formatPrice(l.price)}</span>
                    {l.status === 'active' && (
                      <span className="badge-success">{t('profile.active')}</span>
                    )}
                    {l.status === 'sold' && (
                      <span className="badge bg-surface2 text-muted">{t('listing.sold')}</span>
                    )}
                    {l.status === 'archived' && (
                      <span className="text-xs text-muted">{l.status}</span>
                    )}
                  </div>
                </div>

                {/* Действия */}
                <div className="flex shrink-0 items-center gap-1">
                  {l.status === 'active' && (
                    <>
                      <button
                        className="icon-btn"
                        title={t('listing.bump')}
                        onClick={() => bump(l.id!)}
                      >
                        <Icon name="arrowUp" size={18} />
                      </button>
                      <button
                        className="icon-btn"
                        title={t('listing.markSold')}
                        onClick={() => markSold(l.id!)}
                      >
                        <Icon name="check" size={18} />
                      </button>
                    </>
                  )}
                  <button
                    className="icon-btn text-danger"
                    title={t('listing.delete')}
                    onClick={() => doDelete(l.id!)}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
