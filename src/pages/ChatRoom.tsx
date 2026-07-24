import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { getChat, sendMessage, subscribeMessages } from '../lib/db'
import { avatarHue, avatarInk } from '../lib/format'
import type { ChatMessage, ChatMeta } from '../lib/types'
import Icon from '../components/Icons'

export default function ChatRoom() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const [chat, setChat] = useState<ChatMeta | null>(null)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    getChat(id).then(setChat).catch(() => {})
    return subscribeMessages(id, setMsgs)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs.length])

  async function onSend(e: FormEvent) {
    e.preventDefault()
    if (!user || !id || !text.trim()) return
    const val = text
    setText('')
    await sendMessage(id, { uid: user.uid, name: profile?.displayName || 'Пользователь' }, val)
  }

  function title(): string {
    if (!chat) return '...'
    if (chat.type === 'group') return chat.title
    const other = chat.members.find((m) => m !== user?.uid)
    return (other && chat.memberNames?.[other]) || 'Чат'
  }

  const chatTitle = title()
  const avatarBg = avatarHue(chatTitle)
  const avatarColor = avatarInk(chatTitle)

  return (
    <div className="max-w-2xl mx-auto flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-14rem)]">
      {/* Шапка */}
      <div className="card mb-2 flex items-center gap-3 p-3">
        <Link to="/chats" className="icon-btn shrink-0">
          <Icon name="chevronLeft" size={20} />
        </Link>
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
          style={{ background: avatarBg, color: avatarColor }}
        >
          {chatTitle.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{chatTitle}</p>
          {chat?.type === 'group' && (
            <p className="text-xs text-muted">
              {t('chat.members', { count: chat.members.length })}
            </p>
          )}
        </div>
      </div>

      {/* Сообщения */}
      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {msgs.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">{t('chat.empty')}</p>
        )}
        {msgs.map((m) => {
          const mine = m.senderId === user?.uid
          const senderColor = avatarInk(m.senderName)
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`relative max-w-[80%] px-4 py-2.5 ${
                  mine
                    ? 'rounded-2xl rounded-br-md bg-ink text-bg'
                    : 'card rounded-2xl rounded-bl-md'
                }`}
              >
                {!mine && chat?.type === 'group' && (
                  <p
                    className="mb-0.5 text-xs font-bold"
                    style={{ color: senderColor }}
                  >
                    {m.senderName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
                <p
                  className={`mt-1 text-[10px] opacity-60 ${mine ? 'text-right' : 'text-left'}`}
                >
                  {m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Инпут */}
      {user ? (
        <form onSubmit={onSend} className="card flex items-center gap-2 p-2">
          <input
            className="h-10 flex-1 rounded-xl border-0 bg-surface2 px-4 text-[15px] text-ink placeholder:text-muted focus:outline-none"
            placeholder={t('chat.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-opacity disabled:opacity-40"
          >
            <Icon name="send" size={18} />
          </button>
        </form>
      ) : (
        <Link to="/login" className="btn-primary mt-2 w-full">
          {t('chat.needAuth')}
        </Link>
      )}
    </div>
  )
}
