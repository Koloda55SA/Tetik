import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { bumpListing, myListings, setListingStatus, deleteListing, updateProfile } from '../lib/db'
import { setLang } from '../lib/i18n'
import { formatPrice, type Listing } from '../lib/types'

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

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl">{t('profile.title')}</h1>
        <button className="btn-ghost text-sm" onClick={async () => { await signOut(); nav('/') }}>
          {t('auth.logout')}
        </button>
      </div>

      <form onSubmit={saveProfile} className="card p-4 space-y-3">
        <p className="text-sm text-muted">{profile?.email}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold">{t('profile.name')}</label>
            <input name="name" className="input mt-1" defaultValue={profile?.displayName || ''} />
          </div>
          <div>
            <label className="text-sm font-semibold">{t('profile.phone')}</label>
            <input name="phone" type="tel" className="input mt-1" defaultValue={profile?.phone || ''} placeholder="+996 ..." />
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold">{t('profile.city')}</label>
          <input name="city" className="input mt-1" defaultValue={profile?.city || ''} />
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary">{saved ? t('profile.saved') + ' ✓' : t('profile.save')}</button>
          <button type="button" className="chip" onClick={() => setLang(i18n.language === 'ru' ? 'ky' : 'ru')}>
            {t('profile.lang')}: {i18n.language.toUpperCase()}
          </button>
          <button type="button" className="chip" onClick={toggleTheme}>
            {t('profile.theme')}
          </button>
        </div>
      </form>

      <section>
        <h2 className="font-bold mb-3">{t('profile.myListings')} ({items.length})</h2>
        <div className="space-y-2">
          {items.map((l) => (
            <div key={l.id} className="card p-3 flex items-center gap-3">
              <img src={l.photos[0]} alt="" className="w-14 h-14 rounded-btn object-cover bg-surface2" />
              <div className="flex-1 min-w-0">
                <Link to={`/l/${l.id}`} className="text-sm font-semibold line-clamp-1">{l.title}</Link>
                <p className="text-xs text-muted">{formatPrice(l.price)} · {l.status}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {l.status === 'active' && (
                  <>
                    <button className="chip text-xs" onClick={async () => { await bumpListing(l.id!); }}>↑ {t('listing.bump')}</button>
                    <button className="chip text-xs" onClick={async () => { await setListingStatus(l.id!, 'sold'); setItems(await myListings(user.uid)) }}>{t('listing.markSold')}</button>
                  </>
                )}
                <button className="chip text-xs text-danger" onClick={async () => { if (confirm('?')) { await deleteListing(l.id!); setItems(await myListings(user.uid)) } }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
