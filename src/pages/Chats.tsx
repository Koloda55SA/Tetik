import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { listGroupChats, subscribeMyDms } from '../lib/db'
import type { ChatMeta } from '../lib/types'

export default function Chats() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState<'groups' | 'dms'>('groups')
  const [groups, setGroups] = useState<ChatMeta[]>([])
  const [dms, setDms] = useState<ChatMeta[]>([])

  useEffect(() => {
    listGroupChats().then(setGroups).catch(() => {})
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
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display font-bold text-xl mb-4">{t('chat.title')}</h1>

      <div className="flex gap-2 mb-4">
        <button className={`chip ${tab === 'groups' ? 'chip-active' : ''}`} onClick={() => setTab('groups')}>
          {t('chat.groups')}
        </button>
        <button className={`chip ${tab === 'dms' ? 'chip-active' : ''}`} onClick={() => setTab('dms')}>
          {t('chat.dms')}
        </button>
      </div>

      {tab === 'groups' ? (
        <div className="space-y-2">
          {groups.map((c) => (
            <Link key={c.id} to={`/chats/${c.id}`} className="card p-3.5 flex items-center gap-3 hover:border-accent transition-colors">
              <div className="w-11 h-11 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold shrink-0">
                {c.title.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{c.title}</p>
                <p className="text-xs text-muted line-clamp-1">{c.lastMsg || t('chat.empty')}</p>
              </div>
              <span className="text-xs text-muted shrink-0">{t('chat.members', { count: c.members.length })}</span>
            </Link>
          ))}
          {groups.length === 0 && <div className="card p-8 text-center text-muted text-sm">{t('chat.empty')}</div>}
        </div>
      ) : !user ? (
        <div className="card p-8 text-center">
          <p className="text-muted mb-4">{t('chat.needAuth')}</p>
          <Link to="/login" className="btn-primary">{t('auth.login')}</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {dms.map((c) => (
            <Link key={c.id} to={`/chats/${c.id}`} className="card p-3.5 flex items-center gap-3 hover:border-accent transition-colors">
              <div className="w-11 h-11 rounded-full bg-surface2 flex items-center justify-center font-bold shrink-0">
                {dmTitle(c).slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{dmTitle(c)}</p>
                <p className="text-xs text-muted line-clamp-1">{c.lastMsg || '...'}</p>
              </div>
            </Link>
          ))}
          {dms.length === 0 && <div className="card p-8 text-center text-muted text-sm">{t('chat.empty')}</div>}
        </div>
      )}
    </div>
  )
}
