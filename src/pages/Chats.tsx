import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import {
  createGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  listGroupChats,
  subscribeMyDms,
} from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import { CITIES, type ChatMeta } from '../lib/types'
import Icon from '../components/Icons'
import { useTitle } from '../lib/useTitle'

export default function Chats() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState<'groups' | 'dms'>('groups')
  const [groups, setGroups] = useState<ChatMeta[]>([])
  const [dms, setDms] = useState<ChatMeta[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  useTitle(t('chat.title'))

  const isAdmin = profile?.role === 'admin'

  const reloadGroups = useCallback(async () => {
    const g = await listGroupChats().catch(() => [] as ChatMeta[])
    setGroups(g)
  }, [])

  useEffect(() => {
    reloadGroups().finally(() => setLoadingGroups(false))
  }, [reloadGroups])

  useEffect(() => {
    if (!user) {
      setDms([])
      return
    }
    return subscribeMyDms(user.uid, setDms)
  }, [user?.uid])

  function dmTitle(c: ChatMeta): string {
    if (!user || !c.memberNames) return c.title || 'Чат'
    const other = c.members.find((m) => m !== user.uid)
    return (other && c.memberNames[other]) || 'Чат'
  }

  const isMember = (c: ChatMeta) => !!user && c.members.includes(user.uid)

  async function onJoin(c: ChatMeta) {
    if (!user) return nav('/login')
    if (!c.id) return
    setBusyId(c.id)
    try {
      await joinGroup(c.id, profile?.displayName)
      await reloadGroups()
      nav(`/chats/${c.id}`)
    } catch {
      alert(t('common.error'))
    } finally {
      setBusyId(null)
    }
  }

  async function onLeave(c: ChatMeta) {
    if (!c.id || !window.confirm(t('chat.leaveConfirm'))) return
    setBusyId(c.id)
    try {
      await leaveGroup(c.id)
      await reloadGroups()
    } catch {
      alert(t('common.error'))
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(c: ChatMeta) {
    if (!c.id || !window.confirm(t('chat.deleteConfirm'))) return
    setBusyId(c.id)
    try {
      await deleteGroup(c.id)
      await reloadGroups()
    } catch {
      alert(t('common.error'))
    } finally {
      setBusyId(null)
    }
  }

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!user || createBusy) return
    const fd = new FormData(e.currentTarget)
    const title = String(fd.get('title') || '').trim()
    if (!title) return
    setCreateBusy(true)
    try {
      const id = await createGroup({
        title,
        region: String(fd.get('region') || ''),
        topic: String(fd.get('topic') || ''),
        owner: { uid: user.uid, name: profile?.displayName || 'Админ' },
      })
      setCreating(false)
      await reloadGroups()
      nav(`/chats/${id}`)
    } catch {
      alert(t('chat.createDenied'))
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="section-title flex-1">{t('chat.title')}</h1>
        {isAdmin && tab === 'groups' && (
          <button className="btn-outline !h-9 text-sm" onClick={() => setCreating((v) => !v)}>
            <Icon name={creating ? 'x' : 'plus'} size={15} />
            {t('chat.createGroup')}
          </button>
        )}
      </div>

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

      {/* Создание группы — только админ */}
      {isAdmin && creating && tab === 'groups' && (
        <form onSubmit={onCreate} className="card space-y-3 p-4">
          <p className="font-bold">{t('chat.createGroup')}</p>
          <input
            name="title"
            required
            maxLength={60}
            autoFocus
            className="input"
            placeholder={t('chat.groupNamePh')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select name="region" className="input">
              <option value="">{t('chat.regionAny')}</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input name="topic" maxLength={80} className="input" placeholder={t('chat.topicPh')} />
          </div>
          <button disabled={createBusy} className="btn-primary h-11 w-full">
            {createBusy ? t('common.loading') : t('chat.create')}
          </button>
        </form>
      )}

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
            <p className="mt-3 text-sm text-muted">{t('chat.noGroups')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((c) => {
              const initial = c.title.slice(0, 1).toUpperCase()
              const bg = avatarHue(c.title)
              const color = avatarInk(c.title)
              const member = isMember(c)
              const busy = busyId === c.id
              return (
                <div key={c.id} className="card flex items-center gap-3 p-4">
                  <Link to={`/chats/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[15px] font-bold"
                      style={{ background: bg, color }}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[15px] font-bold leading-tight">
                        <span className="truncate">{c.title}</span>
                        {member && <Icon name="check" size={13} className="shrink-0 text-ok" />}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted">
                        {c.lastMsg || t('chat.empty')}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {t('chat.members', { count: c.members.length })}
                        {c.region ? ` · ${c.region}` : ''}
                      </p>
                    </div>
                  </Link>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    {member ? (
                      <button
                        onClick={() => onLeave(c)}
                        disabled={busy}
                        className="btn-ghost !h-8 px-3 text-xs disabled:opacity-40"
                      >
                        {t('chat.leave')}
                      </button>
                    ) : (
                      <button
                        onClick={() => onJoin(c)}
                        disabled={busy}
                        className="btn-primary !h-8 px-3 text-xs disabled:opacity-40"
                      >
                        {busy ? '...' : t('chat.join')}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => onDelete(c)}
                        disabled={busy}
                        className="icon-btn !h-8 !w-8 text-danger"
                        title={t('common.delete')}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
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
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{c.lastMsg || '...'}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
