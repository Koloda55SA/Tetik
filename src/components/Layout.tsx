import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { setLang } from '../lib/i18n'

const tabs = [
  { to: '/', key: 'nav.home', icon: '⌂' },
  { to: '/bazar', key: 'nav.bazar', icon: '⚙' },
  { to: '/new', key: 'nav.sell', icon: '+', accent: true },
  { to: '/chats', key: 'nav.chats', icon: '✉' },
  { to: '/stores', key: 'nav.stores', icon: '★' },
]

export default function Layout() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const nav = useNavigate()

  function toggleLang() {
    setLang(i18n.language === 'ru' ? 'ky' : 'ru')
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Верхняя панель */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Tetik">
            <img src="/logo-mark.svg" alt="" className="h-8 w-8" />
            <span className="font-display font-bold text-lg tracking-tight">TETIK</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {[
              { to: '/bazar', key: 'nav.bazar' },
              { to: '/chats', key: 'nav.chats' },
              { to: '/stores', key: 'nav.stores' },
            ].map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-btn text-sm font-semibold ${isActive ? 'bg-surface2 text-ink' : 'text-muted hover:text-ink'}`
                }
              >
                {t(l.key)}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <button onClick={toggleLang} className="chip text-xs font-bold uppercase" title={t('profile.lang')}>
            {i18n.language === 'ru' ? 'KY' : 'RU'}
          </button>

          <Link to="/new" className="btn-primary hidden md:inline-flex text-sm">
            + {t('nav.sell')}
          </Link>

          {user ? (
            <button onClick={() => nav('/profile')} className="btn-ghost text-sm">
              {t('nav.profile')}
            </button>
          ) : (
            <Link to="/login" className="btn-ghost text-sm">
              {t('auth.login')}
            </Link>
          )}
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-4 pb-24 md:pb-8">
        <Outlet />
      </main>

      {/* Футер (desktop) */}
      <footer className="hidden md:block border-t border-line py-6 text-center text-sm text-muted">
        <p>{t('common.footer')}</p>
        <p className="mt-1">{t('common.byStudio')}</p>
      </footer>

      {/* Нижние табы (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 text-[11px] font-semibold ${
                  tab.accent ? 'text-accent' : isActive ? 'text-ink' : 'text-muted'
                }`
              }
            >
              <span className={`text-lg leading-none mb-0.5 ${tab.accent ? 'bg-accent text-accent-fg rounded-full w-7 h-7 flex items-center justify-center' : ''}`}>
                {tab.icon}
              </span>
              {t(tab.key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
