import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { listGroupChats, subscribeMyDms } from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import type { ChatMeta } from '../lib/types'
import Icon from '../components/Icons'

export default function Chats() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState<'groups' | 'dms'>('groups')
  const [groups, setGroups] = useState<ChatMeta[]>([])
  const [dms, setDms] = useState<ChatMeta[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)

  useEffect(() => {
    listGroupChats()
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoadingGroups(false))
  }, [])

  useEffect(() => {
    if (!user) return
    return subscribeMyDms(user.uid, setDms)
  }, [user])

  function dmTitle(c: ChatMeta): string {
    if (!user || !c.memberNames) return c.title || 'Чат'
    const other = c.members.find((m) => m !== user.uid)
    return (other && c.memberNames[other]) || 'Чат'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="section-title">{t('chat.title')}</h1>

      {/* Табы */}
      <div className="flex gap-2">
        <button
          className={`chip ${tab === 'groups' ? 'chip-active' : ''}`}
          onClick={() => setTab('groups')}
        >
          {t('chat.groups')}
        </button>
        <button
          className={`chip ${tab === 'dms' ? 'chip-active' : ''}`}
          onClick={() => setTab('dms')}
        >
          {t('chat.dms')}
        </button>
      </div>

      {tab === 'groups' ? (
        loadingGroups ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-20 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="card p-10 text-center">
            <Icon name="chat" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
            <p className="mt-3 text-sm text-muted">{t('chat.empty')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((c) => {
              const initial = c.title.slice(0, 1).toUpperCase()
              const bg = avatarHue(c.title)
              const color = avatarInk(c.title)
              return (
                <Link
                  key={c.id}
                  to={`/chats/${c.id}`}
                  className="card card-hover flex items-center gap-3 p-4"
                >
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold"
                    style={{ background: bg, color }}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-tight">{c.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                      {c.lastMsg || t('chat.empty')}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {t('chat.members', { count: c.members.length })}
                  </span>
                </Link>
              )
            })}
          </div>
        )
      ) : !user ? (
        <div className="card p-10 text-center">
          <Icon name="chat" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
          <p className="mt-3 text-sm text-muted">{t('chat.needAuth')}</p>
          <Link to="/login" className="btn-primary mt-5 inline-flex">
            {t('auth.login')}
          </Link>
        </div>
      ) : dms.length === 0 ? (
        <div className="card p-10 text-center">
          <Icon name="chat" size={36} strokeWidth={1.5} className="mx-auto text-muted" />
          <p className="mt-3 text-sm text-muted">{t('chat.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dms.map((c) => {
            const name = dmTitle(c)
            const initial = name.slice(0, 1).toUpperCase()
            const bg = avatarHue(name)
            const color = avatarInk(name)
            return (
              <Link
                key={c.id}
                to={`/chats/${c.id}`}
                className="card card-hover flex items-center gap-3 p-4"
              >
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold"
                  style={{ background: bg, color }}
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight">{name}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                    {c.lastMsg || '...'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
