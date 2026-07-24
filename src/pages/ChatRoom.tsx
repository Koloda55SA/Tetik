import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { getChat, sendMessage, subscribeMessages } from '../lib/db'
import type { ChatMessage, ChatMeta } from '../lib/types'

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

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-12rem)]">
      <div className="card p-3 flex items-center gap-3 mb-2">
        <Link to="/chats" className="btn-ghost !px-2.5 !py-1 text-sm">←</Link>
        <p className="font-bold">{title()}</p>
        {chat?.type === 'group' && (
          <span className="text-xs text-muted ml-auto">{t('chat.members', { count: chat.members.length })}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 px-1 py-2">
        {msgs.map((m) => {
          const mine = m.senderId === user?.uid
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-card px-3.5 py-2 ${mine ? 'bg-accent text-accent-fg' : 'bg-surface border border-line'}`}>
                {!mine && chat?.type === 'group' && (
                  <p className="text-[11px] font-bold text-accent mb-0.5">{m.senderName}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
              </div>
            </div>
          )
        })}
        {msgs.length === 0 && <p className="text-center text-sm text-muted py-8">{t('chat.empty')}</p>}
        <div ref={bottomRef} />
      </div>

      {user ? (
        <form onSubmit={onSend} className="flex gap-2 pt-2">
          <input
            className="input"
            placeholder={t('chat.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
          />
          <button className="btn-primary shrink-0">{t('chat.send')}</button>
        </form>
      ) : (
        <Link to="/login" className="btn-primary w-full mt-2">{t('chat.needAuth')}</Link>
      )}
    </div>
  )
}
