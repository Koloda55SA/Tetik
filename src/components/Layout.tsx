import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { fetchChatReads, subscribeMyDms } from '../lib/db'
import { setLang } from '../lib/i18n'
import type { ChatMeta } from '../lib/types'
import Icon from './Icons'
import ScrollManager from './ScrollManager'

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { user, profile, loading } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState('')

  // Обязательная анкета: без имени и телефона дальше не пускаем
  useEffect(() => {
    if (!loading && user && profile && !profile.phone && loc.pathname !== '/welcome') {
      nav('/welcome', { replace: true })
    }
  }, [loading, user, profile, loc.pathname])

  // Непрочитанные личные чаты: одна подписка на пользователя + пересчёт при навигации
  const [unread, setUnread] = useState(0)
  const [dms, setDms] = useState<ChatMeta[]>([])
  useEffect(() => {
    if (!user) {
      setDms([])
      return
    }
    return subscribeMyDms(user.uid, setDms)
  }, [user?.uid])

  useEffect(() => {
    if (!user || dms.length === 0) {
      setUnread(0)
      return
    }
    let alive = true
    fetchChatReads(user.uid)
      .then((reads) => {
        if (!alive) return
        setUnread(
          dms.filter((c) => c.id && c.lastMsgAt && (!reads[c.id] || c.lastMsgAt > reads[c.id])).length,
        )
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user?.uid, dms, loc.pathname])

  function toggleLang() {
    setLang(i18n.language === 'ru' ? 'ky' : 'ru')
  }

  function onSearch(e: FormEvent) {
    e.preventDefault()
    nav(`/bazar${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  // Комната чата на телефоне занимает весь экран: без отступов страницы
  // и без нижних табов — иначе клавиатура выдавливает поле ввода за экран
  const inChatRoom = /^\/chats\/[^/]+/.test(loc.pathname)

  const tabs = [
    { to: '/', key: 'nav.home', icon: 'home' as const },
    { to: '/bazar', key: 'nav.bazar', icon: 'grid' as const },
    { to: '/new', key: 'nav.sell', icon: 'plus' as const, accent: true },
    { to: '/chats', key: 'nav.chats', icon: 'chat' as const },
    { to: '/stores', key: 'nav.stores', icon: 'store' as const },
  ]

  return (
    <div className="min-h-dvh flex flex-col">
      <ScrollManager />
      {/* ======= Шапка ======= */}
      <header
        className={`sticky top-0 z-40 border-b border-line bg-surface ${
          inChatRoom ? 'hidden md:block' : ''
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Tetik">
            <img src="/logo-mark.svg" alt="" className="h-9 w-9" />
            <span className="font-display text-[17px] font-bold tracking-wide">TETIK</span>
          </Link>

          {/* Поиск в шапке (desktop) */}
          <form onSubmit={onSearch} className="relative mx-4 hidden max-w-md flex-1 md:block">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              type="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              className="h-10 w-full rounded-full border-0 bg-surface2 pl-10 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-line"
            />
          </form>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {[
              { to: '/bazar', key: 'nav.bazar' },
              { to: '/cars', key: 'nav.cars' },
              { to: '/chats', key: 'nav.chats' },
              { to: '/stores', key: 'nav.stores' },
            ].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {t(l.key)}
                {l.to === '/chats' && unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1 md:hidden" />
          <div className="hidden flex-1 lg:hidden md:block" />

          {user && (
            <Link to="/favorites" className="icon-btn hidden md:inline-grid" title={t('fav.title')}>
              <Icon name="heart" size={20} />
            </Link>
          )}

          <button onClick={toggleLang} className="icon-btn text-xs font-extrabold" title={t('profile.lang')}>
            {i18n.language === 'ru' ? 'KG' : 'RU'}
          </button>

          <Link to="/new" className="btn-primary hidden !h-10 text-sm md:inline-flex">
            <Icon name="plus" size={17} />
            {t('nav.sell')}
          </Link>

          {user ? (
            <button onClick={() => nav('/profile')} className="icon-btn" aria-label={t('nav.profile')}>
              <Icon name="user" size={21} />
            </button>
          ) : (
            <Link to="/login" className="btn-outline !h-10 text-sm">
              {t('auth.login')}
            </Link>
          )}
        </div>
      </header>

      {/* ======= Контент ======= */}
      <main
        className={
          inChatRoom
            ? 'mx-auto w-full max-w-6xl flex-1 px-0 pt-0 pb-0 md:px-4 md:pb-14 md:pt-5'
            : 'mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:pb-14'
        }
      >
        <Outlet />
      </main>

      {/* ======= Футер ======= */}
      <footer className="hidden bg-footer text-white/80 md:block">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.svg" alt="" className="h-9 w-9" />
              <span className="font-display text-lg font-bold tracking-wide text-white">TETIK</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{t('common.footer')}</p>
          </div>
          <div className="text-sm">
            <p className="mb-3 font-bold uppercase tracking-wider text-white/40">{t('nav.bazar')}</p>
            <div className="flex flex-col gap-2">
              <Link to="/bazar" className="hover:text-white">{t('home.allListings')}</Link>
              <Link to="/cars" className="hover:text-white">{t('nav.cars')}</Link>
              <Link to="/new" className="hover:text-white">{t('nav.sell')}</Link>
              <Link to="/chats" className="hover:text-white">{t('nav.chats')}</Link>
              <Link to="/stores" className="hover:text-white">{t('nav.stores')}</Link>
            </div>
          </div>
          <div className="text-sm">
            <p className="mb-3 font-bold uppercase tracking-wider text-white/40">Tetik</p>
            <p className="text-white/60">{t('common.byStudio')}</p>
            <p className="mt-2 text-white/40">© {new Date().getFullYear()} Tetik · Кыргызстан</p>
          </div>
        </div>
      </footer>

      {/* ======= Нижняя навигация (mobile) ======= */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-top md:hidden ${
          inChatRoom ? 'hidden' : ''
        }`}
      >
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = tab.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(tab.to)
            if (tab.accent) {
              return (
                <NavLink key={tab.to} to={tab.to} className="flex flex-col items-center justify-center py-1.5">
                  <span className="grid h-11 w-11 -translate-y-3 place-items-center rounded-full bg-accent text-accent-fg shadow-lift">
                    <Icon name="plus" size={24} />
                  </span>
                </NavLink>
              )
            }
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold ${active ? 'text-ink' : 'text-muted'}`}
              >
                <span className="relative">
                  <Icon name={tab.icon} size={22} strokeWidth={active ? 2.4 : 2} />
                  {tab.to === '/chats' && unread > 0 && (
                    <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </span>
                {t(tab.key)}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
